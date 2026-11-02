import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { SourcePreview } from "@/components/chat/source-preview";
import { api } from "@/lib/api";
vi.mock("@/lib/api", () => ({ api: { documents: { preview: vi.fn() } } }));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

it("opens document text and highlights the cited passage, including older citations without an index", async () => {
  vi.mocked(api.documents.preview).mockResolvedValue({ id: "d", filename: "notes.txt", chunks: [
    { chunk_index: 0, content: "Introduction" },
    { chunk_index: 1, content: "Supporting evidence" },
    { chunk_index: 2, content: "Conclusion" },
  ] });
  render(<SourcePreview workspaceId="w" citation={{ document_id: "d", filename: "notes.txt", chunk_content: "Supporting evidence", score: 0.8 }} onClose={vi.fn()} />);
  const evidence = await screen.findByText("Supporting evidence");
  expect(evidence.tagName).toBe("MARK");
  expect(screen.getByText("Introduction")).toBeInTheDocument();
  expect(screen.getByText("Conclusion")).toBeInTheDocument();
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  expect(api.documents.preview).toHaveBeenCalledWith("w", "d");
});

it("reports deleted or inaccessible sources without showing another document", async () => {
  vi.mocked(api.documents.preview).mockRejectedValue(new Error("Document not found"));
  render(<SourcePreview workspaceId="w" citation={{ document_id: "deleted", filename: "notes.txt", chunk_content: "old", score: 0.8 }} onClose={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Document not found");
});
