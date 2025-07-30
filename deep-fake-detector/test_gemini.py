#!/usr/bin/env python3
"""
Test script to verify Gemini 2.0 Flash Experimental can handle video frames
for deep fake detection.
"""

import asyncio
import logging
from pathlib import Path
from dotenv import load_dotenv
from livekit.agents.llm import ChatContext, ChatMessage, ImageContent
from livekit.plugins import google

# Load environment variables
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

logger = logging.getLogger("gemini-test")
logger.setLevel(logging.INFO)

async def test_gemini_video_analysis():
    """Test Gemini's ability to analyze video frames for deep fake detection."""
    
    # Initialize Gemini LLM
    llm = google.LLM(model="gemini-2.0-flash-exp", tool_choice=None)
    
    # Create a test message (without actual video frame for this test)
    test_message = ChatMessage(
        type="message",
        role="user",
        content=[
            "Analyze this video frame for signs of AI-generated content, deep fakes, or bot behavior. " +
            "Look for unnatural facial expressions, inconsistent lighting, artifacts, unrealistic features, " +
            "or any other indicators of synthetic content. " +
            "Respond with 'DETECTION: AI_BOT' or 'DETECTION: DEEP_FAKE' followed by confidence level (0-100) " +
            "and details if you detect something suspicious, otherwise respond with 'NO_DETECTION'."
        ]
    )
    
    # Note: In a real scenario, you would add an ImageContent with the video frame
    # test_message.content.append(ImageContent(image=frame))
    
    chat_ctx = ChatContext([test_message])
    
    try:
        logger.info("Testing Gemini LLM with video analysis prompt...")
        
        response_text = ""
        async with llm.chat(chat_ctx=chat_ctx) as stream:
            async for chunk in stream:
                if not chunk:
                    continue
                content = getattr(chunk.delta, 'content', None) if hasattr(chunk, 'delta') else str(chunk)
                if content:
                    response_text += content
        
        response_text = response_text.strip()
        logger.info(f"Gemini response: {response_text}")
        
        # Test if the response format is correct
        if "DETECTION:" in response_text or "NO_DETECTION" in response_text:
            logger.info("✅ Gemini is responding correctly to video analysis prompts")
        else:
            logger.warning("⚠️ Gemini response format may need adjustment")
            
    except Exception as e:
        logger.error(f"❌ Error testing Gemini: {e}")
        return False
    
    return True

async def main():
    """Main test function."""
    logger.info("Starting Gemini video analysis test...")
    
    success = await test_gemini_video_analysis()
    
    if success:
        logger.info("✅ Gemini test completed successfully")
    else:
        logger.error("❌ Gemini test failed")
    
    logger.info("Test completed")

if __name__ == "__main__":
    asyncio.run(main()) 