from datetime import datetime, timedelta
import jwt
import base64
from typing import Optional, Dict, Any, Tuple
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class TokenManager:
    def __init__(self, secret_key: str, token_expiry: int = 4):
        if not secret_key:
            raise ValueError("Secret key cannot be empty")
        self.secret_key = secret_key
        self.access_token_expiry = timedelta(hours=token_expiry)
        self.refresh_token_expiry = timedelta(days=30)
        self.logger = logging.getLogger(__name__)

    def generate_token_pair(self, user_id: str, email: str) -> Dict[str, str]:
        """Generate both access and refresh tokens"""
        try:
            access_token = self._create_access_token(user_id, email)
            refresh_token = self._create_refresh_token(user_id, email)
            
            return {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "bearer"
            }
        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            raise

    def _create_access_token(self, user_id: str, email: str) -> str:
        """Create access token with shorter expiry"""
        payload = {
            "user_id": user_id,
            "email": email,
            "exp": datetime.utcnow() + self.access_token_expiry,
            "type": "access"
        }
        return jwt.encode(payload, self.secret_key, algorithm="HS256")

    def _create_refresh_token(self, user_id: str, email: str) -> str:
        """Create refresh token with longer expiry"""
        payload = {
            "user_id": user_id,
            "email": email,
            "exp": datetime.utcnow() + self.refresh_token_expiry,
            "type": "refresh"
        }
        return jwt.encode(payload, self.secret_key, algorithm="HS256")

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify a JWT token"""
        try:
            if not token:
                logger.error("No token provided")
                return None

            # Convert string token to bytes if necessary
            if isinstance(token, str):
                token = token.encode('utf-8')

            # First decode without verification to check expiry
            unverified_payload = jwt.decode(token, options={"verify_signature": False})
            exp = unverified_payload.get('exp')
            
            if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
                logger.error("Token has expired")
                return None

            # Now verify the signature and decode
            payload = jwt.decode(token, self.secret_key, algorithms=["HS256"])
            logger.info(f"Token verified successfully for user: {payload.get('user_id')}")
            return payload

        except jwt.ExpiredSignatureError:
            logger.error("Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None

    @staticmethod
    def encode_email(email: str) -> str:
        """Encode email for use in URLs"""
        return base64.urlsafe_b64encode(email.encode()).decode().rstrip('=')

    @staticmethod
    def decode_email(encoded: str) -> str:
        """Decode email from URL-safe format"""
        padding = 4 - (len(encoded) % 4)
        if padding != 4:
            encoded += '=' * padding
        return base64.urlsafe_b64decode(encoded).decode()

    def create_interview_token(self, user_id: str, interview_id: str) -> str:
        """Create interview-specific JWT"""
        return jwt.encode({
            "sub": user_id,
            "interview_id": interview_id,
            "exp": datetime.utcnow() + timedelta(hours=2)
        }, self.secret_key, algorithm="HS256")

    def create_token(self, data: dict, expires_in: int = 3600) -> str:
        """Create a JWT token with expiry."""
        payload = {
            **data,
            "exp": datetime.utcnow() + timedelta(seconds=expires_in)
        }
        return jwt.encode(payload, self.secret_key, algorithm="HS256")

    def generate_token(self, user_id: str, email: str) -> dict:
        """Generate both access and refresh tokens"""
        try:
            # Create access token with explicit expiration
            access_payload = {
                "user_id": user_id,
                "email": email,
                "type": "access",
                "exp": datetime.utcnow() + self.access_token_expiry
            }
            access_token = jwt.encode(access_payload, self.secret_key, algorithm="HS256")
            if isinstance(access_token, bytes):
                access_token = access_token.decode('utf-8')

            # Create refresh token with explicit expiration
            refresh_payload = {
                "user_id": user_id,
                "email": email,
                "type": "refresh",
                "exp": datetime.utcnow() + self.refresh_token_expiry
            }
            refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm="HS256")
            if isinstance(refresh_token, bytes):
                refresh_token = refresh_token.decode('utf-8')

            return {
                "access_token": access_token,
                "refresh_token": refresh_token
            }
        except Exception as e:
            logger.error(f"Token generation failed: {e}")
            raise

    def refresh_tokens(self, refresh_token: str) -> Optional[Dict[str, Any]]:
        """Generate new token pair from refresh token"""
        try:
            logger.info("Verifying refresh token")
            
            # Handle string or bytes token
            token_bytes = refresh_token.encode('utf-8') if isinstance(refresh_token, str) else refresh_token

            # Verify the refresh token
            try:
                payload = jwt.decode(token_bytes, self.secret_key, algorithms=["HS256"])
            except jwt.InvalidTokenError as e:
                logger.error(f"Invalid refresh token: {e}")
                return None

            if payload.get("type") != "refresh":
                logger.error("Invalid token type for refresh")
                return None

            # Generate new tokens
            logger.info(f"Generating new tokens for user: {payload.get('user_id')}")
            return self.generate_token(payload["user_id"], payload["email"])

        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return None