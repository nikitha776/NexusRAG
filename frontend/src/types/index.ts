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
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  document_id: string;
  filename: string;
  chunk_content: string;
  score: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  selected_doc_ids: string[] | null;
  created_at: string;
}
