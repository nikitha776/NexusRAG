"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Citation, DocumentPreview } from "@/types";
import { X } from "lucide-react";
import { PdfPreview } from "@/components/chat/pdf-preview";
import { Button } from "@/components/ui/button";

export function SourcePreview({ workspaceId, citation, onClose }: {
  workspaceId: string; citation: Citation | null; onClose: () => void;
}) {
  const isPdf = /\.pdf$/i.test(citation?.filename || "");
  const closeButton = useRef<HTMLButtonElement>(null);
  const [document, setDocument] = useState<DocumentPreview | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const highlight = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!citation || isPdf) return;
    let cancelled = false;
    api.documents.preview(workspaceId, citation.document_id)
      .then((data) => { if (!cancelled) setDocument(data); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not open this document."); });
    return () => { cancelled = true; };
  }, [workspaceId, citation, retry, isPdf]);
  useEffect(() => { highlight.current?.scrollIntoView({ block: "center" }); }, [document]);
  const match = document?.chunks.find((chunk) => chunk.content === citation?.chunk_content)
    ?? document?.chunks.find((chunk) => chunk.chunk_index === citation?.chunk_index);

  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);
  return <aside aria-label={`Source preview: ${citation?.filename}`} className="source-preview-panel workspace-panel workspace-drawer flex min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0"><h2 className="truncate text-sm font-medium" title={citation?.filename}>{citation?.filename}</h2><p className="mt-1 text-xs text-muted-foreground">{isPdf ? "Original PDF" : "Document text · supporting passage highlighted"}</p></div>
        <Button ref={closeButton} variant="ghost" size="icon-sm" aria-label="Close source preview" onClick={onClose}><X className="size-4" /></Button>
      </header>
      {isPdf && citation ? <PdfPreview workspaceId={workspaceId} citation={citation} /> : <>
      <div className="min-h-0 flex-1 overflow-y-auto space-y-4 p-4 text-sm leading-relaxed">
        {error ? <div role="alert">{error}<Button variant="outline" className="ml-2" onClick={() => { setError(""); setDocument(null); setRetry((v) => v + 1); }}>Retry</Button></div>
          : !document ? <p role="status">Loading document…</p>
          : <>
            {!match && <div className="rounded-xl border p-3"><p className="mb-2 text-xs text-muted-foreground">Saved citation · this passage is no longer in the current document.</p><mark className="bg-amber-100 text-slate-900 whitespace-pre-wrap">{citation?.chunk_content}</mark></div>}
            {document.chunks.map((chunk) => <div key={chunk.chunk_index} className="whitespace-pre-wrap">
              {chunk === match ? <mark ref={highlight} className="block rounded-xl bg-amber-100 p-3 text-slate-900">{chunk.content}</mark> : chunk.content}
            </div>)}
          </>}
      </div>
    </>}
  </aside>;
}
