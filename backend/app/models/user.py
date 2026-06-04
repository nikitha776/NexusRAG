from sqlmodel import SQLModel, Field
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(unique=True, index=True)
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_provider: str = Field(default="google")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
