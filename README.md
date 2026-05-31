# PDF RAG POC

A minimal full-stack app to upload PDFs, store their embeddings locally, and run semantic search.

```
pdf-rag-poc/
├── backend/
│   ├── main.py           ← FastAPI app
│   └── requirements.txt
└── frontend/
    └── src/
        └── App.jsx       ← React UI (drop into any Vite/CRA project)
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI + Uvicorn |
| PDF parsing | pypdf |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`, runs locally) |
| Vector DB | ChromaDB (persisted to `./chroma_db/`) |
| Frontend | React (JSX) |

---

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

The first startup downloads the embedding model (~80 MB). Subsequent starts are instant.

API docs available at http://localhost:8000/docs

---

## Frontend setup

Scaffold a Vite React project (skip if you already have one):

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

Copy `src/App.jsx` into the project, replacing the default one, then:

```bash
npm run dev   # starts on http://localhost:3000
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/upload` | Upload a PDF (multipart/form-data, field `file`) |
| `GET` | `/documents` | List all indexed documents |
| `DELETE` | `/documents/{doc_id}` | Remove a document and all its chunks |
| `POST` | `/query` | Semantic search `{ query, top_k }` |
| `GET` | `/health` | Health check + total chunk count |

---

## Configuration

Edit the constants at the top of `main.py`:

```python
CHROMA_PATH   = "./chroma_db"   # where ChromaDB persists data
CHUNK_SIZE    = 500             # characters per chunk
CHUNK_OVERLAP = 50              # overlap between consecutive chunks
EMBED_MODEL   = "all-MiniLM-L6-v2"
```

---

## Notes

- Scanned / image-only PDFs will fail (no extractable text layer). Use an OCR pre-processor like `pytesseract` or `ocrmypdf` first.
- The embedding model runs fully locally — no API key required.
- ChromaDB uses cosine similarity. Scores in the UI are `1 − distance` (1 = identical).
- For production use, swap ChromaDB for Qdrant/Weaviate/pgvector and `sentence-transformers` for an OpenAI/Cohere embedding API.
