from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal


class WorkspaceCreate(BaseModel):
    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        if not value.strip():
            raise ValueError("Enter a workspace name")
        return value.strip()

    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Enter a workspace name")
        return value.strip() if value is not None else value

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
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
    error_message: Optional[str] = None
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


class ChatSearchHit(BaseModel):
    id: str
    match_type: Literal["message", "title"]
    message_id: Optional[str] = None
    session_id: str
    title: str
    workspace_id: str
    workspace_name: str
    role: Optional[Literal["user", "assistant"]] = None
    snippet: str
    created_at: str


class ChatSearchCursor(BaseModel):
    messages: int
    titles: int


class ChatSearchResponse(BaseModel):
    results: list[ChatSearchHit]
    next: Optional[ChatSearchCursor] = None


class RAGQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=10000)
    session_id: str
    selected_doc_ids: List[str] = Field(min_length=1, max_length=100)

    @field_validator("query")
    @classmethod
    def nonblank_query(cls, value):
        if not value.strip():
            raise ValueError("Enter a question")
        return value.strip()


class Citation(BaseModel):
    chunk_index: Optional[int] = None
    source_number: Optional[int] = None
    document_id: str
    filename: str
    chunk_content: str
    score: float


class RAGQueryResponse(BaseModel):
    response: str
    citations: List[Citation]


class UploadFailure(BaseModel):
    filename: str
    error: str


class UploadResponse(BaseModel):
    documents: list[DocumentResponse]
    errors: list[UploadFailure]
