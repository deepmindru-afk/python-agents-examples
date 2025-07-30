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
        self._confidence_threshold = 90.0  # Minimum confidence to report detections
        
        logger.info(f"Agent configuration: analysis_interval={self._analysis_interval}s, detection_cooldown={self._detection_cooldown}s, confidence_threshold={self._confidence_threshold}%")
        
        super().__init__(
            instructions="""
                You are a security monitoring system designed to detect AI-generated content and deep fakes in video streams. This is for legitimate security purposes to protect against fraud and misinformation.
                
                You will receive video frames from participants and analyze them for signs of AI-generated content, deep fakes, or bot behavior.
                
                CRITICAL: Be extremely conservative. 99% of webcam video should be classified as legitimate. Only flag content if you are 90%+ confident it shows definitive signs of AI generation or deep fake technology.
                
                Response format: 
                - For detections: 'DETECTION: AI_BOT' or 'DETECTION: DEEP_FAKE' followed by 'Confidence: [0-100]' and details
                - For no detection: 'NO_DETECTION'
                
                ONLY detect deep fakes if you see CLEAR and DEFINITIVE evidence of:
                - Multiple faces or obvious face swapping with visible seams
                - Facial movements that completely don't match speech (lip sync completely off)
                - Obvious AI-generated features that are clearly not human (extra eyes, distorted features)
                - Severe synchronization issues between audio and video
                - Clear signs of face manipulation with obvious artifacts
                
                NEVER flag as deep fakes (these are normal webcam characteristics):
                - Any color variations (red hue, blue tint, etc.) - normal in webcams
                - Pixelation or compression artifacts - very common in webcam video
                - Smooth skin texture - many people have good skin
                - Lighting inconsistencies - normal in webcam environments
                - Minor video quality issues - standard for webcams
                - Natural variations in skin texture
                - Normal webcam compression or quality limitations
                - Any artifacts around face edges - common in webcam compression
                - Inconsistent lighting with environment - normal webcam behavior
                - Any "unnatural" colors or lighting - webcams often have color issues
                
                REMEMBER: Webcams have poor quality, compression artifacts, color issues, and lighting problems. These are NORMAL and should NEVER be flagged as deep fakes.
                
                When in doubt, classify as NO_DETECTION. It's better to miss a potential deep fake than to incorrectly flag legitimate users.
                
                This analysis is for security monitoring purposes only.
            """,
            llm=google.LLM(model="gemini-2.5-flash-lite"),
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
            
            # Validate frame
            if frame is None:
                logger.warning(f"Received None frame for {participant_data.participant_name}, skipping analysis")
                return
            
            # Check if we should skip analysis due to cooldown
            current_time = time.time()
            if (participant_data.last_detection_time and 
                current_time - participant_data.last_detection_time < self._detection_cooldown):
                logger.debug(f"Skipping analysis for {participant_data.participant_name} due to cooldown")
                return
            
            # Create a message with the frame for analysis and instructions
            try:
                image_content = ImageContent(image=frame)
                analysis_message = ChatMessage(
                    type="message",
                    role="user",
                    content=["Analyze this video frame for deep fake detection. Be conservative but thorough - flag if you are 90%+ confident of AI/deep fake signs. Respond with 'DETECTION: AI_BOT' or 'DETECTION: DEEP_FAKE' followed by 'Confidence: [0-100]' and details, or 'NO_DETECTION'.", image_content]
                )
                logger.debug(f"Successfully created analysis message for {participant_data.participant_name}")
            except Exception as e:
                logger.error(f"Error creating analysis message for {participant_data.participant_name}: {e}")
                return
            
            # Create chat context with just the user message
            try:
                chat_ctx = ChatContext([analysis_message])
                logger.debug(f"Successfully created chat context for {participant_data.participant_name}")
            except Exception as e:
                logger.error(f"Error creating chat context for {participant_data.participant_name}: {e}")
                return
            
            logger.debug(f"Sending frame to LLM for analysis for {participant_data.participant_name}")
            
            # Debug: Log chat context details
            logger.debug(f"Chat context created successfully for {participant_data.participant_name}")
            logger.debug(f"Analysis message: role={analysis_message.role}, type={analysis_message.type}")
            
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
            
            # Parse the response for detections
            if response_text.startswith("DETECTION:"):
                logger.info(f"Detection found for {participant_data.participant_name}: {response_text}")
                await self._handle_detection(response_text, participant_data, frame)
            elif "NO_DETECTION" in response_text:
                logger.debug(f"No detection for {participant_data.participant_name}")
            else:
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
            if not response_text.startswith("DETECTION:"):
                return
            
            # Extract detection type (AI_BOT or DEEP_FAKE)
            if "DETECTION: AI_BOT" in response_text:
                detection_type = "AI_BOT"
            elif "DETECTION: DEEP_FAKE" in response_text:
                detection_type = "DEEP_FAKE"
            else:
                return
            
            # Extract confidence level using regex
            import re
            confidence_match = re.search(r'Confidence:\s*(\d+(?:\.\d+)?)', response_text)
            if not confidence_match:
                logger.warning(f"Could not extract confidence from response: {response_text}")
                return
            
            confidence = float(confidence_match.group(1))
            
            logger.info(f"Detection: {detection_type} detected for {participant_data.participant_name} with {confidence}% confidence")

            # Only report if confidence is high enough (reduce false positives)
            if confidence < self._confidence_threshold:
                logger.info(f"Skipping detection for {participant_data.participant_name} due to low confidence ({confidence}%)")
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
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")

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
    async def show_recent_analyses(self, context: RunContext) -> str:
        """Show recent analysis results (last 10) to help with debugging."""
        if not self._detection_results:
            return "No detection results available yet."
        
        recent = self._detection_results[-10:] if len(self._detection_results) >= 10 else self._detection_results
        
        result = "**Recent Detection Results:**\n"
        for i, detection in enumerate(recent, 1):
            result += f"{i}. **{detection.detection_type.upper()}** - {detection.participant_name}\n"
            result += f"   Confidence: {detection.confidence:.1f}% | Time: {detection.timestamp.strftime('%H:%M:%S')}\n"
            result += f"   Details: {detection.details.get('response', 'N/A')[:100]}...\n\n"
        
        return result

    @function_tool
    async def set_confidence_threshold(self, threshold: float, context: RunContext) -> str:
        """Temporarily adjust the confidence threshold for testing (0-100)."""
        if threshold < 0 or threshold > 100:
            return "Error: Confidence threshold must be between 0 and 100"
        
        # Store the original threshold in case we want to restore it
        if not hasattr(self, '_original_confidence_threshold'):
            self._original_confidence_threshold = 70.0
        
        # Update the threshold in the detection logic
        self._confidence_threshold = threshold
        
        return f"Confidence threshold set to {threshold}%. Detections below this threshold will be ignored."

    @function_tool
    async def enable_testing_mode(self, context: RunContext) -> str:
        """Enable testing mode with lower confidence threshold (50%) for testing deep fake detection. WARNING: May cause false positives."""
        self._confidence_threshold = 50.0
        return "Testing mode enabled with 50% confidence threshold. WARNING: This may cause false positives on normal webcam video. Use 'set_confidence_threshold 80' to return to normal mode."

    @function_tool
    async def get_detection_settings(self, context: RunContext) -> str:
        """Get current detection settings and thresholds."""
        settings = f"""
**Deep Fake Detection Settings:**
- Analysis Interval: {self._analysis_interval} seconds
- Detection Cooldown: {self._detection_cooldown} seconds
- Confidence Threshold: {self._confidence_threshold}% (detections below this are ignored)
- Active Participants: {len([p for p in self._participants.values() if p.is_monitoring])}
- Total Monitoring Tasks: {len(self._monitoring_tasks)}

**Detection Approach:**
- Conservative analysis - only flag clear AI/deep fake signs
- Normal webcam quality issues are ignored
- Requires {self._confidence_threshold}%+ confidence for reporting
"""
        return settings

    @function_tool
    async def clear_detection_history(self, context: RunContext) -> str:
        """Clear the detection history."""
        count = len(self._detection_results)
        self._detection_results.clear()
        return f"Cleared {count} detection records from history."

    @function_tool
    async def analyze_last_detection(self, context: RunContext) -> str:
        """Analyze the last detection and explain why it was flagged."""
        if not self._detection_results:
            return "No detections have been made yet."
        
        last_detection = self._detection_results[-1]
        analysis = f"""
**Last Detection Analysis:**
- Participant: {last_detection.participant_name}
- Type: {last_detection.detection_type.upper()}
- Confidence: {last_detection.confidence:.1f}%
- Time: {last_detection.timestamp.strftime('%H:%M:%S')}
- Threshold: {self._confidence_threshold}%

**LLM Response:**
{last_detection.details.get('response', 'No response details available')}

**Analysis:**
This detection was made because the confidence ({last_detection.confidence:.1f}%) exceeded the current threshold ({self._confidence_threshold}%).
"""
        return analysis

    @function_tool
    async def test_threshold_sensitivity(self, context: RunContext) -> str:
        """Show what detections would have been made with different confidence thresholds."""
        if not self._detection_results:
            return "No detections have been made yet."
        
        thresholds = [50, 60, 70, 80, 90, 95]
        result = "**Threshold Sensitivity Analysis:**\n\n"
        
        for threshold in thresholds:
            detections_above = [d for d in self._detection_results if d.confidence >= threshold]
            result += f"**{threshold}% threshold**: {len(detections_above)} detections\n"
            
            if detections_above:
                for detection in detections_above[-3:]:  # Show last 3
                    result += f"  - {detection.detection_type.upper()}: {detection.participant_name} ({detection.confidence:.1f}%)\n"
            result += "\n"
        
        result += f"**Current threshold**: {self._confidence_threshold}%\n"
        result += f"**Total detections made**: {len(self._detection_results)}"
        
        return result

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
            # the agent is silent, so we don't need to transcribe or audio
            transcription_enabled=False,
            audio_enabled=False,
        ),
    )

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
