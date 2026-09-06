"""
Clean MongoDB and Vector Store
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


async def clean():
    from app.db.connection import get_database
    from app.vector_store import get_vector_store
    from dotenv import load_dotenv

    load_dotenv()

    print("🧹 Cleaning MongoDB and Vector Store...\n")

    # MongoDB
    try:
        db = get_database()

        # List all collections
        collections = await db.list_collection_names()
        print(f"Collections found: {collections}")

        # Drop each collection
        for coll in collections:
            await db[coll].drop()
            print(f"  ✓ Dropped: {coll}")

        if not collections:
            print("  No collections to clean")

    except Exception as e:
        print(f"  MongoDB error: {e}")

    # Vector Store
    try:
        vs = get_vector_store()

        # Reset the in-memory store
        vs._embeddings = []
        vs._texts = []
        vs._metadata = []

        print(f"  ✓ Vector store cleared ({len(vs._embeddings)} chunks)")

    except Exception as e:
        print(f"  Vector store error: {e}")

    print("\n✅ Clean complete!")


if __name__ == "__main__":
    asyncio.run(clean())
