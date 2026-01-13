from typing import Optional, Dict, Any, List
import json
import logging
from redis import Redis
from datetime import datetime, timedelta
import redis
from redis_config import redis_client

logger = logging.getLogger(__name__)

class RedisService:
    def __init__(self):
        self.client = redis_client
        self.default_expiry = timedelta(hours=4)
        self.INTERVIEW_DURATION = 600  # 10 minutes in seconds
        self.MAX_CONCURRENT_USERS = 5
        self.QUEUE_KEY = "interview_queue"
        self.ACTIVE_USERS_KEY = "active_interview_users"
        self.CONTEXT_HISTORY_SIZE = 10  # Keep last 10 messages for context

    def store_interview_prompt(self, user_id: str, prompt_data: Dict[str, Any]) -> bool:
        """Store only the generated prompt and metadata"""
        try:
            key = f"interview:prompt:{user_id}"
            clean_data = {
                "prompt": prompt_data["prompt"],
                "created_at": prompt_data["created_at"],
                "questions_asked": prompt_data["questions_asked"]
            }
            return self.client.setex(
                key,
                int(self.default_expiry.total_seconds()),
                json.dumps(clean_data)
            )
        except Exception as e:
            logger.error(f"Failed to store interview prompt: {str(e)}")
            return False

    def get_interview_prompt(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve interview prompt data"""
        try:
            key = f"interview:prompt:{user_id}"
            data = self.client.get(key)
            if not data:
                logger.warning(f"No interview prompt found for user {user_id}")
                return None
            return json.loads(data)
        except Exception as e:
            logger.error(f"Failed to get interview prompt: {e}")
            return None

    def store_question_history(self, user_id: str, questions: List[str]) -> bool:
        """Store the history of asked questions"""
        try:
            key = f"interview:questions:{user_id}"
            self.client.setex(
                key,
                int(self.default_expiry.total_seconds()),
                json.dumps({
                    "questions": questions,
                    "updated_at": datetime.utcnow().isoformat()
                })
            )
            return True
        except Exception as e:
            logger.error(f"Failed to store question history: {e}")
            return False

    def get_question_history(self, user_id: str) -> List[str]:
        """Retrieve question history"""
        try:
            key = f"interview:questions:{user_id}"
            data = self.client.get(key)
            if not data:
                return []
            return json.loads(data)["questions"]
        except Exception as e:
            logger.error(f"Failed to get question history: {e}")
            return []

    def clear_interview_data(self, user_id: str):
        """Clear all interview-related data for a user"""
        try:
            # List of keys to clear
            keys_to_clear = [
                f"interview:prompt:{user_id}",
                f"interview:context:{user_id}",
                f"interview:questions:{user_id}",
                f"interview_timer:{user_id}",
                f"interview:history:{user_id}",
                f"interview_history:{user_id}",
                f"interview:conversation:{user_id}"
            ]
            
            # Delete all keys
            for key in keys_to_clear:
                self.client.delete(key)
                
            # Remove from active users and queue if present
            self.remove_from_active_users(user_id)
            self.remove_from_queue(user_id)
            
            logger.info(f"Cleared interview data for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to clear interview data: {e}")

    def store_interview_context(self, user_id: str, context_data: Dict[str, Any]) -> bool:
        """Store interview context including questions and conversation history"""
        try:
            key = f"interview:context:{user_id}"
            clean_data = {
                "prompt": context_data.get("prompt", ""),
                "questions_asked": context_data.get("questions_asked", []),
                "conversation_history": context_data.get("conversation_history", [])[-self.CONTEXT_HISTORY_SIZE:],
                "last_interaction": datetime.utcnow().isoformat()
            }
            return self.client.setex(
                key,
                int(self.default_expiry.total_seconds()),
                json.dumps(clean_data)
            )
        except Exception as e:
            logger.error(f"Failed to store interview context: {str(e)}")
            return False

    def get_interview_context(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get interview context including questions and conversation history"""
        try:
            key = f"interview:context:{user_id}"
            data = self.client.get(key)
            if not data:
                return None
            return json.loads(data)
        except Exception as e:
            logger.error(f"Failed to get interview context: {e}")
            return None

    def update_conversation_history(self, user_id: str, message: Dict[str, str]):
        """Add new message to conversation history"""
        try:
            context = self.get_interview_context(user_id)
            if context:
                history = context.get('conversation_history', [])
                history.append(message)
                context['conversation_history'] = history[-self.CONTEXT_HISTORY_SIZE:]  # Keep last N messages
                self.store_interview_context(user_id, context)
        except Exception as e:
            logger.error(f"Failed to update conversation history: {e}")

    def add_question_asked(self, user_id: str, question: str):
        """Track a new question that was asked"""
        try:
            context = self.get_interview_context(user_id)
            if context:
                questions = context.get('questions_asked', [])
                if question not in questions:  # Avoid duplicates
                    questions.append(question)
                    context['questions_asked'] = questions
                    self.store_interview_context(user_id, context)
        except Exception as e:
            logger.error(f"Failed to add question: {e}")

    def update_question_history(self, user_id: str, questions: list):
        """Update question history in Redis."""
        context = self.get_interview_context(user_id)
        if context:
            context['questions_asked'] = questions
            self.store_interview_context(user_id, context)

    def clear_interview_history(self, user_id: str):
        """Clear interview history for a user"""
        try:
            self.client.delete(f"interview_history:{user_id}")
            logger.info(f"Cleared interview history for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing interview history: {e}")
            return False

    def update_interview_history(self, user_id: str, messages: list):
        """Update the interview history for a user"""
        key = f"interview:history:{user_id}"
        self.client.set(key, json.dumps(messages), ex=3600)  # Expire after 1 hour

    def get_interview_history(self, user_id: str) -> list:
        """Get the interview history for a user"""
        key = f"interview:history:{user_id}"
        history = self.client.get(key)
        return json.loads(history) if history else []

    def start_interview_timer(self, user_id: str):
        """Start the interview timer for a user"""
        start_time = datetime.utcnow().timestamp()
        self.client.set(f"interview_timer:{user_id}", start_time)
        
    def check_interview_time(self, user_id: str) -> bool:
        """
        Check if interview time has expired
        Returns: True if interview should continue, False if time is up
        """
        start_time = self.client.get(f"interview_timer:{user_id}")
        if not start_time:
            return True  # No timer set, allow interview to continue
            
        start_time = float(start_time)
        current_time = datetime.utcnow().timestamp()
        elapsed_time = current_time - start_time
        
        return elapsed_time < self.INTERVIEW_DURATION

    def clear_interview_timer(self, user_id: str):
        """Clear the interview timer for a user"""
        self.client.delete(f"interview_timer:{user_id}")

    def get_active_users_count(self) -> int:
        """Get count of currently active interview users"""
        return self.client.scard(self.ACTIVE_USERS_KEY)

    def add_to_active_users(self, user_id: str) -> bool:
        """Add user to active interviews if space available"""
        if self.get_active_users_count() < self.MAX_CONCURRENT_USERS:
            self.client.sadd(self.ACTIVE_USERS_KEY, user_id)
            return True
        return False

    def remove_from_active_users(self, user_id: str):
        """Remove user from active interviews"""
        self.client.srem(self.ACTIVE_USERS_KEY, user_id)

    def add_to_queue(self, user_id: str) -> int:
        """Add user to waiting queue and return position"""
        return self.client.rpush(self.QUEUE_KEY, user_id)

    def remove_from_queue(self, user_id: str):
        """Remove user from waiting queue"""
        self.client.lrem(self.QUEUE_KEY, 0, user_id)

    def get_queue_position(self, user_id: str) -> int:
        """Get user's position in queue (0-based, -1 if not in queue)"""
        queue = self.client.lrange(self.QUEUE_KEY, 0, -1)
        try:
            return queue.index(user_id)
        except ValueError:
            return -1

    def get_next_in_queue(self) -> Optional[str]:
        """Get and remove next user from queue"""
        return self.client.lpop(self.QUEUE_KEY)

    def check_and_promote_users(self) -> List[str]:
        """Check queue and promote users if spots available"""
        promoted_users = []
        while self.get_active_users_count() < self.MAX_CONCURRENT_USERS:
            next_user = self.get_next_in_queue()
            if not next_user:
                break
            if self.add_to_active_users(next_user):
                promoted_users.append(next_user)
        return promoted_users