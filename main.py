"""
PDF RAG POC - FastAPI Backend
Uploads PDFs, extracts text, generates embeddings via sentence-transformers,
and stores them in a local ChromaDB vector database.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import pypdf
import io
import uuid
import os
import json
from typing import List, Optional
from datetime import datetime

# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="PDF RAG POC", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Config ──────────────────────────────────────────────────────────────────

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "pdf_chunks"
CHUNK_SIZE = 500        # characters per chunk
CHUNK_OVERLAP = 50      # overlap between consecutive chunks
EMBED_MODEL = "all-MiniLM-L6-v2"   # fast, good quality, ~80MB

# ─── Singletons (loaded once at startup) ─────────────────────────────────────

print("Loading embedding model...")
embedder = SentenceTransformer(EMBED_MODEL)

print("Connecting to ChromaDB...")
chroma_client = chromadb.PersistentClient(
    path=CHROMA_PATH,
    settings=Settings(anonymized_telemetry=False),
)
collection = chroma_client.get_or_create_collection(
    name=COLLECTION_NAME,
    metadata={"hnsw:space": "cosine"},
)
print("Ready.")

# ─── Helpers ─────────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF binary blob."""
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages_text.append(text.strip())
    return "\n\n".join(pages_text)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping fixed-size character chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end].strip())
        start += chunk_size - overlap
    return [c for c in chunks if c]  # drop empty


def embed_chunks(chunks: List[str]) -> List[List[float]]:
    """Generate embeddings for a list of text chunks."""
    return embedder.encode(chunks, show_progress_bar=False).tolist()


# ─── Schemas ─────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str
    top_k: int = 5


class QueryResult(BaseModel):
    chunk: str
    source: str
    score: float
    chunk_index: int


class DocumentInfo(BaseModel):
    doc_id: str
    filename: str
    chunk_count: int
    uploaded_at: str


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "message": "PDF RAG POC backend running"}


@app.get("/health")
def health():
    total = collection.count()
    return {"status": "ok", "total_chunks": total}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a PDF → extract text → chunk → embed → store in ChromaDB.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Extract text
    try:
        text = extract_text_from_pdf(contents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No extractable text found in PDF (scanned/image-only?).")

    # Chunk
    chunks = chunk_text(text)
    if not chunks:
        raise HTTPException(status_code=422, detail="Text chunking produced no results.")

    # Embed
    embeddings = embed_chunks(chunks)

    # Persist to ChromaDB
    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.utcnow().isoformat()

    ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": file.filename,
            "chunk_index": i,
            "uploaded_at": uploaded_at,
        }
        for i in range(len(chunks))
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "chunk_count": len(chunks),
        "total_chars": len(text),
        "uploaded_at": uploaded_at,
    }


@app.post("/query", response_model=List[QueryResult])
def query(req: QueryRequest):
    """
    Semantic search: embed the query and return top-k similar chunks.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if collection.count() == 0:
        raise HTTPException(status_code=404, detail="No documents indexed yet. Upload a PDF first.")

    query_embedding = embedder.encode([req.query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(req.top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for doc, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        output.append(
            QueryResult(
                chunk=doc,
                source=meta.get("filename", "unknown"),
                score=round(1 - dist, 4),   # cosine similarity (1 = identical)
                chunk_index=meta.get("chunk_index", -1),
            )
        )

    return output


@app.get("/documents", response_model=List[DocumentInfo])
def list_documents():
    """
    Return a deduplicated list of indexed documents.
    """
    if collection.count() == 0:
        return []

    # Fetch all metadata
    results = collection.get(include=["metadatas"])
    docs: dict[str, DocumentInfo] = {}

    for meta in results["metadatas"]:
        doc_id = meta.get("doc_id", "unknown")
        if doc_id not in docs:
            docs[doc_id] = {
                "doc_id": doc_id,
                "filename": meta.get("filename", "unknown"),
                "chunk_count": 1,
                "uploaded_at": meta.get("uploaded_at", ""),
            }
        else:
            docs[doc_id]["chunk_count"] += 1

    return list(docs.values())


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    """
    Delete all chunks belonging to a specific document.
    """
    results = collection.get(where={"doc_id": doc_id}, include=["metadatas"])
    ids_to_delete = results["ids"]

    if not ids_to_delete:
        raise HTTPException(status_code=404, detail=f"No document found with id '{doc_id}'.")

    collection.delete(ids=ids_to_delete)
    return {"deleted": len(ids_to_delete), "doc_id": doc_id}
