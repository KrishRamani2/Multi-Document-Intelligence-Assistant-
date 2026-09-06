from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

class Database:
    client: Optional[AsyncIOMotorClient] = None
    
    @classmethod
    def get_client(cls) -> AsyncIOMotorClient:
        """Get MongoDB client instance"""
        if cls.client is None:
            mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
            cls.client = AsyncIOMotorClient(mongo_url)
        return cls.client
    
    @classmethod
    def get_database(cls, db_name: str = None):
        """Get database instance"""
        if db_name is None:
            db_name = os.getenv("MONGODB_DATABASE", "clutch_db")
        client = cls.get_client()
        return client[db_name]
    
    @classmethod
    async def close(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            cls.client = None

# Convenience function to get collections
def get_videos_collection():
    """Get videos collection"""
    db = Database.get_database()
    return db["videos"]
