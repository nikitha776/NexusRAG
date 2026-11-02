import { beforeEach, expect, it } from "vitest";
import { useAppStore } from "@/store";
const ws = { id: "a", name: "A", description: null, document_count: 1, created_at: "", updated_at: "" };
const doc = { id: "d", filename: "test.txt", status: "ready" as const, file_size: 10, file_type: "txt", chunk_count: 1, created_at: "" };
beforeEach(() => useAppStore.setState({ activeWorkspace: ws, documents: [doc], selectedDocIds: new Set(["d"]), chatSessions: [], messages: [] }));
it("clears sources and selection when changing workspaces", () => {
  useAppStore.getState().setActiveWorkspace({ ...ws, id: "b" });
  expect(useAppStore.getState().documents).toEqual([]);
  expect(useAppStore.getState().selectedDocIds.size).toBe(0);
});
it("keeps selection when refreshing the same workspace", () => {
  useAppStore.getState().setActiveWorkspace({ ...ws });
  expect(useAppStore.getState().selectedDocIds.has("d")).toBe(true);
});
it("prunes selected files that are removed or no longer ready", () => {
  useAppStore.getState().setDocuments([{ ...doc, status: "processing" }]);
  expect(useAppStore.getState().selectedDocIds.size).toBe(0);
  useAppStore.getState().toggleDocSelection("d");
  expect(useAppStore.getState().selectedDocIds.size).toBe(0);
});

it("does not duplicate an upload already discovered by polling", () => {
  useAppStore.getState().addDocuments([doc]);
  expect(useAppStore.getState().documents).toHaveLength(1);
});
