"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Loader2, RefreshCw, CloudUpload } from "lucide-react";
import { DOCUMENT_ACCEPT, useDocumentUpload } from "@/hooks/use-document-upload";

export function DocumentManager({ workspaceId }: { workspaceId: string }) {
  const { documents, setDocuments, removeDocument, updateDocument } = useAppStore();
  const { upload, uploading, error, setError } = useDocumentUpload(workspaceId);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const hasProcessing = documents.some((d) => d.status === "processing");

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    const load = async () => {
      try {
        const docs = await api.documents.list(workspaceId);
        if (!cancelled && useAppStore.getState().activeWorkspace?.id === workspaceId) setDocuments(docs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not refresh sources.");
      }
    };
    if (hasProcessing) void load();
    const interval = hasProcessing ? setInterval(load, 3000) : undefined;
    return () => { cancelled = true; mounted.current = false; clearInterval(interval); };
  }, [workspaceId, hasProcessing, setDocuments, setError]);

  const act = async (id: string, action: "delete" | "retry") => {
    if (busy) return;
    if (action === "delete" && !confirm("Delete this source and its searchable content? Existing chat history will remain.")) return;
    setBusy(id);
    setError(null);
    try {
      if (action === "delete") {
        await api.documents.delete(workspaceId, id);
        if (useAppStore.getState().activeWorkspace?.id === workspaceId) removeDocument(id);
      } else {
        await api.documents.reprocess(workspaceId, id);
        if (useAppStore.getState().activeWorkspace?.id === workspaceId) updateDocument(id, { status: "processing", error_message: null, chunk_count: 0 });
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Could not update this source."); }
    finally { if (mounted.current) setBusy(null); }
  };
  const visible = documents.filter((doc) => doc.filename.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || doc.status === filter));

  return <section className="space-y-4" aria-label="Document library">
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Document library</h2><span className="rounded-full bg-muted px-2 text-xs">{documents.length}</span></div>
    <input ref={input} type="file" className="hidden" accept={DOCUMENT_ACCEPT} multiple onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; void upload(files); }} />
    <button type="button" disabled={uploading} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(Array.from(e.dataTransfer.files)); }} className={`w-full rounded-2xl border-2 border-dashed p-5 text-center transition-colors disabled:opacity-60 ${dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/40"}`}>
      {uploading ? <Loader2 className="mx-auto mb-2 size-6 animate-spin" /> : <CloudUpload className="mx-auto mb-2 size-6 text-primary" />}
      <span className="block text-sm font-medium">{uploading ? "Uploading…" : "Drop files or browse"}</span>
      <span className="mt-1 block text-xs text-muted-foreground">PDF, DOCX, TXT, MD, CSV<br />Up to 50 MB each · 10 files per upload</span>
    </button>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs whitespace-pre-wrap">{error}<button className="block mt-2 underline" onClick={() => setError(null)}>Dismiss</button></div>}
    {documents.length > 0 && <div className="space-y-2"><Input aria-label="Search documents" placeholder="Find a document…" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter document status" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-lg border bg-background p-2 text-xs"><option value="all">All statuses</option><option value="ready">Ready</option><option value="processing">Processing</option><option value="error">Needs attention</option></select></div>}
    {!documents.length && <p className="py-4 text-center text-xs text-muted-foreground">Upload your first source, then select it below to start asking questions.</p>}
    {documents.length > 0 && !visible.length && <p className="text-xs text-muted-foreground">No documents match your filters.</p>}
    <ul className="space-y-2">{visible.map((doc) => <li key={doc.id} className="rounded-xl border border-border/60 p-3">
      <div className="flex items-start gap-2"><FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" title={doc.filename}>{doc.filename}</p><p className="mt-1 text-xs text-muted-foreground">{doc.status === "ready" ? `Ready · ${(doc.file_size / 1024).toFixed(0)} KB` : doc.status === "processing" ? "Processing…" : "Needs attention"}</p></div>
        {doc.status === "error" && <Button variant="ghost" size="icon" aria-label={`Retry ${doc.filename}`} disabled={busy !== null} onClick={() => void act(doc.id, "retry")}><RefreshCw className="size-4" /></Button>}
        <Button variant="ghost" size="icon" aria-label={`Delete ${doc.filename}`} disabled={busy !== null || doc.status === "processing"} onClick={() => void act(doc.id, "delete")}><Trash2 className="size-4" /></Button></div>
      {doc.status === "error" && <p className="mt-2 text-xs text-destructive">{doc.error_message || "Processing failed. Retry, or check that the file contains readable text."}</p>}
    </li>)}</ul>
  </section>;
}
