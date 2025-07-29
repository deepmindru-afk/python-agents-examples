# Deep Fake Detection Agent - Summary

## What Was Created

A silent LiveKit monitoring agent that analyzes video streams in real-time to detect AI bots and deep fakes. The agent operates silently in the background without speaking or responding to voice commands, providing:

### Core Features
- **Real-time Video Monitoring**: Continuously monitors all participants' video streams
- **AI-Powered Detection**: Uses Grok-2-Vision model to analyze frames for synthetic content
- **Chat Notifications**: Sends formatted alerts to the room chat when detections are made
- **RPC Integration**: Provides detection alerts via RPC for client-side integration
- **Detection Statistics**: Tracks and reports detection statistics
- **Cooldown System**: Prevents spam with configurable detection cooldowns
- **Silent Operation**: Operates silently in the background without speaking or responding to voice commands

### Detection Capabilities
The agent looks for various indicators of AI-generated or deep fake content:
- Unnatural facial movements or expressions
- Inconsistent lighting or shadows
- Digital artifacts around the face or body
- Unrealistic skin texture or features
- Audio-video synchronization issues
- Repetitive or mechanical behaviors

## Files Created

1. **`agent.py`** - Main agent implementation
2. **`README.md`** - Comprehensive documentation
3. **`requirements.txt`** - Python dependencies
4. **`test_agent.py`** - Test script to verify functionality
5. **`example_usage.py`** - Usage examples and demonstrations

## Key Components

### Data Classes
- **`DetectionResult`**: Stores detection results with metadata
- **`ParticipantData`**: Tracks monitoring state for each participant

### Agent Features
- **Video Stream Management**: Handles video track subscriptions and frame processing
- **Frame Analysis**: Uses Grok-2-Vision to analyze video frames every 2 seconds
- **Notification System**: Sends alerts via chat and RPC
- **Function Tools**: Provides `get_detection_stats()` and `clear_detection_history()`

## Configuration

### Environment Variables Required
```env
OPENAI_API_KEY=your_openai_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

### Configurable Parameters
- **Analysis Interval**: 2.0 seconds (how often to analyze frames)
- **Detection Cooldown**: 30.0 seconds (prevent spam for same participant)
- **Confidence Threshold**: 70% (minimum confidence to report detection)

## Usage

### Running the Agent
```bash
# Console mode
python3 agent.py console

# Deploy to LiveKit Cloud
python3 agent.py deploy
```

### Testing
```bash
# Run tests
python3 test_agent.py

# Run examples
python3 example_usage.py
```

## Detection Alerts

When the agent detects suspicious content, it sends formatted alerts:

```
🚨 **DETECTION ALERT** 🚨
**DEEP_FAKE** detected for participant: **John Doe**
Confidence: **85.2%**
Time: 14:30:25
Detection ID: 3
```

## RPC Integration

The agent sends detection alerts via RPC using the method `client.detection_alert`:

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

## Demo Frontend Integration

The agent has been added to the demo frontend configuration and will appear as:
- **Name**: Deep Fake Detector
- **Description**: Monitor video streams for AI bots and deep fake detection
- **Tags**: Vision, Monitoring, Security
- **Capabilities**: Supports video input and screen share (silent monitoring only)

## Architecture

### Event Handling
- **participant_connected**: Starts monitoring new participants
- **participant_disconnected**: Stops monitoring disconnected participants
- **track_subscribed**: Creates video streams for new video tracks

### Monitoring Flow
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

## Next Steps

1. **Set up environment variables** in `.env` file
2. **Test the agent** with `python3 test_agent.py`
3. **Run examples** with `python3 example_usage.py`
4. **Deploy to LiveKit Cloud** or run locally
5. **Integrate with your application** using the RPC methods

## Extending the Agent

To extend the detection capabilities:
1. Modify the analysis prompt in `_analyze_frame()`
2. Add new detection types in `_handle_detection()`
3. Implement additional analysis methods
4. Add new function tools for enhanced interaction

The agent is now ready for use and provides a solid foundation for deep fake detection in LiveKit rooms! 