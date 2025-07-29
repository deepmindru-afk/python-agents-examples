#!/usr/bin/env python3
"""
Test script for the Deep Fake Detection Agent
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

async def test_agent_initialization():
    """Test that the agent can be initialized without errors."""
    try:
        from agent import DeepFakeDetectionAgent
        
        # Create agent instance
        agent = DeepFakeDetectionAgent()
        logger.info("✅ Agent initialized successfully")
        
        # Test function tools
        tools = agent.get_function_tools()
        logger.info(f"✅ Found {len(tools)} function tools:")
        for tool in tools:
            logger.info(f"  - {tool.name}: {tool.description}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to initialize agent: {e}")
        return False

async def test_detection_result_creation():
    """Test that DetectionResult objects can be created."""
    try:
        from agent import DetectionResult
        from datetime import datetime
        
        # Create a test detection result
        detection = DetectionResult(
            participant_id="test_user_123",
            participant_name="Test User",
            detection_type="deep_fake",
            confidence=85.5,
            timestamp=datetime.now(),
            details={"test": "data"}
        )
        
        logger.info("✅ DetectionResult created successfully")
        logger.info(f"  - Participant: {detection.participant_name}")
        logger.info(f"  - Type: {detection.detection_type}")
        logger.info(f"  - Confidence: {detection.confidence}%")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create DetectionResult: {e}")
        return False

async def test_participant_data_creation():
    """Test that ParticipantData objects can be created."""
    try:
        from agent import ParticipantData
        
        # Create a test participant data
        participant_data = ParticipantData(
            participant_id="test_user_123",
            participant_name="Test User"
        )
        
        logger.info("✅ ParticipantData created successfully")
        logger.info(f"  - ID: {participant_data.participant_id}")
        logger.info(f"  - Name: {participant_data.participant_name}")
        logger.info(f"  - Monitoring: {participant_data.is_monitoring}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to create ParticipantData: {e}")
        return False

async def test_imports():
    """Test that all required imports work."""
    try:
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
        
        logger.info("✅ All imports successful")
        return True
        
    except ImportError as e:
        logger.error(f"❌ Import failed: {e}")
        return False

async def main():
    """Run all tests."""
    logger.info("🧪 Starting Deep Fake Detection Agent tests...")
    
    tests = [
        ("Import Test", test_imports),
        ("Agent Initialization", test_agent_initialization),
        ("DetectionResult Creation", test_detection_result_creation),
        ("ParticipantData Creation", test_participant_data_creation),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        logger.info(f"\n🔍 Running {test_name}...")
        try:
            result = await test_func()
            if result:
                passed += 1
                logger.info(f"✅ {test_name} passed")
            else:
                logger.error(f"❌ {test_name} failed")
        except Exception as e:
            logger.error(f"❌ {test_name} failed with exception: {e}")
    
    logger.info(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        logger.info("🎉 All tests passed! The agent is ready to use.")
        return True
    else:
        logger.error("❌ Some tests failed. Please check the errors above.")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1) 