import hashlib
import os
from pathlib import Path


def compute_file_hash(file_path: str, algorithm: str = "sha256") -> str:
    """Compute hash of a file for deduplication."""
    hasher = hashlib.new(algorithm)
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_file_size(file_path: str) -> int:
    """Get file size in bytes."""
    return os.path.getsize(file_path)
