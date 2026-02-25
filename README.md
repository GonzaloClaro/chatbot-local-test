# chatbot-local-test

A local chat application built with **LangGraph + FastAPI + Ollama**. Runs 100% on your machine — no API keys, no cloud, no cost.

Architected to grow incrementally: each phase adds capabilities (tools, RAG, observability) without restructuring what came before.

---

## Stack

| Layer | Tech |
|-------|------|
| LLM | `qwen2.5:7b-instruct` via [Ollama](https://ollama.ai) |
| Agent | [LangGraph](https://github.com/langchain-ai/langgraph) |
| Backend | [FastAPI](https://fastapi.tiangolo.com) + SSE streaming |
| Frontend | Vanilla HTML/CSS/JS |

---

## Phases

- [x] **Phase 1** — Local chat with streaming and conversation history
- [ ] **Phase 2** — Tools + MCP integration
- [ ] **Phase 3** — RAG (local vector store)
- [ ] **Phase 4** — Observability (Langfuse) + persistent history

---

## Phase 1 — Quick start

### Prerequisites

- Python 3.10+
- [Ollama](https://ollama.ai) installed

```bash
# Pull the model (one-time)
ollama pull qwen2.5:7b-instruct
```

### Backend

```bash
# Terminal 1 — make sure Ollama is running
ollama serve

# Terminal 2 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
# Just open the file directly
open frontend/index.html

# Or serve it on a port
python -m http.server 3000 --directory frontend
```

### Verify it works

```bash
curl http://localhost:8000/health
# {"status": "ok", "sessions": 0}
```

---

## Project structure

```
├── backend/
│   ├── state.py        # AgentState TypedDict (LangGraph)
│   ├── graph.py        # LangGraph graph — single call_model node
│   ├── main.py         # FastAPI app, SSE streaming, session store
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js          # fetch + ReadableStream SSE consumer
└── README.md
```

---

## How streaming works

```
Browser ──POST /chat──► FastAPI ──► LangGraph.astream() ──► Ollama
                                         │
                          token chunks ◄─┘
                               │
        SSE  data: {"type":"token","content":"..."}
        ◄──────────────────────────────────────────
```

The browser consumes the SSE stream manually via `fetch` + `ReadableStream` (not `EventSource`, which only supports GET). Tokens are appended to the chat bubble as they arrive.
