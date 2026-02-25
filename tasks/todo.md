# Project Roadmap — agents_test

## Phase 1 — Local Chat App ✅
- [x] `backend/state.py` — `AgentState` TypedDict with `add_messages` reducer
- [x] `backend/graph.py` — single `call_model` node, START→call_model→END
- [x] `backend/main.py` — FastAPI + SSE streaming, in-memory session store
- [x] `backend/requirements.txt` — pinned deps
- [x] `frontend/index.html` — chat shell
- [x] `frontend/style.css` — dark theme, streaming cursor
- [x] `frontend/app.js` — fetch + ReadableStream SSE consumer
- [x] `CLAUDE.md` — run instructions added

**Model**: `qwen2.5:7b-instruct` via Ollama at `http://localhost:11434`

## Review
- What changed: created entire Phase 1 from scratch — backend (FastAPI + LangGraph) and frontend (vanilla JS + CSS)
- Files touched: backend/{__init__,state,graph,main}.py, backend/requirements.txt, frontend/{index.html,style.css,app.js}, CLAUDE.md
- Verified by: static review of all files; runtime verification pending (see CLAUDE.md for run steps)

---

## Phase 2 — Tools + MCP
- [ ] Add `execute_tools` node + conditional edge from `call_model`
- [ ] Wrap MCP tools as LangChain tools and bind to the LLM
- [ ] Switch to `astream_events` for tool call visibility in the frontend
- [ ] Show tool call/result events in the UI

---

## Phase 3 — RAG
- [ ] Add `retrieve` node before `call_model`
- [ ] Add `context` field to `AgentState`
- [ ] Wire up a vector store (Chroma or similar, local)
- [ ] Surface retrieved sources in the chat UI

---

## Phase 4 — Observability + Persistent History
- [ ] Integrate Langfuse `CallbackHandler` via config in `graph.astream`
- [ ] Replace in-memory session store with `MemorySaver` checkpointer
- [ ] Pass `thread_id` in config for persistent cross-session history
- [ ] Add tracing dashboard link to the UI

---

## Extension Map

| Phase | Key change |
|-------|-----------|
| 2 — Tools | `execute_tools` node + conditional edge |
| 2 — MCP | MCP tools wrapped as LangChain tools |
| 3 — RAG | `retrieve` node + `context` field in state |
| 4 — Langfuse | `CallbackHandler` in graph config |
| 4 — Persistence | `MemorySaver` checkpointer + `thread_id` |
