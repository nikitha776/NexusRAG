import { createClient } from "@/lib/supabase/client";
import type {
  Workspace,
  Document,
  ChatSession,
  ChatMessage,
  Citation,
  DocumentPreview,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI(path: string, options: RequestInit = {}, raw = false) {
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

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    if (options.signal?.aborted) throw err;
    const message =
      err instanceof TypeError && err.message === "Failed to fetch"
        ? `Cannot reach server at ${API_URL}. Is the backend running?`
        : err instanceof Error
        ? err.message
        : "Network error";
    throw new Error(message);
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      // Clear the entire in-memory workspace state when authentication expires.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }));
    const detail = error.detail;
    throw new Error(typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((item: { msg?: string }) => item.msg || "Invalid input").join("; ") : `Request failed (${res.status})`);
  }

  return raw ? res : res.json();
}

export type AnswerEvent =
  | { type: "token"; text: string }
  | { type: "sources"; citations: Citation[] }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; detail: string };

export async function readAnswerStream(response: Response, onEvent: (event: AnswerEvent) => void) {
  if (!response.body) throw new Error("Streaming is unavailable. Please retry.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", complete = false;
  const parse = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as AnswerEvent;
    if (event.type === "error") throw new Error(event.detail);
    if (event.type === "done") complete = true;
    onEvent(event);
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      lines.forEach(parse);
      if (done) break;
    }
    parse(buffer);
    if (!complete) throw new Error("The connection ended before the answer was saved. Please retry.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
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
    file: async (workspaceId: string, docId: string, signal?: AbortSignal) => {
      const response = await fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}/file`, { signal }, true) as Response;
      return new Uint8Array(await response.arrayBuffer());
    },
    preview: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}/preview`) as Promise<DocumentPreview>,
    list: (workspaceId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/`) as Promise<Document[]>,
    upload: async (workspaceId: string, files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      return fetchAPI(`/api/workspaces/${workspaceId}/documents/`, {
        method: "POST", body: formData,
      }) as Promise<{ documents: Document[]; errors: { filename: string; error: string }[] }>;
    },
    get: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}`) as Promise<Document>,
    delete: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}`, {
        method: "DELETE",
      }),
    reprocess: (workspaceId: string, docId: string) =>
      fetchAPI(`/api/workspaces/${workspaceId}/documents/${docId}/reprocess`, {
        method: "POST",
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
    updateSession: (workspaceId: string, sessionId: string, data: { title?: string; pinned?: boolean }) =>
      fetchAPI(`/api/workspaces/${workspaceId}/chat/sessions/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }) as Promise<ChatSession>,
  },

  rag: {
    stream: async (
      workspaceId: string,
      data: { query: string; session_id: string; selected_doc_ids: string[] },
      onEvent: (event: AnswerEvent) => void,
      signal: AbortSignal,
    ) => {
      const response = await fetchAPI(`/api/workspaces/${workspaceId}/rag/stream`, {
        method: "POST", body: JSON.stringify(data), signal,
      }, true) as Response;
      await readAnswerStream(response, onEvent);
    },
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
