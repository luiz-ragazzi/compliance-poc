"""
Configuration and constants for the PDF RAG application.
"""

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "pdf_chunks"
CHUNK_SIZE = 500        # characters per chunk
CHUNK_OVERLAP = 50      # overlap between consecutive chunks
EMBED_MODEL = "all-MiniLM-L6-v2"   # fast, good quality, ~80MB

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
