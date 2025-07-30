"""
---
title: Deep Fake Detection Agent
category: monitoring
tags: [vision, deep-fake, ai-detection, monitoring, google, deepgram]
difficulty: advanced
description: Shows how to create an agent that monitors video streams for AI bots and deep fake detection.
demonstrates:
  - Monitoring video streams from participants in real-time
  - Using vision AI to analyze frames for deep fake detection
  - Sending chat messages when AI bots or deep fakes are detected
  - Using RPC to communicate detection results to clients
  - Continuous monitoring without interrupting normal conversation
---
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import AsyncIterable, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli, get_job_context, RoomOutputOptions
from livekit.agents.llm import function_tool, ImageContent, ChatContext, ChatMessage
from livekit.agents.voice import Agent, AgentSession, RunContext
from livekit.plugins import silero, google

logger = logging.getLogger("deep-fake-detector")
logger.setLevel(logging.INFO)

load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

@dataclass
class DetectionResult:
    """Class to represent a detection result."""
    participant_id: str
    participant_name: str
    detection_type: str  # "ai_bot" or "deep_fake"
    confidence: float
    timestamp: datetime
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ParticipantData:
    """Class to store participant monitoring data."""
    participant_id: str
    participant_name: str
    video_stream: Optional[rtc.VideoStream] = None
    last_frame_time: Optional[float] = None
    detection_count: int = 0
    last_detection_time: Optional[float] = None
    is_monitoring: bool = False

class DeepFakeDetectionAgent(Agent):
    def __init__(self) -> None:
        logger.info("Initializing DeepFakeDetectionAgent")
        
        self._participants: Dict[str, ParticipantData] = {}
        self._detection_results: list[DetectionResult] = []
        self._monitoring_tasks: list[asyncio.Task] = []
        self._analysis_interval = 2.0  # Analyze frames every 2 seconds
        self._detection_cooldown = 30.0  # Don't report same participant for 30 seconds
        
        logger.info(f"Agent configuration: analysis_interval={self._analysis_interval}s, detection_cooldown={self._detection_cooldown}s")
        
        super().__init__(
            instructions="""
                You are a deep fake detection agent that monitors video streams for AI bots and deep fakes.
                You will recieve video clips from participants.
                Analyze these video clips for signs of AI-generated content, deep fakes, or bot behavior.
                Respond with 'DETECTION: AI_BOT' or 'DETECTION: DEEP_FAKE' followed by confidence level (0-100) and details if you detect something suspicious, otherwise respond with 'NO_DETECTION'.
                Do not include any other text in your response.
                
                Focus on detecting:
                - Unnatural facial movements or expressions
                - Inconsistent lighting or shadows
                - Artifacts around the face or body
                - Unrealistic skin texture or features
                - Synchronization issues between audio and video
                - Repetitive or mechanical behaviors
            """,
            llm=google.LLM(model="gemini-2.5-flash-lite", tool_choice=None),
            vad=silero.VAD.load()
        )
        
        logger.info("DeepFakeDetectionAgent initialization complete")

    async def on_enter(self):
        """Initialize monitoring when agent enters the room."""
        room = get_job_context().room
        logger.info(f"Deep fake detection agent entering room: {room.name}")
        
        # Monitor existing participants
        logger.info(f"Found {len(room.remote_participants)} existing participants")
        for participant_id, participant in room.remote_participants.items():
            logger.info(f"Starting monitoring for existing participant: {participant.name or participant.identity}")
            await self._start_monitoring_participant(participant)
        
        # Watch for new participants
        @room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            async def handle_participant_connected():
                logger.info(f"New participant connected: {participant.name or participant.identity}")
                await self._start_monitoring_participant(participant)
            asyncio.create_task(handle_participant_connected())
        
        # Watch for participant disconnections
        @room.on("participant_disconnected")
        def on_participant_disconnected(participant: rtc.RemoteParticipant):
            async def handle_participant_disconnected():
                logger.info(f"Participant disconnected: {participant.name or participant.identity}")
                await self._stop_monitoring_participant(participant.identity)
            asyncio.create_task(handle_participant_disconnected())
        
        # Watch for new video tracks
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            async def handle_track_subscribed():
                logger.info(f"Track subscribed: {track.kind} from {participant.name or participant.identity}")
                if track.kind == rtc.TrackKind.KIND_VIDEO:
                    logger.info(f"Video track subscribed for {participant.name or participant.identity}")
                    # Check if participant is already being monitored
                    if participant.identity in self._participants:
                        logger.info(f"Participant {participant.identity} already in monitoring list, creating video stream")
                    else:
                        logger.info(f"Participant {participant.identity} not yet in monitoring list, will be added during video stream creation")
                    await self._create_video_stream(track, participant)
                else:
                    logger.debug(f"Non-video track subscribed: {track.kind}")
            asyncio.create_task(handle_track_subscribed())
        
        logger.info("Deep fake detection agent initialization complete")

    async def _start_monitoring_participant(self, participant: rtc.RemoteParticipant):
        """Start monitoring a new participant."""
        logger.info(f"Starting monitoring for participant: {participant.name or participant.identity}")
        
        participant_data = ParticipantData(
            participant_id=participant.identity,
            participant_name=participant.name or participant.identity
        )
        self._participants[participant.identity] = participant_data
        
        # Check for existing video tracks
        video_tracks = [
            publication.track
            for publication in list(participant.track_publications.values())
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO
        ]
        
        logger.info(f"Found {len(video_tracks)} existing video tracks for {participant.name or participant.identity}")
        if video_tracks:
            logger.info(f"Creating video stream for existing video track from {participant.name or participant.identity}")
            await self._create_video_stream(video_tracks[0], participant)
        else:
            logger.info(f"No existing video tracks found for {participant.name or participant.identity}, waiting for track subscription")
        
        logger.info(f"Started monitoring participant: {participant.name or participant.identity}")

    async def _stop_monitoring_participant(self, participant_id: str):
        """Stop monitoring a participant."""
        if participant_id in self._participants:
            participant_data = self._participants[participant_id]
            if participant_data.video_stream:
                await participant_data.video_stream.aclose()
            participant_data.is_monitoring = False
            del self._participants[participant_id]
            logger.info(f"Stopped monitoring participant: {participant_id}")

    async def _create_video_stream(self, track: rtc.Track, participant: rtc.RemoteParticipant):
        """Create a video stream for monitoring."""
        participant_id = participant.identity
        logger.info(f"Creating video stream for participant {participant_id} ({participant.name or participant.identity})")
        
        if participant_id not in self._participants:
            logger.info(f"Participant {participant_id} not found in participants dict, adding them now")
            # Add the participant to the dict if they're not there yet
            participant_data = ParticipantData(
                participant_id=participant.identity,
                participant_name=participant.name or participant.identity
            )
            self._participants[participant.identity] = participant_data
        else:
            participant_data = self._participants[participant_id]
        
        # Close any existing stream
        if participant_data.video_stream is not None:
            logger.debug(f"Closing existing video stream for {participant_id}")
            await participant_data.video_stream.aclose()
        
        # Create a new stream to receive frames
        participant_data.video_stream = rtc.VideoStream(track)
        participant_data.is_monitoring = True
        
        logger.info(f"Created video stream for {participant_id}, starting monitoring task")
        
        # Start the monitoring task
        task = asyncio.create_task(self._monitor_participant_frames(participant_id))
        task.add_done_callback(lambda t: self._monitoring_tasks.remove(t) if t in self._monitoring_tasks else None)
        self._monitoring_tasks.append(task)
        
        logger.info(f"Successfully created video stream and started monitoring for participant: {participant.name or participant.identity}")

    async def _monitor_participant_frames(self, participant_id: str):
        """Monitor frames from a participant for deep fake detection."""
        if participant_id not in self._participants:
            logger.warning(f"Participant {participant_id} not found in participants dict")
            return
        
        participant_data = self._participants[participant_id]
        if not participant_data.video_stream:
            logger.warning(f"No video stream for participant {participant_id}")
            return
        
        logger.info(f"Starting frame monitoring for participant {participant_id} ({participant_data.participant_name})")
        last_analysis_time = 0
        frame_count = 0
        
        try:
            async for event in participant_data.video_stream:
                if not participant_data.is_monitoring:
                    logger.info(f"Monitoring stopped for participant {participant_id}")
                    break
                
                frame_count += 1
                current_time = time.time()
                participant_data.last_frame_time = current_time
                
                # Log frame reception periodically
                if frame_count % 30 == 0:  # Log every 30 frames
                    logger.debug(f"Received frame {frame_count} from {participant_id} at {current_time}")
                
                # Analyze frames at regular intervals
                if current_time - last_analysis_time >= self._analysis_interval:
                    last_analysis_time = current_time
                    logger.info(f"Analyzing frame {frame_count} for participant {participant_id} ({participant_data.participant_name})")
                    await self._analyze_frame(event.frame, participant_data)
                    
        except Exception as e:
            logger.error(f"Error monitoring frames for participant {participant_id}: {e}")
        finally:
            logger.info(f"Frame monitoring ended for participant {participant_id}. Total frames processed: {frame_count}")
            if participant_data.video_stream:
                await participant_data.video_stream.aclose()

    async def _analyze_frame(self, frame, participant_data: ParticipantData):
        """Analyze a video frame for deep fake detection."""
        try:
            logger.debug(f"Starting frame analysis for {participant_data.participant_name}")
            
            # Check if we should skip analysis due to cooldown
            current_time = time.time()
            if (participant_data.last_detection_time and 
                current_time - participant_data.last_detection_time < self._detection_cooldown):
                logger.debug(f"Skipping analysis for {participant_data.participant_name} due to cooldown")
                return
            
            # Create a message with the frame for analysis
            analysis_message = ChatMessage(
                type="message",
                role="user",
                content=[ImageContent(image=frame)]
            )
            
            # Create chat context
            chat_ctx = ChatContext([analysis_message])
            
            logger.debug(f"Sending frame to LLM for analysis for {participant_data.participant_name}")
            
            # Get analysis from LLM
            response_text = ""
            try:
                async with self.llm.chat(chat_ctx=chat_ctx) as stream:
                    async for chunk in stream:
                        if not chunk:
                            continue
                        content = getattr(chunk.delta, 'content', None) if hasattr(chunk, 'delta') else str(chunk)
                        if content:
                            response_text += content
            except Exception as e:
                logger.error(f"Error getting LLM analysis for {participant_data.participant_name}: {e}")
                response_text = "NO_DETECTION"
            
            response_text = response_text.strip()
            logger.info(f"LLM response for {participant_data.participant_name}: {response_text}")
            
            # # Always send analysis results to chat
            # await self._send_analysis_result(participant_data, response_text)
            
            # Parse the response for detections
            if response_text.startswith("DETECTION:"):
                logger.info(f"Detection found for {participant_data.participant_name}: {response_text}")
                await self._handle_detection(response_text, participant_data, frame)
            elif "NO_DETECTION" not in response_text:
                # If response is unclear, log it for debugging
                logger.debug(f"Unclear analysis response for {participant_data.participant_name}: {response_text}")
                
        except Exception as e:
            logger.error(f"Error analyzing frame for {participant_data.participant_name}, error: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")

    async def _handle_detection(self, response_text: str, participant_data: ParticipantData, frame):
        """Handle a detection result."""
        try:
            # Parse detection type and confidence
            parts = response_text.split()
            if len(parts) < 3:
                return
            
            detection_type = parts[1]  # AI_BOT or DEEP_FAKE
            confidence_str = parts[2]
            
            # Extract confidence level
            confidence = 0.0
            try:
                confidence = float(confidence_str)
            except ValueError:
                # Try to extract number from string like "confidence: 85"
                import re
                match = re.search(r'(\d+(?:\.\d+)?)', confidence_str)
                if match:
                    confidence = float(match.group(1))
            
            logger.info(f"Detection: {detection_type} detected for {participant_data.participant_name} with {confidence}% confidence")

            # # Only report if confidence is high enough
            # if confidence < 70:
            #     return
            
            # Create detection result
            detection = DetectionResult(
                participant_id=participant_data.participant_id,
                participant_name=participant_data.participant_name,
                detection_type=detection_type.lower(),
                confidence=confidence,
                timestamp=datetime.now(),
                details={"response": response_text}
            )
            
            self._detection_results.append(detection)
            participant_data.detection_count += 1
            participant_data.last_detection_time = time.time()
            
            # Send notification
            await self._send_detection_notification(detection)
            
            logger.warning(f"Detection: {detection_type} detected for {participant_data.participant_name} with {confidence}% confidence")
            
        except Exception as e:
            logger.error(f"Error handling detection: {e}")

    async def _send_analysis_result(self, participant_data: ParticipantData, analysis_text: str):
        """Send analysis results to the chat."""
        try:
            logger.debug(f"Sending analysis result to chat for {participant_data.participant_name}")
            room = get_job_context().room
            
            # Create analysis message
            timestamp = datetime.now().strftime('%H:%M:%S')
            analysis_message = (
                f"🔍 **Frame Analysis** - {participant_data.participant_name}\n"
                f"Time: {timestamp}\n"
                f"Result: {analysis_text}"
            )
            
            # Send to chat
            logger.info(f"Sending analysis result to chat: {analysis_message}")
            await room.local_participant.send_text(analysis_message, topic="lk.chat")
            logger.debug(f"Successfully sent analysis result to chat for {participant_data.participant_name}")
            
        except Exception as e:
            logger.error(f"Error sending analysis result: {e}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")

    async def _send_detection_notification(self, detection: DetectionResult):
        """Send a detection notification to the chat."""
        try:
            room = get_job_context().room
            
            # Create notification message
            notification_text = (
                f"🚨 **DETECTION ALERT** 🚨\n"
                f"**{detection.detection_type.upper()}** detected for participant: **{detection.participant_name}**\n"
                f"Confidence: **{detection.confidence:.1f}%**\n"
                f"Time: {detection.timestamp.strftime('%H:%M:%S')}\n"
                f"Detection ID: {len(self._detection_results)}"
            )
            
            # Send to chat
            logger.info(f"detection notification: {notification_text}")
            await room.local_participant.send_text(notification_text, topic="lk.chat")
        except Exception as e:
            logger.error(f"Error sending detection notification: {e}")

    @function_tool
    async def get_detection_stats(self, context: RunContext) -> str:
        """Get statistics about detections made by the agent."""
        total_detections = len(self._detection_results)
        active_participants = len([p for p in self._participants.values() if p.is_monitoring])
        
        if total_detections == 0:
            return f"Monitoring {active_participants} participants. No detections made yet."
        
        # Group by detection type
        ai_bot_count = len([d for d in self._detection_results if d.detection_type == "ai_bot"])
        deep_fake_count = len([d for d in self._detection_results if d.detection_type == "deep_fake"])
        
        # Get recent detections
        recent_detections = self._detection_results[-5:] if len(self._detection_results) >= 5 else self._detection_results
        
        stats = f"""
**Deep Fake Detection Statistics:**
- Total Detections: {total_detections}
- AI Bot Detections: {ai_bot_count}
- Deep Fake Detections: {deep_fake_count}
- Active Participants: {active_participants}

**Recent Detections:**
"""
        
        for detection in recent_detections:
            stats += f"- {detection.detection_type.upper()}: {detection.participant_name} ({detection.confidence:.1f}% confidence)\n"
        
        return stats

    @function_tool
    async def clear_detection_history(self, context: RunContext) -> str:
        """Clear the detection history."""
        count = len(self._detection_results)
        self._detection_results.clear()
        return f"Cleared {count} detection records from history."

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        """Handle user turn completion - add any relevant detection context."""
        # Add recent detection context if any
        recent_detections = [d for d in self._detection_results[-3:] if d.timestamp]
        if recent_detections:
            context = "Recent detections: "
            for detection in recent_detections:
                context += f"{detection.detection_type} for {detection.participant_name} ({detection.confidence:.1f}%), "
            context = context.rstrip(", ")
            new_message.content.append(f"\n\n{context}")

    async def on_exit(self):
        """Clean up when agent exits."""
        # Stop all monitoring tasks - create a copy to avoid modification during iteration
        participants_to_cleanup = list(self._participants.values())
        for participant_data in participants_to_cleanup:
            if participant_data.video_stream:
                await participant_data.video_stream.aclose()
            participant_data.is_monitoring = False
        
        # Clear the participants dictionary
        self._participants.clear()
        
        # Cancel monitoring tasks
        for task in self._monitoring_tasks:
            task.cancel()
        
        logger.info("Deep fake detection agent stopped")

async def entrypoint(ctx: JobContext):
    session = AgentSession()

    await session.start(
        agent=DeepFakeDetectionAgent(),
        room=ctx.room,
        room_output_options=RoomOutputOptions(
            transcription_enabled=False,
            # disable audio output if it's not needed
            audio_enabled=False,
        ),
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
