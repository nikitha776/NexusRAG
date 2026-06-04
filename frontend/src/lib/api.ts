import { createClient } from "@/lib/supabase/client";
import type {
  Workspace,
  Document,
  ChatSession,
  ChatMessage,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI(path: string, options: RequestInit = {}) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  workspaces: {
    list: () => fetchAPI("/api/workspaces/") as Promise<Workspace[]>,
    get: (id: string) => fetchAPI(`/api/workspaces/${id}`) as Promise<Workspace>,
    create: (data: { name: string; description?: string }) =>
      fetchAPI("/api/workspaces/", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<Workspace>,
    update: (id: string, data: { name?: string; description?: string }) =>
      fetchAPI(`/api/workspaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }) as Promise<Workspace>,
    delete: (id: string) =>
      fetchAPI(`/api/workspaces/${id}`, { method: "DELETE" }),
  },

  documents: {
    list: (workspaceId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/`) as Promise<Document[]>,
    upload: async (workspaceId: string, files: File[]) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const res = await fetch(
        `${API_URL}/api/workspaces/${workspaceId}/documents/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(error.detail || `HTTP ${res.status}`);
      }

      return res.json() as Promise<Document[]>;
    },
    get: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}`) as Promise<Document>,
    delete: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}`, {
        method: "DELETE",
      }),
  },

  chat: {
    listSessions: (workspaceId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/chat/sessions`) as Promise<ChatSession[]>,
    createSession: (workspaceId: string, title?: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/chat/sessions`, {
        method: "POST",
        body: JSON.stringify({ title: title || "New Chat" }),
      }) as Promise<ChatSession>,
    listMessages: (workspaceId: string, sessionId: string) =>
      fetchAPI(
        `/api/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`
      ) as Promise<ChatMessage[]>,
    deleteSession: (workspaceId: string, sessionId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/chat/sessions/${sessionId}`, {
        method: "DELETE",
      }),
  },

  rag: {
    query: (
      workspaceId: string,
      data: { query: string; session_id: string; selected_doc_ids: string[] }
    ) =>
      fetchAPI(`/api/workspaces/${workspaceId}/rag/query`, {
        method: "POST",
        body: JSON.stringify(data),
      }) as Promise<ChatMessage>,
  },
};
