import openai
import logging
import redis
import time
import io
from base64 import b64encode
from typing import Tuple
import uuid
from datetime import timedelta
import os
from openai import AsyncOpenAI

class TextToSpeech:
    def __init__(self, client: AsyncOpenAI, model="tts-1", voice="alloy"):
        self.client = client
        self.model = model
        self.voice = voice
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'redis'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            username=os.getenv('REDIS_USERNAME', 'default'),
            password=os.getenv('REDIS_PASSWORD', ''),
            decode_responses=False
        )

    async def generate_speech(self, text: str) -> bytes:
        if len(text) > 4096:
            raise ValueError("Text length exceeds 4096 character limit")
        try:
            response = await self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                input=text
            )
            
            # Get the binary audio data
            audio_data = response.content
            if not audio_data:
                raise ValueError("Received empty audio data from OpenAI")
            
            logging.info("Successfully generated speech audio")
            return audio_data
            
        except Exception as e:
            logging.error(f"Error generating speech: {str(e)}", exc_info=True)
            raise  # Re-raise the exception instead of returning None

    async def text_to_speech(self, text: str, user_id: str) -> Tuple[bytes, str]:
        """
        Convert text to speech and store in Redis temporarily
        Returns the audio data and a unique key for cleanup
        """
        try:
            # Generate speech using OpenAI's API or your custom endpoint
            # Replace this with the correct API call. For example:
            response = await self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                speed=1.05,
                input=text
            )
            
            # Assuming the response contains 'content' with binary data
            audio_content = response['content']  # Adjust based on actual response structure
            
            # Generate a unique key for this audio
            audio_key = f"audio:{user_id}:{uuid.uuid4().hex}"
            
            # Store in Redis with 5-minute expiration
            self.redis_client.setex(audio_key, timedelta(minutes=5), audio_content)
            
            # Return both the audio content and key
            return audio_content, audio_key
            
        except Exception as e:
            logging.error(f"Error in text_to_speech: {str(e)}")
            raise

    def delete_audio(self, audio_key):
        """
        Delete audio data from Redis
        """
        try:
            self.redis_client.delete(audio_key)
            logging.info(f"Successfully deleted audio: {audio_key}")
        except Exception as e:
            logging.error(f"Error deleting audio data: {e}") 