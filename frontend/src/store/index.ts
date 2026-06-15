import { create } from "zustand";
import type { Workspace, Document, ChatSession, ChatMessage } from "@/types";

interface AppState {
  workspaces: Workspace[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace | null) => void;

  documents: Document[];
  setDocuments: (documents: Document[]) => void;
  addDocuments: (documents: Document[]) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;

  selectedDocIds: Set<string>;
  toggleDocSelection: (id: string) => void;
  selectAllDocs: () => void;
  deselectAllDocs: () => void;

  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  chatSessions: ChatSession[];
  setChatSessions: (sessions: ChatSession[]) => void;
  addChatSession: (session: ChatSession) => void;
  removeChatSession: (id: string) => void;
  updateChatSession: (id: string, updates: Partial<ChatSession>) => void;
  replaceChatSession: (tempId: string, session: ChatSession) => void;

  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;

  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  workspaces: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  activeWorkspace: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  documents: [],
  setDocuments: (documents) => set({ documents }),
  addDocuments: (newDocs) =>
    set((state) => ({ documents: [...newDocs, ...state.documents] })),
  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      selectedDocIds: (() => {
        const newSet = new Set(state.selectedDocIds);
        newSet.delete(id);
        return newSet;
      })(),
    })),
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),

  selectedDocIds: new Set(),
  toggleDocSelection: (id) =>
    set((state) => {
      const newSet = new Set(state.selectedDocIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedDocIds: newSet };
    }),
  selectAllDocs: () =>
    set((state) => ({
      selectedDocIds: new Set(
        state.documents.filter((d) => d.status === "ready").map((d) => d.id)
      ),
    })),
  deselectAllDocs: () => set({ selectedDocIds: new Set() }),

  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  chatSessions: [],
  setChatSessions: (sessions) => set({ chatSessions: sessions }),
  addChatSession: (session) =>
    set((state) => ({ chatSessions: [session, ...state.chatSessions] })),
  removeChatSession: (id) =>
    set((state) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== id),
    })),
  updateChatSession: (id, updates) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),
  replaceChatSession: (tempId, session) =>
    set((state) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === tempId ? session : s
      ),
    })),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
