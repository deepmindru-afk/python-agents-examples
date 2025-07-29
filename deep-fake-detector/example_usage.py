#!/usr/bin/env python3
"""
Example usage of the Deep Fake Detection Agent

This script demonstrates how to use the agent in different scenarios.
"""

import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def example_basic_usage():
    """Example of basic agent usage."""
    logger.info("🔍 Example: Basic Agent Usage")
    
    try:
        from agent import DeepFakeDetectionAgent
        
        # Create agent instance
        agent = DeepFakeDetectionAgent()
        logger.info("✅ Agent created successfully")
        
        # Show available function tools
        tools = agent.get_function_tools()
        logger.info(f"📋 Available function tools ({len(tools)}):")
        for tool in tools:
            logger.info(f"  - {tool.name}: {tool.description}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

async def example_detection_result():
    """Example of creating and using detection results."""
    logger.info("🔍 Example: Detection Result Creation")
    
    try:
        from agent import DetectionResult
        from datetime import datetime
        
        # Create a sample detection
        detection = DetectionResult(
            participant_id="user_123",
            participant_name="John Doe",
            detection_type="deep_fake",
            confidence=87.5,
            timestamp=datetime.now(),
            details={
                "artifacts": "Unnatural facial movements detected",
                "lighting": "Inconsistent shadows around face",
                "confidence_factors": ["facial_artifacts", "lighting_inconsistency"]
            }
        )
        
        logger.info("✅ Detection result created:")
        logger.info(f"  - Participant: {detection.participant_name}")
        logger.info(f"  - Type: {detection.detection_type}")
        logger.info(f"  - Confidence: {detection.confidence}%")
        logger.info(f"  - Details: {detection.details}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

async def example_participant_monitoring():
    """Example of participant monitoring setup."""
    logger.info("🔍 Example: Participant Monitoring Setup")
    
    try:
        from agent import ParticipantData
        
        # Create participant data for monitoring
        participant = ParticipantData(
            participant_id="user_456",
            participant_name="Jane Smith"
        )
        
        logger.info("✅ Participant data created:")
        logger.info(f"  - ID: {participant.participant_id}")
        logger.info(f"  - Name: {participant.participant_name}")
        logger.info(f"  - Monitoring: {participant.is_monitoring}")
        logger.info(f"  - Detection Count: {participant.detection_count}")
        
        # Simulate starting monitoring
        participant.is_monitoring = True
        participant.detection_count = 2
        participant.last_detection_time = 1234567890.0
        
        logger.info("✅ Monitoring started:")
        logger.info(f"  - Monitoring: {participant.is_monitoring}")
        logger.info(f"  - Detection Count: {participant.detection_count}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

async def example_notification_format():
    """Example of notification message formatting."""
    logger.info("🔍 Example: Notification Message Format")
    
    try:
        from agent import DetectionResult
        from datetime import datetime
        
        # Create a sample detection
        detection = DetectionResult(
            participant_id="user_789",
            participant_name="Alice Johnson",
            detection_type="ai_bot",
            confidence=92.3,
            timestamp=datetime.now()
        )
        
        # Format notification message (as the agent would)
        notification_text = (
            f"🚨 **DETECTION ALERT** 🚨\n"
            f"**{detection.detection_type.upper()}** detected for participant: **{detection.participant_name}**\n"
            f"Confidence: **{detection.confidence:.1f}%**\n"
            f"Time: {detection.timestamp.strftime('%H:%M:%S')}\n"
            f"Detection ID: 1"
        )
        
        logger.info("✅ Notification message formatted:")
        logger.info("---")
        logger.info(notification_text)
        logger.info("---")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

async def example_rpc_payload():
    """Example of RPC payload format."""
    logger.info("🔍 Example: RPC Payload Format")
    
    try:
        import json
        from agent import DetectionResult
        from datetime import datetime
        
        # Create a sample detection
        detection = DetectionResult(
            participant_id="user_101",
            participant_name="Bob Wilson",
            detection_type="deep_fake",
            confidence=78.9,
            timestamp=datetime.now()
        )
        
        # Create RPC payload (as the agent would)
        rpc_payload = {
            "type": "detection",
            "detection_type": detection.detection_type,
            "participant_name": detection.participant_name,
            "confidence": detection.confidence,
            "timestamp": detection.timestamp.isoformat(),
            "detection_id": 2
        }
        
        logger.info("✅ RPC payload created:")
        logger.info(json.dumps(rpc_payload, indent=2))
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        return False

async def main():
    """Run all examples."""
    logger.info("🚀 Deep Fake Detection Agent - Usage Examples")
    logger.info("=" * 50)
    
    examples = [
        ("Basic Agent Usage", example_basic_usage),
        ("Detection Result Creation", example_detection_result),
        ("Participant Monitoring Setup", example_participant_monitoring),
        ("Notification Message Format", example_notification_format),
        ("RPC Payload Format", example_rpc_payload),
    ]
    
    passed = 0
    total = len(examples)
    
    for example_name, example_func in examples:
        logger.info(f"\n📝 Running: {example_name}")
        logger.info("-" * 30)
        try:
            result = await example_func()
            if result:
                passed += 1
                logger.info(f"✅ {example_name} completed successfully")
            else:
                logger.error(f"❌ {example_name} failed")
        except Exception as e:
            logger.error(f"❌ {example_name} failed with exception: {e}")
    
    logger.info(f"\n📊 Example Results: {passed}/{total} examples completed successfully")
    
    if passed == total:
        logger.info("🎉 All examples completed successfully!")
        logger.info("\n💡 Next Steps:")
        logger.info("1. Set up your environment variables in .env")
        logger.info("2. Run the agent with: python3 agent.py console")
        logger.info("3. Or deploy to LiveKit Cloud with: python3 agent.py deploy")
    else:
        logger.error("❌ Some examples failed. Please check the errors above.")
    
    return passed == total

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1) 