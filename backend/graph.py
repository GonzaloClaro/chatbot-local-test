from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph

from backend.state import AgentState

MODEL_NAME = "qwen2.5:7b-instruct"
OLLAMA_BASE_URL = "http://localhost:11434"

llm = ChatOllama(model=MODEL_NAME, base_url=OLLAMA_BASE_URL)


async def call_model(state: AgentState, config: RunnableConfig | None = None) -> AgentState:
    response = await llm.ainvoke(state["messages"], config=config)
    return {"messages": [response]}


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("call_model", call_model)
    graph.add_edge(START, "call_model")
    graph.add_edge("call_model", END)
    return graph.compile()


graph = build_graph()
