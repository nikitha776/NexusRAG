from pydantic import BaseModel
from typing import Optional, List


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: str
    updated_at: str
    document_count: int = 0


class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    status: str
    chunk_count: int
    created_at: str


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    pinned: bool = False


class ChatSessionUpdate(BaseModel):
    title: Optional[str] = None
    pinned: Optional[bool] = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    citations: Optional[list] = None
    selected_doc_ids: Optional[list] = None
    created_at: str


class RAGQueryRequest(BaseModel):
    query: str
    session_id: str
    selected_doc_ids: List[str]


class Citation(BaseModel):
    document_id: str
    filename: str
    chunk_content: str
    score: float


class RAGQueryResponse(BaseModel):
    response: str
    citations: List[Citation]
