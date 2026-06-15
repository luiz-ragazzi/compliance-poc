"""
PDF processing: extraction, chunking, and embedding.
"""

import pypdf
import io
from typing import List
from config import CHUNK_SIZE, CHUNK_OVERLAP
from embedder import get_embedder


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from a PDF binary blob."""
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    pages_text = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages_text.append(text.strip())
    return "\n\n".join(pages_text)


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:
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
    embedder = get_embedder()
    return embedder.encode(chunks)


def process_pdf(file_bytes: bytes) -> tuple[str, List[str], List[List[float]]]:
    """
    Complete PDF processing pipeline: extract → chunk → embed.
    
    Returns:
        Tuple of (extracted_text, chunks, embeddings)
    """
    text = extract_text_from_pdf(file_bytes)
    chunks = chunk_text(text)
    embeddings = embed_chunks(chunks)
    return text, chunks, embeddings
