import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInterface } from "@/components/chat/chat-interface";
import { useAppStore } from "@/store";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types";
vi.mock("@/lib/api", () => ({ api: { chat: { createSession: vi.fn(), listMessages: vi.fn() }, rag: { query: vi.fn(), stream: vi.fn() } } }));
const doc = { id: "d", filename: "report.txt", status: "ready" as const, file_size: 10, file_type: "txt", chunk_count: 1, created_at: "2026-01-01" };
const session = { id: "new-session", title: "New chat", created_at: "2026-01-01", updated_at: "2026-01-01" };
const response: ChatMessage = { id: "answer", role: "assistant", content: "An answer", citations: [], selected_doc_ids: ["d"], created_at: "2026-01-01" };
beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ documents: [doc], selectedDocIds: new Set(["d"]), chatSessions: [] });
  vi.mocked(api.chat.listMessages).mockResolvedValue([]);
  vi.mocked(api.chat.createSession).mockResolvedValue(session);
  vi.mocked(api.rag.query).mockResolvedValue(response);
  vi.mocked(api.rag.stream).mockImplementation(async (workspace, data, onEvent) => {
    const message = await api.rag.query(workspace, data);
    onEvent({ type: "done", message });
  });
});
function send(text = "Summarize this") {
  fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
}
describe("chat failure and navigation", () => {
  it("does not keep loading history when the active session becomes a new chat", async () => {
    let resolve!: (messages: ChatMessage[]) => void;
    vi.mocked(api.chat.listMessages).mockReturnValue(new Promise((r) => { resolve = r; }));
    const view = render(<ChatInterface workspaceId="w" sessionId="old" />);
    expect(screen.getByRole("textbox", { name: "Your question" })).toBeDisabled();
    view.rerender(<ChatInterface workspaceId="w" sessionId={null} />);
    expect(screen.queryByText("Loading conversation…")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your question" })).toBeEnabled();
    await act(async () => resolve([{ ...response, content: "Stale history" }]));
    expect(screen.queryByText("Stale history")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Your question" })).toBeEnabled();
  });
  it("shows streaming text and lets Stop restore the question without saving a partial answer", async () => {
    vi.mocked(api.rag.stream).mockImplementation(async (_workspace, _data, onEvent, signal) => {
      onEvent({ type: "token", text: "Answer in progress" });
      await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }));
    });
    render(<ChatInterface workspaceId="w" sessionId={null} />);
    send();
    await screen.findByText("Answer in progress");
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Generation stopped");
    expect(screen.getByRole("textbox")).toHaveValue("Summarize this");
    expect(screen.queryByText("Answer in progress")).not.toBeInTheDocument();
  });
  it("restores the draft and allows retry after session creation fails", async () => {
    vi.mocked(api.chat.createSession).mockRejectedValueOnce(new Error("Creation unavailable"));
    render(<ChatInterface workspaceId="w" sessionId={null} />);
    send();
    expect(await screen.findByRole("alert")).toHaveTextContent("Creation unavailable");
    expect(screen.getByRole("textbox")).toHaveValue("Summarize this");
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    expect(await screen.findByText("An answer")).toBeInTheDocument();
    expect(api.chat.createSession).toHaveBeenCalledTimes(2);
  });
  it("locks submission while the first session is being created", async () => {
    let resolve!: (value: typeof session) => void;
    vi.mocked(api.chat.createSession).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ChatInterface workspaceId="w" sessionId={null} />);
    send();
    expect(screen.getByRole("button", { name: "Stop generating" })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(api.chat.createSession).toHaveBeenCalledTimes(1);
    await act(async () => resolve(session));
  });
  it("reuses the created session after a generation error", async () => {
    vi.mocked(api.rag.query).mockRejectedValueOnce(new Error("Model unavailable"));
    render(<ChatInterface workspaceId="w" sessionId={null} />);
    send();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await screen.findByText("An answer");
    expect(api.chat.createSession).toHaveBeenCalledTimes(1);
  });
  it("ignores an old conversation response after navigation", async () => {
    let resolve!: (value: ChatMessage[]) => void;
    vi.mocked(api.chat.listMessages).mockImplementation((_ws, id) => id === "old" ? new Promise((r) => { resolve = r; }) : Promise.resolve([{ ...response, content: "Current conversation" }]));
    const view = render(<ChatInterface key="old" workspaceId="w" sessionId="old" />);
    view.rerender(<ChatInterface key="current" workspaceId="w" sessionId="current" />);
    await screen.findByText("Current conversation");
    await act(async () => resolve([{ ...response, content: "Stale answer" }]));
    expect(screen.queryByText("Stale answer")).not.toBeInTheDocument();
  });
  it("does not navigate back when an in-flight answer completes after leaving", async () => {
    let resolve!: (value: ChatMessage) => void;
    const onCreated = vi.fn();
    vi.mocked(api.rag.query).mockReturnValue(new Promise((r) => { resolve = r; }));
    const view = render(<ChatInterface workspaceId="w" sessionId={null} onSessionCreated={onCreated} />);
    send();
    await waitFor(() => expect(api.rag.query).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolve(response));
    expect(onCreated).not.toHaveBeenCalled();
  });
});
