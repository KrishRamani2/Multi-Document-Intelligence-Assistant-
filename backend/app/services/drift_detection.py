"""
Drift Detection Service
- Similarity-based duplicate detection (threshold 0.98)
- Semantic drift detection using embeddings (negative similarity -> potential contradiction)
"""

import os
import uuid
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from loguru import logger

SIMILARITY_THRESHOLD = 0.98  # For exact duplicates (>= 0.98 = same content)
DRIFT_THRESHOLD = -0.3  # For potential contradictions (< -0.3 = semantically opposite)


@dataclass
class DriftCheckResult:
    has_conflicts: bool
    has_duplicates: bool
    conflicts: List[Dict[str, Any]]
    duplicates: List[Dict[str, Any]]


class DriftDetectionService:
    """Service for detecting temporal drift and duplicates using embeddings."""

    def __init__(self):
        pass

    def compute_similarity(self, emb1: List[float], emb2: List[float]) -> float:
        """Compute cosine similarity between two embeddings."""
        v1 = np.array(emb1)
        v2 = np.array(emb2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(v1, v2) / (norm1 * norm2))

    def find_duplicates(
        self,
        new_embeddings: List[Tuple[str, List[float]]],
        existing_embeddings: Dict[str, List[float]],
        threshold: float = SIMILARITY_THRESHOLD,
    ) -> List[Dict[str, Any]]:
        """Find exact duplicates using similarity threshold."""
        duplicates = []

        for new_id, new_emb in new_embeddings:
            for existing_id, existing_emb in existing_embeddings.items():
                sim = self.compute_similarity(new_emb, existing_emb)
                if sim >= threshold:
                    duplicates.append(
                        {
                            "new_chunk_id": new_id,
                            "existing_chunk_id": existing_id,
                            "similarity": round(sim, 4),
                        }
                    )
                    break

        return duplicates

    def find_semantic_drift(
        self,
        new_chunks: List[Dict[str, Any]],
        new_embeddings: List[List[float]],
        existing_chunks: List[Dict[str, Any]],
        threshold: float = DRIFT_THRESHOLD,
    ) -> List[Dict[str, Any]]:
        """Find potential contradictions using negative similarity.

        Negative similarity indicates semantic opposition:
        - "Revenue grew" vs "Revenue declined" -> negative similarity
        - "Company expanded" vs "Company contracted" -> negative similarity
        """
        conflicts = []

        for i, (chunk, emb) in enumerate(zip(new_chunks, new_embeddings)):
            new_text = chunk.get("text", "")

            for existing in existing_chunks:
                existing_emb = existing.get("embedding")
                if not existing_emb:
                    continue

                existing_text = existing.get("text", "")
                if not new_text or not existing_text:
                    continue

                sim = self.compute_similarity(emb, existing_emb)

                if sim < threshold:
                    conflicts.append(
                        {
                            "new_chunk_id": chunk.get("chunk_id", f"chunk-{i}"),
                            "new_text": new_text[:200],
                            "existing_chunk_id": existing.get("chunk_id", ""),
                            "existing_text": existing_text[:200],
                            "existing_document_id": existing.get("document_id", ""),
                            "existing_document_name": existing.get("document_name", ""),
                            "similarity": round(sim, 4),
                            "drift_type": "potential_contradiction",
                        }
                    )

        return conflicts

    async def check_drift(
        self,
        new_chunks: List[Dict[str, Any]],
        new_embeddings: List[List[float]],
        existing_chunks: List[Dict[str, Any]],
    ) -> DriftCheckResult:
        """Check for drift/duplicates between new and existing chunks."""

        if not existing_chunks:
            return DriftCheckResult(
                has_conflicts=False,
                has_duplicates=False,
                conflicts=[],
                duplicates=[],
            )

        # Prepare existing embeddings dict
        existing_embeddings = {
            chunk["chunk_id"]: chunk["embedding"]
            for chunk in existing_chunks
            if "embedding" in chunk
        }

        # 1. Check for duplicates
        duplicates = self.find_duplicates(
            [
                (chunk.get("chunk_id", f"chunk-{i}"), emb)
                for i, (chunk, emb) in enumerate(zip(new_chunks, new_embeddings))
            ],
            existing_embeddings,
            SIMILARITY_THRESHOLD,
        )

        # 2. Check for potential contradictions
        conflicts = self.find_semantic_drift(
            new_chunks, new_embeddings, existing_chunks, DRIFT_THRESHOLD
        )

        logger.info(
            f"Drift check: {len(conflicts)} conflicts, {len(duplicates)} duplicates"
        )

        return DriftCheckResult(
            has_conflicts=len(conflicts) > 0,
            has_duplicates=len(duplicates) > 0,
            conflicts=conflicts,
            duplicates=duplicates,
        )


_drift_service: Optional[DriftDetectionService] = None


def get_drift_service() -> DriftDetectionService:
    global _drift_service
    if _drift_service is None:
        _drift_service = DriftDetectionService()
    return _drift_service
