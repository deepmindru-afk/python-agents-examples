"""
---
title: Note Taking Assistant
category: complex-agents
tags: [complex-agents, cerebras, deepgram]
difficulty: intermediate
description: Shows how to use the Note Taking Assistant.
demonstrates:
  - Using the Note Taking Assistant.
---
"""
import base64
import os
import logging
import asyncio
import json
from pathlib import Path
from dotenv import load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.agents.llm import ChatContext, ChatMessage
from livekit.plugins import openai, silero, deepgram
from livekit.agents.telemetry import set_tracer_provider
from livekit.agents import metrics, MetricsCollectedEvent
from typing import List
import re

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')
usage_collector = metrics.UsageCollector()
logger = logging.getLogger("note_taking_assistant")
logger.setLevel(logging.INFO)

def setup_langfuse(
    host: str | None = None, public_key: str | None = None, secret_key: str | None = None
):
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    public_key = public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
    secret_key = secret_key or os.getenv("LANGFUSE_SECRET_KEY")
    host = host or os.getenv("LANGFUSE_HOST")

    if not public_key or not secret_key or not host:
        raise ValueError("LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, and LANGFUSE_HOST must be set")

    langfuse_auth = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"{host.rstrip('/')}/api/public/otel"
    os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {langfuse_auth}"

    trace_provider = TracerProvider()
    trace_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    set_tracer_provider(trace_provider)

class NoteTakingAssistant:
    def __init__(self, ctx: JobContext):
        self.transcriptions: List[str] = []
        self.current_notes: str = ""
        self.note_update_task = None
        # Buffer for accumulating transcription fragments
        self.transcript_buffer: str = ""
        # Create LLM instance once with Cerebras
        self.llm = openai.LLM.with_cerebras(model="gpt-oss-120b")
        # Store context for RPC communication
        self.ctx = ctx
    
    async def update_notes(self, new_transcription: str):
        """Send transcription to Cerebras and update notes"""
        try:
            # Send to LLM for processing
            prompt = f"""
                You are a note-taking assistant for a voice-based meeting between a doctor and a patient. You will get a transcript of what is being said, and your job is to take notes.
                Current Notes:
                {self.current_notes if self.current_notes else "(No notes yet)"}

                New Transcription:
                {new_transcription}

                Instructions:
                You should try to track:
                - Chief complaints
                - History of present illness
                - Past medical history

                Only add headers for this information if it is explicitly discussed in the transcription.
                If it is not discussed, do not add any headers for that topic.

                - Integrate the new information into the existing notes if there is any information that should be included.
                - Your job is to capture the spirit of the conversation and the key points that are being discussed, but you don't need to
                include every single thing that is said
                - Never add any information that is not in the transcription.
                - Never add notes about things that should be "confirmed" or "asked" to the patient that haven't been discussed.
                - Your job is exclusively to capture what has been discussed, not keep track of what SHOULD be discussed.
                - Only ever add information that is explicitly discussed in the transcription.
                - Keep the notes organized and structured

                Updated Notes:
            """

            ctx = ChatContext([
                ChatMessage(
                    type="message",
                    role="system",
                    content=["""
                             You are an intelligent note-taking medical assistant that creates well-organized, comprehensive notes from patient & doctor transcriptions.
                                - Never add any information that is not in the transcription.
                                - Never add notes about things that should be "confirmed" or "asked" to the patient that haven't been discussed.
                                - Your job is exclusively to capture what has been discussed, not keep track of what SHOULD be discussed.
                             """]
                ),
                ChatMessage(
                    type="message",
                    role="user",
                    content=[prompt]
                )
            ])
            
            response = ""
            async with self.llm.chat(chat_ctx=ctx) as stream:
                async for chunk in stream:
                    if not chunk:
                        continue
                    content = getattr(chunk.delta, 'content', None) if hasattr(chunk, 'delta') else str(chunk)
                    if content:
                        response += content
            
            self.current_notes = response.strip()
            
            # Send updated notes to frontend via RPC
            await self.send_notes_to_frontend()
            
        except Exception as e:
            logger.error(f"Error updating notes: {e}")
    
    async def send_notes_to_frontend(self):
        """Send current notes and transcriptions to frontend via RPC"""
        try:
            # Get remote participants
            remote_participants = list(self.ctx.room.remote_participants.values())
            if not remote_participants:
                logger.info("No remote participants found to send notes")
                return
            
            # Send to the first remote participant (the frontend)
            client_participant = remote_participants[0]
            
            # Send notes via RPC
            await self.ctx.room.local_participant.perform_rpc(
                destination_identity=client_participant.identity,
                method="receive_notes",
                payload=json.dumps({
                    "notes": self.current_notes,
                    "transcriptions": self.transcriptions,
                    "timestamp": asyncio.get_event_loop().time()
                })
            )
            logger.info(f"Sent notes to frontend ({client_participant.identity})")
        except Exception as e:
            logger.error(f"Error sending notes via RPC: {e}")
    
    async def send_transcription_to_frontend(self, transcription: str):
        """Send individual transcription to frontend via RPC"""
        try:
            # Get remote participants
            remote_participants = list(self.ctx.room.remote_participants.values())
            if not remote_participants:
                logger.info("No remote participants found to send transcription")
                return
            
            # Send to the first remote participant (the frontend)
            client_participant = remote_participants[0]
            
            # Send transcription via RPC
            await self.ctx.room.local_participant.perform_rpc(
                destination_identity=client_participant.identity,
                method="receive_transcription",
                payload=json.dumps({
                    "transcription": transcription,
                    "timestamp": asyncio.get_event_loop().time()
                })
            )
            logger.info(f"Sent transcription to frontend: {transcription[:50]}...")
        except Exception as e:
            logger.error(f"Error sending transcription via RPC: {e}")

async def entrypoint(ctx: JobContext):
    setup_langfuse()  # set up the langfuse tracer

    session = AgentSession()
    
    # Create the agent
    agent = Agent(
        instructions="""
            You are a note-taking assistant.
        """,
        stt=deepgram.STT(),
        vad=silero.VAD.load()
    )

    # Create note-taking assistant
    note_assistant = NoteTakingAssistant(ctx)

    @session.on("user_input_transcribed")
    def on_transcript(transcript):
        if transcript.is_final:
            # Add to buffer with a space
            if note_assistant.transcript_buffer:
                note_assistant.transcript_buffer += " " + transcript.transcript
            else:
                note_assistant.transcript_buffer = transcript.transcript
                
            logger.info(f"Fragment received: {transcript.transcript}")
            
            # Count sentences in buffer (looking for . ! ? endings)
            sentence_endings = re.findall(r'[.!?]+', note_assistant.transcript_buffer)
            
            # If we have at least 3 sentences, process the buffer
            if len(sentence_endings) >= 3:
                # Find the position after the third sentence ending
                sentence_count = 0
                last_pos = 0
                for match in re.finditer(r'[.!?]+', note_assistant.transcript_buffer):
                    sentence_count += 1
                    if sentence_count == 3:
                        last_pos = match.end()
                        break
                
                # Extract the three sentences
                three_sentences = note_assistant.transcript_buffer[:last_pos].strip()
                
                # Keep the remainder in the buffer
                note_assistant.transcript_buffer = note_assistant.transcript_buffer[last_pos:].strip()
                
                # Add the three sentences to transcriptions
                note_assistant.transcriptions.append(three_sentences)
                logger.info(f"Added to transcriptions: {three_sentences}")
                
                # Send transcription to frontend immediately
                asyncio.create_task(note_assistant.send_transcription_to_frontend(three_sentences))
                
                # Cancel any pending note update task
                if note_assistant.note_update_task and not note_assistant.note_update_task.done():
                    note_assistant.note_update_task.cancel()
                
                # Schedule new note update with the three sentences
                note_assistant.note_update_task = asyncio.create_task(
                    note_assistant.update_notes(three_sentences)
                )
    
    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    logger.info("Note-taking assistant started. Listening for transcriptions...")

    await session.start(
        agent=agent,
        room=ctx.room
    )

    ctx.add_shutdown_callback(log_usage)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))