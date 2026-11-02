export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
}

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: "processing" | "ready" | "error";
  chunk_count: number;
  error_message?: string | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned?: boolean;
  isTemporary?: boolean;
}

export interface Citation {
  chunk_index?: number | null;
  source_number?: number;
  document_id: string;
  filename: string;
  chunk_content: string;
  score: number;
}

export interface DocumentPreview {
  file_type?: string;
  id: string;
  filename: string;
  chunks: { chunk_index: number; content: string }[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  selected_doc_ids: string[] | null;
  created_at: string;
}

export interface ChatSearchHit {
  id: string;
  match_type: "message" | "title";
  message_id: string | null;
  session_id: string;
  title: string;
  workspace_id: string;
  workspace_name: string;
  role: "user" | "assistant" | null;
  snippet: string;
  created_at: string;
}

export interface ChatSearchCursor { messages: number; titles: number }
export interface ChatSearchResponse { results: ChatSearchHit[]; next: ChatSearchCursor | null }
