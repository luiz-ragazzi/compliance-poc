"""
Pydantic models for request/response validation.
"""

from pydantic import BaseModel
from typing import List


class QueryRequest(BaseModel):
    """Request model for semantic search."""
    query: str
    top_k: int = 5


class QueryResult(BaseModel):
    """Individual query result."""
    chunk: str
    source: str
    score: float
    chunk_index: int


class DocumentInfo(BaseModel):
    """Document information in the collection."""
    doc_id: str
    filename: str
    chunk_count: int
    uploaded_at: str
