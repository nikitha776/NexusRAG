import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import { useAppStore } from "@/store";
import { api } from "@/lib/api";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), deferredPathname: null as string | null }));
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useRouter: () => navigation,
    usePathname: () => useSyncExternalStore(
      (callback) => {
        window.addEventListener("popstate", callback);
        window.addEventListener("next-history-change", callback);
        return () => { window.removeEventListener("popstate", callback); window.removeEventListener("next-history-change", callback); };
      },
      () => navigation.deferredPathname ?? window.location.pathname,
    ),
  };
});
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/lib/api", () => ({ api: {
  workspaces: { get: vi.fn() }, documents: { list: vi.fn(), upload: vi.fn() },
  chat: { listSessions: vi.fn(), listMessages: vi.fn(), createSession: vi.fn() },
  rag: { query: vi.fn(), stream: vi.fn() },
} }));
vi.mock("@/components/documents/document-manager", () => ({ DocumentManager: () => <div>Document library</div> }));
vi.mock("@/components/documents/file-selector", () => ({ FileSelector: () => null }));
vi.mock("@/components/chat/chat-sidebar", () => ({
  ChatSidebar: ({ activeSessionId, onSessionSelect }: { activeSessionId: string | null; onSessionSelect: (id: string | null) => void }) => <div>
    <span>Active session: {activeSessionId || "none"}</span>
    <button onClick={() => onSessionSelect(null)}>New Chat</button>
    <button onClick={() => onSessionSelect(activeSessionId)}>Current chat</button>
    <button onClick={() => onSessionSelect("earlier")}>Earlier chat</button>
  </div>,
}));

const workspace = { id: "w", name: "Research", description: null, document_count: 1, created_at: "", updated_at: "" };
const doc = { id: "d", filename: "source.txt", status: "ready" as const, file_type: "txt", file_size: 10, chunk_count: 1, created_at: "" };
const session = { id: "saved", title: "Summarize", created_at: "2026-01-01", updated_at: "2026-01-01" };
const answer = { id: "answer-1", role: "assistant" as const, content: "First answer", citations: [], selected_doc_ids: ["d"], created_at: "2026-01-01" };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  navigation.deferredPathname = null;
  window.history.replaceState(null, "", "/workspace/w");
  // Simulate Next.js's documented integration of native history with usePathname.
  const replaceState = window.history.replaceState.bind(window.history);
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    replaceState(data, unused, url);
    window.dispatchEvent(new Event("next-history-change"));
  });
  const pushState = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    pushState(data, unused, url);
    window.dispatchEvent(new Event("next-history-change"));
  });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  useAppStore.setState({ activeWorkspace: workspace, documents: [doc], selectedDocIds: new Set(["d"]), chatSessions: [] });
  vi.mocked(api.workspaces.get).mockResolvedValue(workspace);
  vi.mocked(api.documents.list).mockResolvedValue([doc]);
  vi.mocked(api.chat.listSessions).mockResolvedValue([]);
  vi.mocked(api.chat.listMessages).mockResolvedValue([]);
  vi.mocked(api.chat.createSession).mockResolvedValue(session);
  vi.mocked(api.rag.query).mockResolvedValue(answer);
  vi.mocked(api.rag.stream).mockImplementation(async (workspace, data, onEvent) => {
    const message = await api.rag.query(workspace, data);
    onEvent({ type: "done", message });
  });
});

it("keeps the first answer mounted while saving its URL and sending follow-ups", async () => {
  render(<WorkspaceView workspaceId="w" />);
  const composer = await screen.findByRole("textbox", { name: "Your question" });
  fireEvent.change(composer, { target: { value: "Summarize" } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
  const firstAnswer = await screen.findByText("First answer");
  await screen.findByText("Active session: saved");

  expect(window.location.pathname).toBe("/workspace/w/chat/saved");
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(navigation.push).not.toHaveBeenCalled();
  expect(api.chat.listMessages).not.toHaveBeenCalled();
  expect(screen.getByRole("textbox", { name: "Your question" })).toBe(composer);
  expect(api.workspaces.get).toHaveBeenCalledTimes(1);

  vi.mocked(api.rag.query).mockResolvedValue({ ...answer, id: "answer-2", content: "Follow-up answer" });
  fireEvent.change(composer, { target: { value: "Explain further" } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
  await screen.findByText("Follow-up answer");

  expect(screen.getByText("First answer")).toBe(firstAnswer);
  expect(api.chat.createSession).toHaveBeenCalledTimes(1);
  expect(api.rag.query).toHaveBeenLastCalledWith("w", expect.objectContaining({ session_id: "saved" }));
  expect(useAppStore.getState().chatSessions).toHaveLength(1);
  expect(window.history.replaceState).toHaveBeenCalledTimes(1);
  expect(api.chat.listMessages).not.toHaveBeenCalled();
  expect(api.workspaces.get).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Current chat" }));
  expect(navigation.push).not.toHaveBeenCalled();
});

it("allows New Chat to reset an unsaved draft on the workspace route", async () => {
  render(<WorkspaceView workspaceId="w" />);
  const composer = await screen.findByRole("textbox", { name: "Your question" });
  fireEvent.change(composer, { target: { value: "An unsent draft" } });
  fireEvent.click(screen.getByRole("button", { name: "New Chat" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Your question" })).toHaveValue(""));
  expect(api.chat.createSession).not.toHaveBeenCalled();
  expect(navigation.push).not.toHaveBeenCalled();
});

it("opens New Chat immediately even when the pathname hook still reports the saved conversation", async () => {
  window.history.replaceState(null, "", "/workspace/w/chat/saved");
  vi.mocked(api.chat.listMessages).mockResolvedValue([answer]);
  render(<WorkspaceView workspaceId="w" sessionId="saved" />);
  await screen.findByText("First answer");
  navigation.deferredPathname = "/workspace/w/chat/saved";
  fireEvent.click(screen.getByRole("button", { name: "New Chat" }));
  expect(window.location.pathname).toBe("/workspace/w");
  expect(screen.getByRole("textbox", { name: "Your question" })).toBeEnabled();
  expect(screen.queryByText("Loading conversation…")).not.toBeInTheDocument();
  expect(screen.queryByText("First answer")).not.toBeInTheDocument();
  expect(api.chat.listMessages).toHaveBeenCalledTimes(1);
  act(() => { navigation.deferredPathname = null; window.dispatchEvent(new Event("next-history-change")); });
  expect(screen.getByRole("textbox", { name: "Your question" })).toBeEnabled();
  expect(api.chat.createSession).not.toHaveBeenCalled();
});

it("counts all workspace documents in Sources regardless of chat selection", async () => {
  vi.mocked(api.documents.list).mockResolvedValue([doc, { ...doc, id: "processing", status: "processing" }]);
  render(<WorkspaceView workspaceId="w" />);
  await screen.findByRole("button", { name: "Sources 2" });
  act(() => useAppStore.getState().deselectAllDocs());
  expect(screen.getByRole("button", { name: "Sources 2" })).toBeInTheDocument();
  act(() => useAppStore.getState().addDocuments([{ ...doc, id: "new" }]));
  expect(screen.getByRole("button", { name: "Sources 3" })).toBeInTheDocument();
  act(() => useAppStore.getState().removeDocument("new"));
  expect(screen.getByRole("button", { name: "Sources 2" })).toBeInTheDocument();
});

it("loads another conversation and restores the saved chat with browser Back", async () => {
  vi.mocked(api.chat.listMessages).mockImplementation(async (_workspace, id) => id === "saved"
    ? [answer]
    : [{ ...answer, id: "old-answer", content: "Earlier answer" }]);
  render(<WorkspaceView workspaceId="w" />);
  const composer = await screen.findByRole("textbox", { name: "Your question" });
  fireEvent.change(composer, { target: { value: "Summarize" } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
  await screen.findByText("First answer");
  fireEvent.click(screen.getByRole("button", { name: "Earlier chat" }));
  await screen.findByText("Earlier answer");
  expect(window.location.pathname).toBe("/workspace/w/chat/earlier");
  expect(screen.queryByText("First answer")).not.toBeInTheDocument();
  window.history.back();
  await screen.findByText("First answer");
  expect(window.location.pathname).toBe("/workspace/w/chat/saved");
  expect(screen.queryByText("Earlier answer")).not.toBeInTheDocument();
  expect(api.workspaces.get).toHaveBeenCalledTimes(1);
});


it("uploads from the composer, preserves the draft, updates the count, and opens Sources", async () => {
  vi.mocked(api.documents.upload).mockResolvedValue({ documents: [{ ...doc, id: "new", status: "processing" }], errors: [] });
  render(<WorkspaceView workspaceId="w" />);
  const composer = await screen.findByRole("textbox", { name: "Your question" });
  fireEvent.change(composer, { target: { value: "Keep this draft" } });
  expect(screen.queryByText("Document library")).not.toBeInTheDocument();
  const file = new File(["Evidence"], "new.txt", { type: "text/plain" });
  fireEvent.change(screen.getByLabelText("Choose documents to upload"), { target: { files: [file] } });
  await screen.findByText("Document library");
  expect(screen.getByRole("button", { name: "Sources 2" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your question" })).toBe(composer);
  expect(composer).toHaveValue("Keep this draft");
  expect(api.chat.createSession).not.toHaveBeenCalled();
});
