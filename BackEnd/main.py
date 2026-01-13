from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Header, File, UploadFile, Query, status
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import logging
import os
from datetime import datetime
import json
import asyncio
from openai import AsyncOpenAI
import tempfile
from pydantic import BaseModel
import redis
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import base64
import re
from starlette.websockets import WebSocketState

# Import local services
from redis_service import RedisService
from prompt_generator import PromptGenerator
from text_to_speech import TextToSpeech
from token_manager import TokenManager
from redis_config import redis_client
from speech_to_text import SpeechToText

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

# Verify SECRET_KEY is loaded
secret_key = os.getenv("SECRET_KEY")
if not secret_key:
    raise ValueError("SECRET_KEY environment variable is not set")

# Initialize RedisService
redis_service = RedisService()

# Add security scheme
security = HTTPBearer()

# Initialize FastAPI app with security scheme
app = FastAPI(security=[security])

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://frontend:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
token_manager = TokenManager(secret_key)
tts_service = TextToSpeech(openai_client)
prompt_service = PromptGenerator()

# Models
class User(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None

class TokenRequest(BaseModel):
    user_id: str
    email: str

class DocumentRequest(BaseModel):
    resume: str
    job_description: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Authentication middleware
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Verify the Bearer token"""
    try:
        payload = token_manager.verify_token(credentials.credentials)
        if not payload:
            raise HTTPException(
                status_code=401, 
                detail="Invalid or expired token"
            )
        return payload
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials"
        )

# Routes
@app.post("/generate-token")
async def generate_token(request: TokenRequest):
    try:
        token = token_manager.generate_token(request.user_id, request.email)
        return {"token": token}
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate token")

@app.post("/process-documents", response_model=Dict[str, Any])
async def process_documents(
    request: DocumentRequest,
    current_user: Dict[str, Any] = Depends(verify_token)
):
    """Process resume and job description to generate interview questions"""
    try:
        logger.info(f"Processing documents for user: {current_user['email']}")
        
        # Extract user info from verified token
        user_id = current_user["user_id"]
        email = current_user["email"]

        # Clear any existing interview data for this user
        redis_service.clear_interview_data(user_id)

        # Generate interview prompt
        prompt = await prompt_service.generate_interview_prompt(
            resume=request.resume,
            job_description=request.job_description
        )
        
        # Store in Redis
        interview_id = f"interview:{user_id}"
        redis_service.store_interview_prompt(user_id, {
            'prompt': prompt,
            'created_at': datetime.utcnow().isoformat(),
            'questions_asked': []  # Initialize empty questions list
        })
        
        return {
            "user_id": user_id,
            "interview_id": interview_id,
            "status": "success"
        }

    except Exception as e:
        logger.error(f"Error processing documents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

class UserConnection:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.lock = asyncio.Lock()
        self.current_sentence = ""

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, UserConnection] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> bool:
        try:
            await websocket.accept()
            self.active_connections[user_id] = UserConnection(websocket)
            return True
        except Exception as e:
            logger.error(f"Failed to connect user {user_id}: {e}")
            return False

    async def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].websocket.close()
            except:
                pass
            del self.active_connections[user_id]

    def get_connection(self, user_id: str) -> Optional[UserConnection]:
        return self.active_connections.get(user_id)

manager = ConnectionManager()

class InterviewSession:
    def __init__(self, user_id: str, prompt: str):
        self.user_id = user_id
        self.prompt = prompt
        self.messages = []
        self.has_started = False
        self.last_interaction = datetime.utcnow()
        self.inactivity_timeout = 360  # 6 minutes in seconds (changed from 300)

    def add_message(self, role: str, content: str):
        self.messages.append({"role": role, "content": content})
        self.last_interaction = datetime.utcnow()  # Reset timer on new message

    def is_inactive(self) -> bool:
        elapsed = (datetime.utcnow() - self.last_interaction).total_seconds()
        return elapsed > self.inactivity_timeout

    def get_context(self) -> List[Dict[str, str]]:
        return [{"role": "system", "content": self.prompt}] + self.messages

@app.websocket("/ws/interview")
async def interview_websocket(
    websocket: WebSocket,
    token: str,
    user_id: str,
    new_session: bool = False
):
    async def process_gpt_response(messages, user_conn: UserConnection, session: InterviewSession):
        async with user_conn.lock:
            try:
                await user_conn.websocket.send_json({
                    "type": "speaker_change",
                    "speaker": "interviewer"
                })

                # Use different system prompts for initial vs ongoing conversation
                if not session.has_started:
                    system_content = f"""{session.prompt}

IMPORTANT REMINDERS:
- You are ALWAYS Noah the interviewer
- Never respond as if you are the candidate
- Never switch roles or reference previous conversations
- Begin with a warm introduction and your first question
- Keep responses focused and concise
- Never switch topics without proper transition
"""
                    messages = [{"role": "system", "content": system_content}] + session.messages

                else:
                    system_content = f"""{session.prompt}

IMPORTANT REMINDERS:
- You are ALWAYS Noah the interviewer
- Never respond as if you are the candidate
- Never switch roles or reference previous conversations
- Your responses should:
  - Show active listening when appropriate
  - Move the conversation forward naturally
  - Ask follow-up questions only when needed for clarity or depth
  - Progress to new topics when a subject is sufficiently explored
- Keep responses focused and concise
- Maintain a natural conversational flow
- Ask broad, open-ended questions more often than follow-ups
"""
                    messages = [{"role": "system", "content": system_content}] + messages[-5:]

                stream = await openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=messages,
                    stream=True,
                    max_tokens=300,
                    temperature=0.7
                )

                user_conn.current_sentence = ""

                async for chunk in stream:
                    # Check if WebSocket is still open
                    if user_conn.websocket.client_state == WebSocketState.DISCONNECTED:
                        logger.warning("WebSocket disconnected during processing")
                        break

                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        user_conn.current_sentence += content

                        sentences = re.split(r'(?<=[.!?]) +', user_conn.current_sentence)
                        
                        if sentences and not sentences[-1].strip().endswith(('.', '!', '?')):
                            user_conn.current_sentence = sentences.pop()
                        else:
                            user_conn.current_sentence = ""

                        for sentence in sentences:
                            sentence = sentence.strip()
                            if sentence:
                                try:
                                    audio_data = await tts_service.generate_speech(sentence)
                                    if user_conn.websocket.client_state == WebSocketState.CONNECTED:
                                        await user_conn.websocket.send_json({
                                            "type": "sentence",
                                            "text": sentence,
                                            "audio": base64.b64encode(audio_data).decode('utf-8')
                                        })
                                        
                                        # Track questions and update context
                                        if sentence.strip().endswith('?'):
                                            redis_service.add_question_asked(session.user_id, sentence)
                                        
                                        # Update conversation history
                                        redis_service.update_conversation_history(session.user_id, {
                                            "role": "interviewer",
                                            "content": sentence
                                        })
                                        
                                        session.add_message("assistant", sentence)
                                except Exception as e:
                                    logger.error(f"Error sending sentence: {e}")
                                    if "close message has been sent" not in str(e):
                                        raise

                # Handle any remaining text
                if user_conn.current_sentence.strip() and user_conn.websocket.client_state == WebSocketState.CONNECTED:
                    try:
                        sentence = user_conn.current_sentence.strip()
                        audio_data = await tts_service.generate_speech(sentence)
                        await user_conn.websocket.send_json({
                            "type": "sentence",
                            "text": sentence,
                            "audio": base64.b64encode(audio_data).decode('utf-8')
                        })
                        
                        # Track final sentence if it's a question
                        if sentence.endswith('?'):
                            redis_service.add_question_asked(session.user_id, sentence)
                        
                        # Update final conversation history
                        redis_service.update_conversation_history(session.user_id, {
                            "role": "interviewer",
                            "content": sentence
                        })
                        
                        session.add_message("assistant", sentence)
                    except Exception as e:
                        logger.error(f"Error sending final sentence: {e}")
                        if "close message has been sent" not in str(e):
                            raise

                # After all sentences are processed, indicate it's user's turn
                await user_conn.websocket.send_json({
                    "type": "speaker_change",
                    "speaker": "user",
                    "showPrompt": True
                })

            except Exception as e:
                logger.error(f"Error processing GPT response: {e}")
                raise

    try:
        # Verify token
        payload = token_manager.verify_token(token)
        if not payload or payload["user_id"] != user_id:
            await websocket.close(code=4001)
            return
            
        # Connect websocket
        if not await manager.connect(user_id, websocket):
            return
            
        # Get interview prompt
        prompt_data = redis_service.get_interview_prompt(user_id)
        if not prompt_data:
            logger.error(f"No prompt data found for user {user_id}")
            await websocket.close(code=4002)
            return

        # Initialize session
        logger.info(f"Starting new interview for user {user_id}")
        session = InterviewSession(user_id, prompt_data["prompt"])
        session.messages = []  # Ensure messages are cleared
        session.has_started = False

        if new_session:
            # Add initial system message to trigger proper introduction
            session.add_message("user", "[SYSTEM MESSAGE] Start the interview by introducing yourself briefly and ask the first question")
            await process_gpt_response(session.get_context(), manager.get_connection(user_id), session)
            session.has_started = True

        # Start inactivity checker task
        async def check_inactivity():
            while True:
                await asyncio.sleep(30)  # Check every 30 seconds
                if session.is_inactive():
                    logger.info(f"Session inactive for user {user_id}, closing connection")
                    await websocket.send_json({
                        "type": "system",
                        "content": "Interview ended due to inactivity. Please refresh to start a new session."
                    })
                    await websocket.close(code=4003)
                    break

        inactivity_task = asyncio.create_task(check_inactivity())

        # Handle ongoing conversation
        while True:
            try:
                message = await websocket.receive_text()
                if message.strip():
                    # Send message that user is now speaking
                    await websocket.send_json({
                        "type": "speaker_change",
                        "speaker": "user"
                    })
                    
                    session.add_message("user", message)
                    await process_gpt_response(session.get_context(), manager.get_connection(user_id), session)
                    
                    # After GPT response is complete, send message that it's user's turn
                    await websocket.send_json({
                        "type": "speaker_change",
                        "speaker": "user",
                        "showPrompt": True  # Indicate to show the space/enter prompt
                    })
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {user_id}")
                break
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                break

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        # Clean up
        if 'inactivity_task' in locals():
            inactivity_task.cancel()
        await manager.disconnect(user_id)

@app.delete("/clear-interview/{user_id}")
async def clear_interview(user_id: str, token_data: Dict[str, Any] = Depends(verify_token)):
    """Clear interview data for a user"""
    if token_data["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if await redis_service.clear_interview_data(user_id):
        return {"status": "success", "message": "Interview data cleared"}
    raise HTTPException(status_code=500, detail="Failed to clear interview data")

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Handle audio transcription requests."""
    try:
        # Read the audio file
        contents = await audio.read()
        
        # Initialize transcriber with the OpenAI client
        transcriber = SpeechToText(openai_client)
        
        # Transcribe with interview context
        text = await transcriber.transcribe(
            contents,
            prompt="This is an interview conversation response.",
            language="en"
        )
        
        if text:
            return {"text": text}
        else:
            raise HTTPException(status_code=400, detail="Transcription failed")
            
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Authentication function
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """
    Validate token and return current user
    """
    try:
        token = credentials.credentials
        payload = token_manager.verify_token(token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        user = User(
            id=payload.get('user_id'),
            email=payload.get('email'),
            name=payload.get('name')
        )
        return user
        
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/start-interview")
async def start_interview(current_user: User = Depends(get_current_user)):
    try:
        # Start the interview timer
        redis_service.start_interview_timer(current_user.id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/check-interview-time")
async def check_interview_time(current_user: User = Depends(get_current_user)):
    try:
        should_continue = redis_service.check_interview_time(current_user.id)
        return {"should_continue": should_continue}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/end-interview")
async def end_interview(current_user: User = Depends(get_current_user)):
    try:
        redis_service.clear_interview_timer(current_user.id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/refresh-token", response_model=Dict[str, Any])
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token"""
    try:
        logger.info("Attempting to refresh token")
        if not request.refresh_token:
            logger.error("No refresh token provided")
            raise HTTPException(
                status_code=400,
                detail="Refresh token is required"
            )

        tokens = token_manager.refresh_tokens(request.refresh_token)
        if not tokens:
            logger.error("Token refresh failed - invalid or expired token")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired refresh token"
            )

        logger.info("Token refresh successful")
        return tokens

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=401,
            detail=str(e)
        )

@app.get("/queue-status")
async def get_queue_status(current_user: User = Depends(get_current_user)):
    active_count = redis_service.get_active_users_count()
    queue_position = redis_service.get_queue_position(current_user.id)
    return {
        "active_users": active_count,
        "queue_position": queue_position,
        "max_users": redis_service.MAX_CONCURRENT_USERS
    }

@app.post("/join-interview-queue")
async def join_interview_queue(current_user: User = Depends(get_current_user)):
    if redis_service.add_to_active_users(current_user.id):
        return {"status": "active"}
    
    position = redis_service.add_to_queue(current_user.id)
    return {"status": "queued", "position": position - 1}

@app.post("/leave-interview")
async def leave_interview(current_user: User = Depends(get_current_user)):
    redis_service.remove_from_active_users(current_user.id)
    promoted_users = redis_service.check_and_promote_users()
    return {"status": "success", "promoted_users": promoted_users}