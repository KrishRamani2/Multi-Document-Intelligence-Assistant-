"""
THis is just for the reference of the sample operation that we want to perform on the document after ingestion and before chunking. This is not meant to be run as a test or anything, just a sample code to show how to perform operations on the document.

"""

from bson import ObjectId
from datetime import datetime
from typing import Optional, Dict, List
from db.client import get_videos_collection


async def save_video_analysis(
    video_url: str,
    chapters: List[Dict],
    text_chunks: List[Dict],
    full_text: str,
    video_id: Optional[str] = None
) -> str:
    """
    Save or update video analysis in MongoDB.
    
    Args:
        video_url: URL of the analyzed video
        chapters: List of chapter summaries
        text_chunks: List of time-based text chunks
        full_text: Complete transcript
        video_id: Optional existing video ID to update
        
    Returns:
        Video document ID (string)
    """
    collection = get_videos_collection()
    
    video_data = {
        "url": video_url,
        "chapters": chapters,
        "text_chunks": text_chunks,
        "full_text": full_text,
        "updated_at": datetime.utcnow()
    }
    
    if video_id:
        # Update existing video
        result = await collection.update_one(
            {"_id": ObjectId(video_id)},
            {"$set": video_data}
        )
        if result.modified_count == 0:
            raise ValueError(f"Video with ID {video_id} not found")
        return video_id
    else:
        # Create new video document
        video_data["created_at"] = datetime.utcnow()
        result = await collection.insert_one(video_data)
        return str(result.inserted_id)


async def get_video_analysis(video_id: str) -> Optional[Dict]:
    """
    Retrieve video analysis from MongoDB.
    
    Args:
        video_id: Video document ID
        
    Returns:
        Video document or None if not found
    """
    collection = get_videos_collection()
    video = await collection.find_one({"_id": ObjectId(video_id)})
    
    if video:
        video["_id"] = str(video["_id"])
        return video
    return None


async def get_video_by_url(video_url: str) -> Optional[Dict]:
    """
    Retrieve video analysis by URL.
    
    Args:
        video_url: Video URL
        
    Returns:
        Video document or None if not found
    """
    collection = get_videos_collection()
    video = await collection.find_one({"url": video_url})
    
    if video:
        video["_id"] = str(video["_id"])
        return video
    return None


async def get_cloudinary_url(video_id: str) -> Optional[str]:
    """
    Get cloudinary URL from video document.
    
    Args:
        video_id: Video document ID
        
    Returns:
        Cloudinary URL or None if not found
    """
    collection = get_videos_collection()
    video = await collection.find_one({"_id": ObjectId(video_id)})
    
    if video and "cloudinary_url" in video:
        return video["cloudinary_url"]
    return None


async def list_videos(limit: int = 10, skip: int = 0) -> List[Dict]:
    """
    List all analyzed videos.
    
    Args:
        limit: Maximum number of videos to return
        skip: Number of videos to skip
        
    Returns:
        List of video documents
    """
    collection = get_videos_collection()
    cursor = collection.find().sort("created_at", -1).skip(skip).limit(limit)
    
    videos = []
    async for video in cursor:
        video["_id"] = str(video["_id"])
        videos.append(video)
    
    return videos


async def delete_video(video_id: str) -> bool:
    """
    Delete video analysis from MongoDB.
    
    Args:
        video_id: Video document ID
        
    Returns:
        True if deleted, False if not found
    """
    collection = get_videos_collection()
    result = await collection.delete_one({"_id": ObjectId(video_id)})
    return result.deleted_count > 0
