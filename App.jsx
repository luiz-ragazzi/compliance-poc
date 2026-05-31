import { useState, useCallback, useRef } from "react";

const API = "http://localhost:8000";

// ─── Utility ─────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Unknown error");
  }
  return res.json();
}

// ─── Icons ───────────────────────────────────────────────────────────────────

const IconUpload = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const IconChevron = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | "loading" | {ok} | {error}
  const inputRef = useRef();

  const upload = useCallback(async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus({ error: "Please select a valid PDF file." });
      return;
    }
    setStatus("loading");
    const form = new FormData();
    form.append("file", file);
    try {
      const result = await apiFetch("/upload", { method: "POST", body: form });
      setStatus({ ok: result });
      onUploaded(result);
    } catch (e) {
      setStatus({ error: e.message });
    }
  }, [onUploaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files[0]);
  }, [upload]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "36px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "var(--accent-dim)" : "var(--surface)",
          transition: "all 0.18s",
          userSelect: "none",
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={(e) => upload(e.target.files[0])} />
        <div style={{ color: "var(--accent)", marginBottom: 10 }}><IconUpload /></div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)" }}>
          Drop a PDF here or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse</span>
        </div>
      </div>

      {status === "loading" && (
        <StatusBadge type="info">⏳ Extracting text & generating embeddings…</StatusBadge>
      )}
      {status?.ok && (
        <StatusBadge type="success">
          ✓ <strong>{status.ok.filename}</strong> indexed — {status.ok.chunk_count} chunks from {status.ok.total_chars.toLocaleString()} chars
        </StatusBadge>
      )}
      {status?.error && (
        <StatusBadge type="error">✗ {status.error}</StatusBadge>
      )}
    </div>
  );
}

// ─── Documents List ───────────────────────────────────────────────────────────

function DocumentsList({ docs, onDeleted }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (docId) => {
    setDeleting(docId);
    try {
      await apiFetch(`/documents/${docId}`, { method: "DELETE" });
      onDeleted(docId);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  if (!docs.length) return (
    <p style={{ color: "var(--fg-muted)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
      No documents indexed yet.
    </p>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {docs.map((d) => (
        <div key={d.doc_id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "10px 14px", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
            <span style={{ color: "var(--accent)", flexShrink: 0 }}><IconFile /></span>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.filename}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                {d.chunk_count} chunks · {new Date(d.uploaded_at + "Z").toLocaleString()}
              </div>
            </div>
          </div>
          <button
            disabled={deleting === d.doc_id}
            onClick={() => handleDelete(d.doc_id)}
            title="Delete document"
            style={{
              background: "none", border: "1px solid var(--border)",
              borderRadius: 6, padding: "5px 8px", cursor: "pointer",
              color: "var(--fg-muted)", flexShrink: 0,
              opacity: deleting === d.doc_id ? 0.5 : 1,
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e55"; e.currentTarget.style.borderColor = "#e55"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <IconTrash />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Query Panel ──────────────────────────────────────────────────────────────

function QueryPanel() {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setExpanded({});
    try {
      const data = await apiFetch("/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: topK }),
      });
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i) => setExpanded((p) => ({ ...p, [i]: !p[i] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Semantic query
          </label>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="What is this document about?"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 14px 10px 40px",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, color: "var(--fg)", fontSize: 14,
                fontFamily: "inherit", outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)" }}>
              <IconSearch />
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Top-K
          </label>
          <select value={topK} onChange={(e) => setTopK(Number(e.target.value))} style={{
            padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, color: "var(--fg)", fontSize: 14, fontFamily: "inherit", cursor: "pointer",
          }}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button onClick={search} disabled={loading || !query.trim()} style={{
          padding: "10px 20px", background: "var(--accent)", border: "none",
          borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14,
          fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
          opacity: loading || !query.trim() ? 0.5 : 1,
          transition: "opacity 0.15s, transform 0.1s",
          alignSelf: "flex-end",
        }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.transform = "scale(1.03)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
        >
          {loading ? "…" : "Search"}
        </button>
      </div>

      {error && <StatusBadge type="error">✗ {error}</StatusBadge>}

      {/* Results */}
      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
            {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
          </div>
          {results.map((r, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, overflow: "hidden",
            }}>
              <div
                onClick={() => toggle(i)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 16px", cursor: "pointer", gap: 12,
                  background: expanded[i] ? "var(--accent-dim)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                  <ScoreBadge score={r.score} />
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.source} · chunk #{r.chunk_index}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                      {r.chunk.slice(0, 100)}{r.chunk.length > 100 ? "…" : ""}
                    </div>
                  </div>
                </div>
                <IconChevron open={expanded[i]} />
              </div>
              {expanded[i] && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                  <pre style={{
                    margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                    fontSize: 13, lineHeight: 1.7, fontFamily: "var(--font-mono)",
                    color: "var(--fg)", maxHeight: 320, overflowY: "auto",
                  }}>{r.chunk}</pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Small shared components ─────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const pct = Math.round(score * 100);
  const color = score > 0.75 ? "#22c55e" : score > 0.5 ? "#f59e0b" : "#94a3b8";
  return (
    <div style={{
      flexShrink: 0, width: 44, height: 44, borderRadius: 8,
      background: color + "22", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color,
    }}>
      {pct}%
    </div>
  );
}

function StatusBadge({ type, children }) {
  const colors = {
    info: { bg: "#0ea5e922", border: "#0ea5e9", fg: "#0ea5e9" },
    success: { bg: "#22c55e22", border: "#22c55e", fg: "#22c55e" },
    error: { bg: "#ef444422", border: "#ef4444", fg: "#ef4444" },
  };
  const c = colors[type] || colors.info;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: "10px 14px",
      fontSize: 13, color: c.fg, fontFamily: "var(--font-mono)", lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

function Tab({ label, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      padding: "8px 16px", border: "none", background: "none",
      fontFamily: "inherit", fontSize: 14, fontWeight: active ? 700 : 400,
      color: active ? "var(--accent)" : "var(--fg-muted)",
      borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>
      {label}
      {count != null && (
        <span style={{
          marginLeft: 6, background: active ? "var(--accent)" : "var(--border)",
          color: active ? "#fff" : "var(--fg-muted)",
          borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 600,
        }}>{count}</span>
      )}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("upload");
  const [docs, setDocs] = useState([]);
  const [docsLoaded, setDocsLoaded] = useState(false);

  // Load docs when switching to the docs tab
  const switchTab = async (t) => {
    setTab(t);
    if (t === "docs" && !docsLoaded) {
      try {
        const d = await apiFetch("/documents");
        setDocs(d);
        setDocsLoaded(true);
      } catch (_) {}
    }
  };

  const onUploaded = (result) => {
    setDocsLoaded(false); // force refresh next time
  };

  const onDeleted = (docId) => {
    setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

        :root {
          --bg: #0f1117;
          --surface: #1a1d27;
          --border: #2a2d3a;
          --fg: #e8eaf0;
          --fg-muted: #6b7280;
          --accent: #6366f1;
          --accent-dim: #6366f115;
          --font-main: 'Syne', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--bg);
          color: var(--fg);
          font-family: var(--font-main);
          min-height: 100vh;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header style={{
          padding: "24px 32px 0",
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
                PDF<span style={{ color: "var(--accent)" }}>·RAG</span>
              </h1>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 4, padding: "2px 7px",
              }}>POC</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginBottom: 20 }}>
              Upload PDFs → generate embeddings → semantic search
            </p>
            <div style={{ display: "flex", gap: 2 }}>
              <Tab label="Upload" active={tab === "upload"} onClick={() => switchTab("upload")} />
              <Tab label="Documents" active={tab === "docs"} onClick={() => switchTab("docs")} count={docs.length || undefined} />
              <Tab label="Search" active={tab === "search"} onClick={() => switchTab("search")} />
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: "32px", maxWidth: 860, width: "100%", margin: "0 auto" }}>
          {tab === "upload" && (
            <Section title="Index a PDF" subtitle="Text is extracted, split into chunks, embedded with all-MiniLM-L6-v2, and stored in ChromaDB.">
              <UploadZone onUploaded={onUploaded} />
            </Section>
          )}

          {tab === "docs" && (
            <Section title="Indexed Documents" subtitle="All PDFs currently stored in the local vector database.">
              <DocumentsList docs={docs} onDeleted={onDeleted} />
            </Section>
          )}

          {tab === "search" && (
            <Section title="Semantic Search" subtitle="Your query is embedded and matched against all stored chunks by cosine similarity.">
              <QueryPanel />
            </Section>
          )}
        </main>

        {/* Footer */}
        <footer style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)" }}>
            backend · FastAPI + ChromaDB · sentence-transformers/all-MiniLM-L6-v2
          </span>
        </footer>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
