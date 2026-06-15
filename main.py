"""
PDF RAG POC - FastAPI Backend
Uploads PDFs, extracts text, generates embeddings via sentence-transformers,
and stores them in a local ChromaDB vector database.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import List
from datetime import datetime

from config import CORS_ORIGINS
from embedder import get_embedder
from database import get_database
from pdf_processor import process_pdf
from models import QueryRequest, QueryResult, DocumentInfo

# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="PDF RAG POC", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize singletons at startup
db = get_database()
embedder = get_embedder()


@app.get("/")
def root():
    return {"status": "ok", "message": "PDF RAG POC backend running"}


@app.get("/health")
def health():
    total = db.count()
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

    # Process PDF: extract → chunk → embed
    try:
        text, chunks, embeddings = process_pdf(contents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {e}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No extractable text found in PDF (scanned/image-only?).")

    if not chunks:
        raise HTTPException(status_code=422, detail="Text chunking produced no results.")

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

    db.add_documents(
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

    if db.count() == 0:
        raise HTTPException(status_code=404, detail="No documents indexed yet. Upload a PDF first.")

    query_embedding = embedder.encode([req.query])

    results = db.query(
        query_embeddings=query_embedding,
        n_results=min(req.top_k, db.count()),
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
    if db.count() == 0:
        return []

    # Fetch all metadata
    metadatas = db.get_all_metadata()
    docs: dict[str, DocumentInfo] = {}

    for meta in metadatas:
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
    deleted_count = db.delete_by_doc_id(doc_id)

    if not deleted_count:
        raise HTTPException(status_code=404, detail=f"No document found with id '{doc_id}'.")

    return {"deleted": deleted_count, "doc_id": doc_id}
