import json
import uuid
from collections.abc import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, HumanMessage
from pydantic import BaseModel

from backend.graph import graph

app = FastAPI(title="Local Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store: session_id -> list of LangChain messages
sessions: dict[str, list] = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str


def sse_event(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def stream_response(session_id: str, user_message: str) -> AsyncGenerator[str, None]:
    history = sessions.get(session_id, [])
    messages = history + [HumanMessage(content=user_message)]

    full_content = ""
    try:
        async for chunk, _metadata in graph.astream(
            {"messages": messages},
            stream_mode="messages",
        ):
            token = chunk.content
            if token:
                full_content += token
                yield sse_event({"type": "token", "content": token})

        # Only persist history after the full stream completes successfully
        sessions[session_id] = messages + [AIMessage(content=full_content)]
        yield sse_event({"type": "done", "content": ""})

    except Exception as exc:
        yield sse_event({"type": "error", "content": str(exc)})


@app.post("/session")
def create_session() -> dict:
    session_id = str(uuid.uuid4())
    sessions[session_id] = []
    return {"session_id": session_id}


@app.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    return StreamingResponse(
        stream_response(request.session_id, request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "sessions": len(sessions)}
