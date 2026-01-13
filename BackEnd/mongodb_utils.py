from pymongo.mongo_client import MongoClient
from datetime import datetime
import os
import logging
from typing import Dict

class MongoDB:
    def __init__(self):
        MONGO_URI = os.getenv("MONGODB_URI")
        if not MONGO_URI:
            raise ValueError("MONGODB_URI environment variable is not set")
        
        # Initialize MongoDB client
        self.client = MongoClient(MONGO_URI)
        self.db = self.client.interview_db
        self.conversations = self.db.conversations
        
        # Test connection
        try:
            self.client.admin.command('ping')
            logging.info("Successfully connected to MongoDB!")
        except Exception as e:
            logging.error(f"MongoDB connection failed: {e}")
            raise

    def setup_indexes(self):
        # TTL index - documents will be automatically deleted after 7 days
        self.conversations.create_index(
            "created_at", 
            expireAfterSeconds=604800  # 7 days in seconds
        )
        # Index for email lookups
        self.conversations.create_index("email")
        logging.info("MongoDB indexes created")

    def store_conversation(self, email: str, conversation_data: Dict):
        """Non-blocking store operation"""
        try:
            conversation_doc = {
                "email": email,
                "created_at": datetime.utcnow(),
                "messages": conversation_data["messages"],
                "metadata": {
                    "user_id": conversation_data["user_id"],
                    "interview_date": datetime.utcnow()
                }
            }
            
            # Fire and forget - don't wait for DB operation
            self.conversations.insert_one(conversation_doc)
            logging.info(f"Queued conversation storage for email: {email}")
        except Exception as e:
            logging.error(f"Failed to queue conversation storage: {e}")
            # Don't raise the exception - we don't want to interrupt the conversation

# Initialize MongoDB
mongodb = MongoDB()
mongodb.setup_indexes()