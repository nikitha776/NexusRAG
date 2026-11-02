import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatUploadButton } from "@/components/documents/chat-upload-button";
import { useAppStore } from "@/store";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { documents: { upload: vi.fn() } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const workspace = { id: "w", name: "Research", description: null, document_count: 0, created_at: "", updated_at: "" };
const doc = { id: "new", filename: "source.txt", status: "processing" as const, file_size: 8, file_type: "txt", chunk_count: 0, created_at: "" };
const file = new File(["Evidence"], "source.txt", { type: "text/plain" });
const choose = (files: File[]) => fireEvent.change(screen.getByLabelText("Choose documents to upload"), { target: { files } });

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ activeWorkspace: workspace, documents: [], selectedDocIds: new Set() });
  vi.mocked(api.documents.upload).mockResolvedValue({ documents: [doc], errors: [] });
});

it("opens the picker and uploads into the workspace without requiring a chat or selected documents", async () => {
  const onUploaded = vi.fn();
  render(<ChatUploadButton workspaceId="w" onUploaded={onUploaded} />);
  const input = screen.getByLabelText("Choose documents to upload");
  const picker = vi.spyOn(input as HTMLInputElement, "click");
  fireEvent.click(screen.getByRole("button", { name: "Upload documents" }));
  expect(picker).toHaveBeenCalledOnce();
  choose([file]);
  await waitFor(() => expect(onUploaded).toHaveBeenCalledOnce());
  expect(api.documents.upload).toHaveBeenCalledWith("w", [file]);
  expect(useAppStore.getState().documents).toEqual([doc]);
  expect(useAppStore.getState().selectedDocIds.size).toBe(0);
});

it("rejects unsupported, empty, oversized files and excessive batches before contacting the API", async () => {
  render(<ChatUploadButton workspaceId="w" />);
  const oversized = new File(["x"], "large.pdf");
  Object.defineProperty(oversized, "size", { value: 51 * 1024 * 1024 });
  for (const files of [[new File(["x"], "legacy.doc")], [new File([], "empty.pdf")], [oversized], Array(11).fill(file)]) {
    choose(files);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(api.documents.upload).not.toHaveBeenCalled();
  }
});

it("prevents duplicate uploads while pending and allows retry after failure", async () => {
  let reject!: (reason: Error) => void;
  vi.mocked(api.documents.upload).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  render(<ChatUploadButton workspaceId="w" />);
  choose([file]);
  expect(screen.getByRole("button", { name: "Uploading documents" })).toBeDisabled();
  choose([file]);
  expect(api.documents.upload).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("Upload unavailable")));
  expect(screen.getByRole("alert")).toHaveTextContent("Upload unavailable");
  choose([file]);
  await waitFor(() => expect(useAppStore.getState().documents).toEqual([doc]));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("keeps successful files and displays per-file failures in a partial upload", async () => {
  vi.mocked(api.documents.upload).mockResolvedValue({ documents: [doc], errors: [{ filename: "bad.pdf", error: "Unreadable" }] });
  const onUploaded = vi.fn();
  render(<ChatUploadButton workspaceId="w" onUploaded={onUploaded} />);
  choose([file]);
  expect(await screen.findByRole("alert")).toHaveTextContent("bad.pdf: Unreadable");
  expect(useAppStore.getState().documents).toEqual([doc]);
  expect(onUploaded).toHaveBeenCalledOnce();
});

it("does not add a late upload to a different workspace or open its sources", async () => {
  let resolve!: (result: { documents: typeof doc[]; errors: [] }) => void;
  vi.mocked(api.documents.upload).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const onUploaded = vi.fn();
  const view = render(<ChatUploadButton workspaceId="w" onUploaded={onUploaded} />);
  choose([file]);
  view.unmount();
  useAppStore.getState().setActiveWorkspace({ ...workspace, id: "other" });
  await act(async () => resolve({ documents: [doc], errors: [] }));
  expect(useAppStore.getState().documents).toEqual([]);
  expect(onUploaded).not.toHaveBeenCalled();
});
