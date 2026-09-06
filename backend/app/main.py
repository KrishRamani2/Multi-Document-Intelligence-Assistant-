import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

from app.routes import ingest_route, document_route, search_route, agent_route


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load embeddings into vector store
    from motor.motor_asyncio import AsyncIOMotorClient
    from app.vector_store import get_vector_store
    from embeddings.service import GeminiEmbedder

    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["clutch_db"]
    coll = db["documents"]
    vs = get_vector_store()
    emb = GeminiEmbedder()

    doc_ids = [
        "4beecd89-7bcb-45f8-ad62-c5d8e1006033",  # annual_report_2024.pdf
        "08e0a5af-0109-467a-80e6-8507c33e61a5",  # acme_corp.html
        "5f22a8b9-e34d-448e-87ee-365a8709e099",  # financial_timeseries.csv
        "620b242b-7362-4bcc-b52c-5e80c56fb004",  # YouTube budget video
    ]

    for doc_id in doc_ids:
        doc = await coll.find_one({"document_id": doc_id})
        if not doc:
            continue
        passages = doc.get("hierarchical_chunks", {}).get("passages", [])
        if not passages:
            continue
        texts = [p.get("text", "")[:1500] for p in passages]
        embeddings = emb.embed(texts)
        await vs.ingest(
            doc_id,
            doc.get("source_name", "unknown"),
            [
                {"text": p.get("text", ""), "chunk_id": p.get("chunk_id", "")}
                for p in passages
            ],
            embeddings,
        )

    stats = await vs.get_stats()
    print(f"Loaded {stats['total_chunks']} chunks for {stats['documents']} documents")

    yield
    from app.db.connection import get_database


app = FastAPI(
    title="Multi-Document Intelligence API",
    description="Ingestion API for extracting and embedding documents from various sources",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the parent directory of 'app'
BASE_DIR = Path(__file__).parent.parent
templates = Jinja2Templates(directory=BASE_DIR / "templates")

app.include_router(ingest_route.router)
app.include_router(document_route.router)
app.include_router(search_route.router)
app.include_router(agent_route.router)


@app.get("/")
def root():
    return {"message": "API running. Go to /test for UI."}


@app.get("/test", response_class=HTMLResponse)
async def test_page(request: Request):
    """Serve the API tester page."""
    html_path = BASE_DIR / "templates" / "test_api.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text())
    return HTMLResponse("<h1>test_api.html not found</h1>")


@app.get("/agent-test", response_class=HTMLResponse)
async def agent_test_page(request: Request):
    """Serve the Agent Test UI page."""
    html_path = BASE_DIR / "templates" / "agent_test.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text())
    return HTMLResponse("<h1>agent_test.html not found</h1>")


@app.get("/debug", response_class=HTMLResponse)
async def debug_page(request: Request):
    """Serve the Professional Debug Console."""
    html_path = BASE_DIR / "templates" / "agent_debug.html"
    if html_path.exists():
        return HTMLResponse(html_path.read_text())
    return HTMLResponse("<h1>agent_debug.html not found</h1>")


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
