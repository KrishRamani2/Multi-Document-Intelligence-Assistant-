from typing import Optional, List
from datetime import datetime
from loguru import logger

from app.db.connection import get_database
from app.db.models import DocumentModel, EmbeddingInfo


class DocumentRepository:
    collection_name = "documents"

    @classmethod
    def get_collection(cls):
        return get_database()[cls.collection_name]

    @classmethod
    async def create(cls, document: DocumentModel) -> DocumentModel:
        logger.info(f"Creating document: {document.document_id}")
        collection = cls.get_collection()
        await collection.insert_one(document.model_dump())
        logger.info(f"Document created: {document.document_id}")
        return document

    @classmethod
    async def get_by_id(cls, document_id: str) -> Optional[DocumentModel]:
        logger.info(f"get_by_id: {document_id}")
        collection = cls.get_collection()
        doc = await collection.find_one({"document_id": document_id})
        if doc:
            doc.pop("_id", None)
            logger.info(f"Found document: {document_id}")
            return DocumentModel(**doc)
        logger.info(f"Document not found: {document_id}")
        return None

    @classmethod
    async def get_by_file_hash(cls, file_hash: str) -> Optional[DocumentModel]:
        logger.info(f"get_by_file_hash: {file_hash[:16]}...")
        collection = cls.get_collection()
        doc = await collection.find_one(
            {"file_hash": file_hash, "embedding_info.generated": True}
        )
        if doc:
            doc.pop("_id", None)
            logger.info(f"Found document by hash: {doc['document_id']}")
            return DocumentModel(**doc)
        logger.info(f"No document found for hash")
        return None

    @classmethod
    async def update_embeddings(
        cls,
        document_id: str,
        provider: str,
        model: str,
        embeddings_file: str,
    ):
        logger.info(f"update_embeddings: {document_id}")
        collection = cls.get_collection()

        embedding_info = {
            "generated": True,
            "provider": provider,
            "model": model,
            "file_path": embeddings_file,
        }

        await collection.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "embedding_info": embedding_info,
                    "updated_at": datetime.now(),
                }
            },
        )
        logger.info(f"Embeddings updated: {document_id}")

    @classmethod
    async def update_chunks(
        cls,
        document_id: str,
        chunks: List[dict],
        sections_count: int,
        passages_count: int,
        sentences_count: int,
    ):
        logger.info(f"update_chunks: {document_id}")
        collection = cls.get_collection()
        await collection.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "chunks": chunks,
                    "sections_count": sections_count,
                    "passages_count": passages_count,
                    "sentences_count": sentences_count,
                    "updated_at": datetime.now(),
                }
            },
        )

    @classmethod
    async def list_recent(cls, limit: int = 50) -> List[DocumentModel]:
        logger.info(f"list_recent: limit={limit}")
        collection = cls.get_collection()
        cursor = collection.find().sort("created_at", -1).limit(limit)
        docs = []
        async for doc in cursor:
            doc.pop("_id", None)
            docs.append(DocumentModel(**doc))
        logger.info(f"Found {len(docs)} documents")
        return docs
