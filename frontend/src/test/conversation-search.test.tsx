import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ConversationSearch } from "@/components/chat/conversation-search";
import { api } from "@/lib/api";
import type { ChatSearchHit, ChatSearchResponse } from "@/types";

vi.mock("@/lib/api", () => ({ api: { chat: { search: vi.fn() } } }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
const hit: ChatSearchHit = { id: "message:m1", match_type: "message", message_id: "m1", session_id: "s1", title: "Research", workspace_id: "w1", workspace_name: "Science", role: "assistant", snippet: "The project uses Python.", created_at: "2026-01-01T00:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.chat.search).mockResolvedValue({ results: [hit], next: null });
});
async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Search conversations" }));
  return screen.findByRole("textbox", { name: "Search conversation text" });
}
function submit(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Search conversation text" }), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
}

it("searches across workspaces and links directly to the matching message", async () => {
  render(<ConversationSearch />);
  await open();
  expect(api.chat.search).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /^Search$/ })).toBeDisabled();
  submit("Python");
  const link = await screen.findByRole("link", { name: /Research/ });
  expect(link).toHaveAttribute("href", "/workspace/w1/chat/s1#message-m1");
  expect(screen.getByText(/Science · Answer/)).toBeInTheDocument();
  expect(link.querySelector("mark")).toHaveTextContent("Python");
  expect(api.chat.search).toHaveBeenCalledWith("Python", expect.objectContaining({ workspaceId: undefined }));
});

it("supports this-workspace filtering and displays no matches normally", async () => {
  vi.mocked(api.chat.search).mockResolvedValue({ results: [], next: null });
  render(<ConversationSearch workspaceId="w1" />);
  await open();
  fireEvent.click(screen.getByRole("checkbox", { name: "Only this workspace" }));
  submit("missing");
  await screen.findByText(/No conversations found/);
  expect(api.chat.search).toHaveBeenCalledWith("missing", expect.objectContaining({ workspaceId: "w1" }));
});

it("ignores a stale response after another query has been submitted", async () => {
  let resolve!: (value: ChatSearchResponse) => void;
  vi.mocked(api.chat.search).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  render(<ConversationSearch />);
  await open();
  submit("older");
  submit("Python");
  await screen.findByRole("link", { name: /Research/ });
  await act(async () => resolve({ results: [{ ...hit, id: "old", title: "Stale chat" }], next: null }));
  expect(screen.queryByRole("link", { name: /Stale chat/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Research/ })).toBeInTheDocument();
});

it("loads another page without duplicating existing results", async () => {
  const cursor = { messages: 1, titles: 0 };
  vi.mocked(api.chat.search).mockResolvedValueOnce({ results: [hit], next: cursor });
  vi.mocked(api.chat.search).mockResolvedValueOnce({ results: [hit, { ...hit, id: "message:m2", message_id: "m2", title: "Next chat" }], next: null });
  render(<ConversationSearch />);
  await open();
  submit("Python");
  fireEvent.click(await screen.findByRole("button", { name: "Load more results" }));
  await screen.findByRole("link", { name: /Next chat/ });
  expect(screen.getAllByRole("link")).toHaveLength(2);
  expect(api.chat.search).toHaveBeenLastCalledWith("Python", expect.objectContaining({ cursor }));
});

it("shows a retryable error and can run the failed search again", async () => {
  vi.mocked(api.chat.search).mockRejectedValueOnce(new Error("Search unavailable"));
  render(<ConversationSearch />);
  await open();
  submit("Python");
  expect(await screen.findByRole("alert")).toHaveTextContent("Search unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry search" }));
  await screen.findByRole("link", { name: /Research/ });
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});
