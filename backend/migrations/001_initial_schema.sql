-- NexusRAG Database Migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    auth_provider VARCHAR(50) DEFAULT 'google' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    filename VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    status VARCHAR(50) DEFAULT 'processing' NOT NULL,
    chunk_count INTEGER DEFAULT 0 NOT NULL,
    metadata_json JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER DEFAULT 0 NOT NULL,
    metadata_json JSONB
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(500) DEFAULT 'New Chat' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    citations JSONB,
    selected_doc_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace_id ON chat_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workspaces" ON workspaces
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = documents.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = documents.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own documents" ON documents
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = documents.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = documents.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own document chunks" ON document_chunks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN workspaces ON workspaces.id = documents.workspace_id
            WHERE documents.id = document_chunks.document_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own document chunks" ON document_chunks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents
            JOIN workspaces ON workspaces.id = documents.workspace_id
            WHERE documents.id = document_chunks.document_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own document chunks" ON document_chunks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM documents
            JOIN workspaces ON workspaces.id = documents.workspace_id
            WHERE documents.id = document_chunks.document_id
            AND workspaces.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_sessions.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can create own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_sessions.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_sessions.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_sessions.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            JOIN workspaces ON workspaces.id = chat_sessions.workspace_id
            WHERE chat_sessions.id = chat_messages.session_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_sessions
            JOIN workspaces ON workspaces.id = chat_sessions.workspace_id
            WHERE chat_sessions.id = chat_messages.session_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update own chat messages" ON chat_messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            JOIN workspaces ON workspaces.id = chat_sessions.workspace_id
            WHERE chat_sessions.id = chat_messages.session_id
            AND workspaces.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM chat_sessions
            JOIN workspaces ON workspaces.id = chat_sessions.workspace_id
            WHERE chat_sessions.id = chat_messages.session_id
            AND workspaces.user_id = auth.uid()
        )
    );
