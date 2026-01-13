import logging
from typing import Optional, Union, List
import openai
from pathlib import Path
import tempfile
import os
from pydub import AudioSegment
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

class SpeechToText:
    def __init__(self, client: AsyncOpenAI, model="whisper-1"):
        """
        Initialize the Speech to Text converter.
        Args:
            client (AsyncOpenAI): The OpenAI client to use
            model (str): The Whisper model to use (default: "whisper-1")
        """
        self.client = client
        self.model = model
        self.supported_formats = ['.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm']
        self.max_file_size = 25 * 1024 * 1024  # 25 MB in bytes

    async def transcribe(
        self, 
        audio_file: Union[str, bytes, Path],
        prompt: Optional[str] = None,
        language: Optional[str] = None
    ) -> Optional[str]:
        """
        Transcribe audio to text.
        
        Args:
            audio_file: Audio file bytes
            prompt: Optional prompt to guide the transcription
            language: Optional language code (e.g., "en", "es")
        
        Returns:
            Transcribed text or None if error occurs
        """
        try:
            # Create temporary file for the audio
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                if isinstance(audio_file, bytes):
                    temp_file.write(audio_file)
                elif isinstance(audio_file, (str, Path)):
                    with open(audio_file, 'rb') as f:
                        temp_file.write(f.read())
                temp_file.flush()
                
                try:
                    # Open and transcribe the audio
                    with open(temp_file.name, "rb") as audio:
                        response = await self.client.audio.transcriptions.create(
                            model=self.model,
                            file=audio,
                            language=language,
                            prompt=prompt or "This is an interview conversation."
                        )
                    return response.text
                finally:
                    # Clean up temp file
                    os.unlink(temp_file.name)

        except Exception as e:
            logger.error(f"Transcription error: {str(e)}")
            return None

    async def _transcribe_audio(
        self, 
        audio_file,
        prompt: Optional[str],
        response_format: str,
        temperature: float,
        language: Optional[str],
        timestamp_granularities: Optional[List[str]]
    ) -> Optional[str]:
        """Internal method to handle the actual transcription."""
        try:
            params = {
                "model": self.model,
                "file": audio_file,
                "response_format": response_format,
                "temperature": temperature
            }
            
            if prompt:
                params["prompt"] = prompt
            if language:
                params["language"] = language
            if timestamp_granularities:
                params["timestamp_granularities"] = timestamp_granularities

            response = await self.client.audio.transcriptions.create(**params)
            
            if response_format == "verbose_json":
                return response.words if hasattr(response, 'words') else response
            return response.text if hasattr(response, 'text') else response

        except Exception as e:
            logging.error(f"Error in _transcribe_audio: {str(e)}")
            return None

    async def _process_large_file(
        self,
        file_path: Path,
        prompt: Optional[str],
        response_format: str,
        temperature: float,
        language: Optional[str]
    ) -> str:
        """Handle files larger than 25MB by splitting them into chunks."""
        try:
            audio = AudioSegment.from_file(str(file_path))
            chunk_length = 10 * 60 * 1000  # 10 minutes in milliseconds
            chunks = []
            
            # Split audio into 10-minute chunks
            for i in range(0, len(audio), chunk_length):
                chunk = audio[i:i + chunk_length]
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    chunk.export(temp_file.name, format='wav')
                    with open(temp_file.name, 'rb') as chunk_file:
                        # Use the last part of previous chunk as prompt for context
                        chunk_prompt = prompt
                        if chunks and i > 0:
                            chunk_prompt = f"{chunks[-1][-200:]} {prompt if prompt else ''}"
                        
                        result = await self._transcribe_audio(
                            chunk_file, chunk_prompt, response_format, 
                            temperature, language, None
                        )
                        if result:
                            chunks.append(result)
                    
                    # Clean up temporary file
                    os.unlink(temp_file.name)
            
            return " ".join(chunks)

        except Exception as e:
            logging.error(f"Error processing large file: {str(e)}")
            return None

    async def translate(
        self,
        audio_file: Union[str, bytes, Path],
        prompt: Optional[str] = None,
        response_format: str = "text",
        temperature: float = 0
    ) -> Optional[str]:
        """
        Translate audio to English text.
        
        Args:
            audio_file: Path to audio file or bytes of audio data
            prompt: Optional prompt to guide the translation
            response_format: Format of the response
            temperature: Sampling temperature (0-1)
        
        Returns:
            Translated English text or None if error occurs
        """
        try:
            # Handle different input types similar to transcribe
            if isinstance(audio_file, (str, Path)):
                audio_path = Path(audio_file)
                if not audio_path.exists():
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")
                
                with open(audio_path, "rb") as audio:
                    return await self._translate_audio(audio, prompt, response_format, temperature)
            
            elif isinstance(audio_file, bytes):
                with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                    temp_file.write(audio_file)
                    temp_path = temp_file.name

                try:
                    with open(temp_path, "rb") as audio:
                        return await self._translate_audio(audio, prompt, response_format, temperature)
                finally:
                    os.unlink(temp_path)
            
            else:
                raise ValueError("audio_file must be a file path (str/Path) or bytes")

        except Exception as e:
            logging.error(f"Error in translate: {str(e)}")
            return None

    async def _translate_audio(
        self,
        audio_file,
        prompt: Optional[str],
        response_format: str,
        temperature: float
    ) -> Optional[str]:
        """Internal method to handle the actual translation."""
        try:
            params = {
                "model": self.model,
                "file": audio_file,
                "response_format": response_format,
                "temperature": temperature
            }
            
            if prompt:
                params["prompt"] = prompt

            response = await self.client.audio.translations.create(**params)
            return response.text if hasattr(response, 'text') else response

        except Exception as e:
            logging.error(f"Error in _translate_audio: {str(e)}")
            return None