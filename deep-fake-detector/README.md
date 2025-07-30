# Deep Fake Detection Agent

A silent LiveKit monitoring agent that analyzes video streams in real-time to detect AI bots and deep fakes, sending alerts to the chat when suspicious content is identified. The agent operates silently in the background without speaking or responding to voice commands.

## Features

- **Real-time Video Monitoring**: Continuously monitors video streams from all participants
- **AI-Powered Detection**: Uses Gemini 2.0 Flash Experimental model to analyze frames for signs of synthetic content
- **Chat Notifications**: Sends formatted alerts to the room chat when detections are made
- **RPC Communication**: Provides detection alerts via RPC for client-side integration
- **Detection Statistics**: Tracks and reports detection statistics
- **Cooldown System**: Prevents spam by implementing detection cooldowns
- **Multi-Participant Support**: Monitors all participants in the room simultaneously
- **Silent Operation**: Operates silently in the background without speaking or responding to voice commands

## Detection Capabilities

The agent looks for various indicators of AI-generated or deep fake content:

- **Unnatural Facial Movements**: Mechanical or unrealistic expressions
- **Lighting Inconsistencies**: Shadows that don't match the lighting setup
- **Digital Artifacts**: Compression artifacts, glitches, or synthetic textures
- **Unrealistic Features**: Perfect skin, unnatural proportions, or synthetic details
- **Audio-Video Sync Issues**: Mismatches between lip movements and speech
- **Repetitive Behaviors**: Mechanical or pattern-based movements

## Installation

1. Ensure you have the required dependencies:
```bash
pip install livekit-agents[google,silero,deepgram,rime]
```

2. Set up your environment variables in `.env`:
```env
GOOGLE_API_KEY=your_google_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

## Usage

### Running the Agent

```bash
python agent.py console
```

Or deploy to LiveKit Cloud:

```bash
python agent.py deploy
```

**Note**: The agent operates silently in the background. It will not speak or respond to voice commands, only send detection alerts via chat messages and RPC notifications.

### Function Tools

The agent provides several function tools for interaction:

#### Get Detection Statistics
```python
await agent.get_detection_stats()
```
Returns current detection statistics including:
- Total detections
- AI bot vs deep fake breakdown
- Active participants being monitored
- Recent detection history

#### Clear Detection History
```python
await agent.clear_detection_history()
```
Clears all stored detection records.

### Detection Alerts

When the agent detects suspicious content, it sends formatted alerts to the chat:

```
🚨 **DETECTION ALERT** 🚨
**DEEP_FAKE** detected for participant: **John Doe**
Confidence: **85.2%**
Time: 14:30:25
Detection ID: 3
```

### RPC Integration

The agent also sends detection alerts via RPC using the method `client.detection_alert` with the following payload:

```json
{
  "type": "detection",
  "detection_type": "deep_fake",
  "participant_name": "John Doe",
  "confidence": 85.2,
  "timestamp": "2024-01-15T14:30:25.123456",
  "detection_id": 3
}
```

## Configuration

### Analysis Interval
The agent analyzes video frames every 2 seconds by default. This can be adjusted by modifying:
```python
self._analysis_interval = 2.0  # seconds
```

### Detection Cooldown
To prevent spam, the agent implements a 30-second cooldown between detections for the same participant:
```python
self._detection_cooldown = 30.0  # seconds
```

### Confidence Threshold
Only detections with 70% or higher confidence are reported:
```python
if confidence < 70:
    return
```

## Architecture

### Key Components

1. **ParticipantData**: Tracks monitoring state for each participant
2. **DetectionResult**: Stores detection results with metadata
3. **Video Stream Management**: Handles video track subscriptions and frame processing
4. **Frame Analysis**: Uses Grok-2-Vision to analyze video frames
5. **Notification System**: Sends alerts via chat and RPC

### Event Handling

- **participant_connected**: Starts monitoring new participants
- **participant_disconnected**: Stops monitoring disconnected participants
- **track_subscribed**: Creates video streams for new video tracks

## Monitoring Flow

1. Agent joins room and starts monitoring existing participants
2. For each participant with video:
   - Creates video stream to receive frames
   - Starts background task to monitor frames
   - Analyzes frames at regular intervals
3. When suspicious content is detected:
   - Parses detection type and confidence
   - Creates detection record
   - Sends notification to chat
   - Sends RPC alert to clients
4. Continues monitoring until agent exits

## Security Considerations

- **False Positives**: The agent may occasionally flag legitimate content as suspicious
- **Privacy**: Video frames are processed for analysis but not stored
- **Rate Limiting**: Built-in cooldowns prevent excessive notifications
- **Confidence Thresholds**: Only high-confidence detections are reported

## Troubleshooting

### Common Issues

1. **No Video Streams**: Ensure participants have enabled their cameras
2. **No Detections**: Check that the confidence threshold isn't too high
3. **Excessive Detections**: Adjust the cooldown period or confidence threshold
4. **RPC Errors**: Verify client-side RPC method registration

### Logging

The agent provides detailed logging at INFO level. Key log messages:
- Participant monitoring start/stop
- Video stream creation
- Detection events
- Error conditions

## Example Integration

```python
# Client-side RPC handler
async def handle_detection_alert(payload):
    detection_data = json.loads(payload)
    print(f"Detection: {detection_data['detection_type']} for {detection_data['participant_name']}")
    # Handle detection alert in your UI
```

## Contributing

To extend the detection capabilities:

1. Modify the analysis prompt in `_analyze_frame()`
2. Add new detection types in `_handle_detection()`
3. Implement additional analysis methods
4. Add new function tools for enhanced interaction

## License

This agent is part of the LiveKit Python Agents Examples and follows the same licensing terms. 