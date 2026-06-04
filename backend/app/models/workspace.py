from sqlmodel import SQLModel, Field, Relationship
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(foreign_key="users.id", index=True)
    name: str = Field(max_length=255)
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    documents: List["Document"] = Relationship(back_populates="workspace")
    chat_sessions: List["ChatSession"] = Relationship(back_populates="workspace")


class Document(SQLModel, table=True):
    __tablename__ = "documents"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workspace_id: UUID = Field(foreign_key="workspaces.id", index=True)
    filename: str = Field(max_length=500)
    file_path: str
    file_type: str = Field(max_length=50)
    file_size: int
    status: str = Field(default="processing")
    chunk_count: int = Field(default=0)
    metadata_json: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    workspace: Optional[Workspace] = Relationship(back_populates="documents")
    chunks: List["DocumentChunk"] = Relationship(back_populates="document")


class DocumentChunk(SQLModel, table=True):
    __tablename__ = "document_chunks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    document_id: UUID = Field(foreign_key="documents.id", index=True)
    chunk_index: int
    content: str
    token_count: int = Field(default=0)
    metadata_json: Optional[dict] = Field(default=None, sa_column=Column(JSONB))

    document: Optional[Document] = Relationship(back_populates="chunks")


class ChatSession(SQLModel, table=True):
    __tablename__ = "chat_sessions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    workspace_id: UUID = Field(foreign_key="workspaces.id", index=True)
    title: str = Field(default="New Chat", max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    workspace: Optional[Workspace] = Relationship(back_populates="chat_sessions")
    messages: List["ChatMessage"] = Relationship(back_populates="session")


class ChatMessage(SQLModel, table=True):
    __tablename__ = "chat_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    session_id: UUID = Field(foreign_key="chat_sessions.id", index=True)
    role: str
    content: str
    citations: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
    selected_doc_ids: Optional[list] = Field(default=None, sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)

    session: Optional[ChatSession] = Relationship(back_populates="messages")


Document.model_rebuild()
DocumentChunk.model_rebuild()
ChatSession.model_rebuild()
ChatMessage.model_rebuild()
