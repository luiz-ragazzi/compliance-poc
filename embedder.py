"""
Embedding model management.
"""

from sentence_transformers import SentenceTransformer
from typing import List
from config import EMBED_MODEL


class EmbedderManager:
    """Singleton manager for sentence-transformers embedder."""
    
    _instance = None
    _embedder = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            print("Loading embedding model...")
            cls._embedder = SentenceTransformer(EMBED_MODEL)
            print("Embedding model loaded.")
        return cls._instance
    
    def encode(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for text chunks."""
        return self._embedder.encode(texts, show_progress_bar=False).tolist()


def get_embedder() -> EmbedderManager:
    """Get or create the embedder singleton."""
    return EmbedderManager()
