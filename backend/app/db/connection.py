import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from loguru import logger

load_dotenv()


def get_database(db_name: str = None):
    mongo_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    logger.info(f"Connecting to MongoDB: {mongo_url}")

    client = AsyncIOMotorClient(
        mongo_url,
        serverSelectionTimeoutMS=10000,
        connectTimeoutMS=10000,
    )

    if db_name is None:
        db_name = os.getenv("MONGODB_DATABASE", "clutch_db")

    return client[db_name]


class Database:
    @classmethod
    def get_database(cls, db_name: str = None):
        return get_database(db_name)

    @classmethod
    async def close(cls):
        pass
