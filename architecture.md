# Architecture Evolution

This document tracks how the system's architecture changes across phases.
Each phase is a new section — nothing is deleted, so you can compare them and study the progression.

---

## Phase 1 — Local Chat with Streaming

### Goal
A working chat UI that streams tokens from a local LLM. No tools, no memory persistence, no external services. The graph has a single node, but it's already wired as a LangGraph graph so future phases just add nodes and edges.

---

### Component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (frontend/)                                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  app.js                                                 │   │
│  │                                                         │   │
│  │  1. POST /session  ──────────────────────────────────►  │   │
│  │  2. POST /chat  (JSON body)  ────────────────────────►  │   │
│  │  3. ReadableStream reader  ◄─── SSE token chunks ─────  │   │
│  │  4. bubble.textContent +=  token                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (localhost:8000)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI  (backend/main.py)                                     │
│                                                                 │
│  POST /session  →  creates UUID, stores [] in sessions dict     │
│  POST /chat     →  StreamingResponse (text/event-stream)        │
│  GET  /health   →  {"status":"ok","sessions":N}                 │
│                                                                 │
│  sessions: dict[str, list[BaseMessage]]   ← in-memory store     │
│                                                                 │
│  stream_response()                                              │
│    build messages = history + HumanMessage(new)                 │
│    async for chunk, _ in graph.astream(..., "messages"):        │
│      yield SSE token                                            │
│    sessions[id] = messages + AIMessage(full)   ← only on done  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Python function call
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  LangGraph  (backend/graph.py)                                  │
│                                                                 │
│   ┌───────┐     ┌────────────────┐     ┌─────┐                 │
│   │ START │────►│  call_model    │────►│ END │                 │
│   └───────┘     └────────┬───────┘     └─────┘                 │
│                          │ llm.ainvoke(messages)                │
│                          ▼                                      │
│              ChatOllama (langchain-ollama)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (localhost:11434)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ollama                                                         │
│  Model: qwen2.5:7b-instruct                                     │
│  Runs entirely on local hardware — no internet required         │
└─────────────────────────────────────────────────────────────────┘
```

---

### Data flow (one turn)

```
User types "Hello"
    │
    ▼
app.js  POST /chat  {"session_id": "...", "message": "Hello"}
    │
    ▼
main.py  builds:  [HumanMessage("Hello")]   (no prior history)
    │
    ▼
graph.astream({"messages": [HumanMessage("Hello")]}, stream_mode="messages")
    │
    ▼
call_model node  →  ChatOllama.ainvoke()  →  Ollama HTTP stream
    │
    │   yields AIMessageChunk("Hi") ... AIMessageChunk(" there") ...
    ▼
main.py  →  yield  data: {"type":"token","content":"Hi"}\n\n
             yield  data: {"type":"token","content":" there"}\n\n
             ...
             sessions[id] = [..., AIMessage("Hi there")]   ← after stream ends
             yield  data: {"type":"done","content":""}\n\n
    │
    ▼
app.js  ReadableStream reader  →  splits on \n\n  →  appends to bubble
```

---

### State shape (Phase 1)

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    # add_messages is a reducer: appends new messages instead of replacing
```

Only one field. The `add_messages` reducer is what makes LangGraph accumulate conversation turns correctly — each node returns only the *new* messages, and LangGraph merges them into the running list.

---

### Key design decisions

| Decision | What was chosen | Why |
|----------|----------------|-----|
| Agent framework | LangGraph | Graph structure makes it easy to add nodes (tools, RAG) later without restructuring |
| Streaming | `graph.astream(stream_mode="messages")` | Yields `(AIMessageChunk, metadata)` — simple for token streaming; `astream_events` adds complexity needed only when tool calls must be surfaced |
| SSE transport | `fetch` + `ReadableStream` (not `EventSource`) | `EventSource` only supports GET; we need POST to send the message body |
| History persistence | Only after stream completes | Prevents storing partial/corrupt messages if the user cancels mid-stream |
| Session store | `dict` in memory | Simplest possible; replaced by `MemorySaver` checkpointer in Phase 4 |
| LLM | Ollama (local) | Zero cost, zero data leaves the machine |

---

### File map

```
backend/
  state.py    →  AgentState TypedDict
  graph.py    →  LangGraph graph (build_graph + compiled graph singleton)
  main.py     →  FastAPI app, SSE generator, session store
  requirements.txt

frontend/
  index.html  →  shell (header, messages area, input form)
  style.css   →  dark theme, streaming cursor animation (▋)
  app.js      →  session lifecycle, SSE consumer, auto-resize textarea
```

---

### What this phase does NOT have (by design)

- No tool calling
- No MCP
- No vector store / RAG
- No observability (Langfuse, LangSmith)
- No persistent history (sessions are lost on server restart)
- No authentication

Each of these is added in a future phase as a targeted change, not a rewrite.

---
<!-- Phase 2 will be added here -->
