"""
---
title: Deep Fake Detection Agent
category: monitoring
tags: [vision, deep-fake, ai-detection, monitoring, openai, deepgram]
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
from livekit.agents import JobContext, WorkerOptions, cli, get_job_context
from livekit.agents.llm import function_tool, ImageContent, ChatContext, ChatMessage
from livekit.agents.voice import Agent, AgentSession, RunContext
from livekit.plugins import deepgram, openai, silero, rime

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
        self._participants: Dict[str, ParticipantData] = {}
        self._detection_results: list[DetectionResult] = []
        self._monitoring_tasks: list[asyncio.Task] = []
        self._analysis_interval = 2.0  # Analyze frames every 2 seconds
        self._detection_cooldown = 30.0  # Don't report same participant for 30 seconds
        
        super().__init__(
            instructions="""
                You are a deep fake detection agent that monitors video streams for AI bots and deep fakes.
                You can see video frames from participants and analyze them for signs of AI-generated content.
                When you detect potential AI bots or deep fakes, you will send notifications to the chat.
                
                Focus on detecting:
                - Unnatural facial movements or expressions
                - Inconsistent lighting or shadows
                - Artifacts around the face or body
                - Unrealistic skin texture or features
                - Synchronization issues between audio and video
                - Repetitive or mechanical behaviors
                
                Be cautious and only report when you have high confidence in your detection.
            """,
            stt=deepgram.STT(),
            llm=openai.LLM.with_x_ai(model="grok-2-vision", tool_choice=None),
            tts=rime.TTS(),
            vad=silero.VAD.load()
        )

    async def on_enter(self):
        """Initialize monitoring when agent enters the room."""
        room = get_job_context().room
        
        # Monitor existing participants
        for participant_id, participant in room.remote_participants.items():
            await self._start_monitoring_participant(participant)
        
        # Watch for new participants
        @room.on("participant_connected")
        async def on_participant_connected(participant: rtc.RemoteParticipant):
            await self._start_monitoring_participant(participant)
        
        # Watch for participant disconnections
        @room.on("participant_disconnected")
        async def on_participant_disconnected(participant: rtc.RemoteParticipant):
            await self._stop_monitoring_participant(participant.identity)
        
        # Watch for new video tracks
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                self._create_video_stream(track, participant)

    async def _start_monitoring_participant(self, participant: rtc.RemoteParticipant):
        """Start monitoring a new participant."""
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
        if video_tracks:
            self._create_video_stream(video_tracks[0], participant)
        
        logger.info(f"Started monitoring participant: {participant.name or participant.identity}")

    async def _stop_monitoring_participant(self, participant_id: str):
        """Stop monitoring a participant."""
        if participant_id in self._participants:
            participant_data = self._participants[participant_id]
            if participant_data.video_stream:
                participant_data.video_stream.close()
            participant_data.is_monitoring = False
            del self._participants[participant_id]
            logger.info(f"Stopped monitoring participant: {participant_id}")

    def _create_video_stream(self, track: rtc.Track, participant: rtc.RemoteParticipant):
        """Create a video stream for monitoring."""
        participant_id = participant.identity
        if participant_id not in self._participants:
            return
        
        participant_data = self._participants[participant_id]
        
        # Close any existing stream
        if participant_data.video_stream is not None:
            participant_data.video_stream.close()
        
        # Create a new stream to receive frames
        participant_data.video_stream = rtc.VideoStream(track)
        participant_data.is_monitoring = True
        
        # Start the monitoring task
        task = asyncio.create_task(self._monitor_participant_frames(participant_id))
        task.add_done_callback(lambda t: self._monitoring_tasks.remove(t) if t in self._monitoring_tasks else None)
        self._monitoring_tasks.append(task)
        
        logger.info(f"Created video stream for participant: {participant.name or participant.identity}")

    async def _monitor_participant_frames(self, participant_id: str):
        """Monitor frames from a participant for deep fake detection."""
        if participant_id not in self._participants:
            return
        
        participant_data = self._participants[participant_id]
        if not participant_data.video_stream:
            return
        
        last_analysis_time = 0
        
        try:
            async for event in participant_data.video_stream:
                if not participant_data.is_monitoring:
                    break
                
                current_time = time.time()
                participant_data.last_frame_time = current_time
                
                # Analyze frames at regular intervals
                if current_time - last_analysis_time >= self._analysis_interval:
                    last_analysis_time = current_time
                    await self._analyze_frame(event.frame, participant_data)
                    
        except Exception as e:
            logger.error(f"Error monitoring frames for participant {participant_id}: {e}")
        finally:
            if participant_data.video_stream:
                participant_data.video_stream.close()

    async def _analyze_frame(self, frame, participant_data: ParticipantData):
        """Analyze a video frame for deep fake detection."""
        try:
            # Check if we should skip analysis due to cooldown
            current_time = time.time()
            if (participant_data.last_detection_time and 
                current_time - participant_data.last_detection_time < self._detection_cooldown):
                return
            
            # Create a message with the frame for analysis
            analysis_message = ChatMessage(
                type="message",
                role="user",
                content=[
                    "Analyze this video frame for signs of AI-generated content, deep fakes, or bot behavior. " +
                    "Look for unnatural facial movements, inconsistent lighting, artifacts, unrealistic features, " +
                    "or any other indicators of synthetic content. " +
                    "Respond with 'DETECTION: AI_BOT' or 'DETECTION: DEEP_FAKE' followed by confidence level (0-100) " +
                    "and details if you detect something suspicious, otherwise respond with 'NO_DETECTION'."
                ]
            )
            analysis_message.content.append(ImageContent(image=frame))
            
            # Get analysis from LLM
            response = await self.llm.chat([analysis_message])
            response_text = response.content[0].text.strip()
            
            # Parse the response
            if response_text.startswith("DETECTION:"):
                await self._handle_detection(response_text, participant_data, frame)
            elif "NO_DETECTION" not in response_text:
                # If response is unclear, log it for debugging
                logger.debug(f"Unclear analysis response for {participant_data.participant_name}: {response_text}")
                
        except Exception as e:
            logger.error(f"Error analyzing frame for {participant_data.participant_name}: {e}")

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
            
            # Only report if confidence is high enough
            if confidence < 70:
                return
            
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
            await room.local_participant.send_chat_message(notification_text)
            
            # Also send via RPC to any connected clients
            for participant in room.remote_participants.values():
                try:
                    await room.local_participant.perform_rpc(
                        destination_identity=participant.identity,
                        method="client.detection_alert",
                        payload=json.dumps({
                            "type": "detection",
                            "detection_type": detection.detection_type,
                            "participant_name": detection.participant_name,
                            "confidence": detection.confidence,
                            "timestamp": detection.timestamp.isoformat(),
                            "detection_id": len(self._detection_results)
                        })
                    )
                except Exception as e:
                    logger.error(f"Error sending RPC notification to {participant.identity}: {e}")
                    
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
        # Stop all monitoring tasks
        for participant_data in self._participants.values():
            if participant_data.video_stream:
                participant_data.video_stream.close()
            participant_data.is_monitoring = False
        
        # Cancel monitoring tasks
        for task in self._monitoring_tasks:
            task.cancel()
        
        logger.info("Deep fake detection agent stopped")

async def entrypoint(ctx: JobContext):
    session = AgentSession()

    await session.start(
        agent=DeepFakeDetectionAgent(),
        room=ctx.room
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
