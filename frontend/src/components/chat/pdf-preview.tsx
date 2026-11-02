"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, LocateFixed } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { findPdfPassage, type PdfHighlight } from "@/lib/pdf-citations";
import type { Citation } from "@/types";

function PdfPage({ pdf, pageNumber, highlights, zoom }: {
  pdf: PDFDocumentProxy; pageNumber: number; highlights: PdfHighlight[]; zoom: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = host.current;
    if (!node || !width) return;
    let cancelled = false;
    let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    let textLayer: import("pdfjs-dist").TextLayer | undefined;
    const draw = async () => {
      const pdfjs = await import("pdfjs-dist");
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.1, (width - 24) / base.width) * zoom;
      const viewport = page.getViewport({ scale });
      const container = document.createElement("div");
      container.className = "pdf-page";
      container.style.width = `${viewport.width}px`;
      container.style.height = `${viewport.height}px`;
      container.style.setProperty("--total-scale-factor", String(scale * page.userUnit));
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-label", `PDF page ${pageNumber}`);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const layer = document.createElement("div");
      layer.className = "textLayer";
      container.append(canvas, layer);
      node.replaceChildren(container);
      renderTask = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        annotationMode: pdfjs.AnnotationMode.DISABLE });
      const content = await page.getTextContent();
      if (cancelled) return;
      textLayer = new pdfjs.TextLayer({ textContentSource: content, container: layer, viewport });
      await Promise.all([renderTask.promise, textLayer.render()]);
      if (cancelled) return;
      for (const match of highlights.filter((h) => h.page === pageNumber)) {
        const span = textLayer.textDivs[match.item];
        const text = span?.firstChild;
        if (!text || text.nodeType !== Node.TEXT_NODE) continue;
        const range = document.createRange();
        range.setStart(text, Math.min(match.start, text.textContent?.length || 0));
        range.setEnd(text, Math.min(match.end, text.textContent?.length || 0));
        const origin = container.getBoundingClientRect();
        for (const rect of Array.from(range.getClientRects())) {
          if (!rect.width || !rect.height) continue;
          const mark = document.createElement("div");
          mark.className = "pdf-citation-highlight";
          mark.setAttribute("aria-hidden", "true");
          Object.assign(mark.style, { left: `${rect.left - origin.left}px`, top: `${rect.top - origin.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
          container.append(mark);
        }
      }
      container.querySelector(".pdf-citation-highlight")?.scrollIntoView({ block: "center", inline: "nearest" });
    };
    draw().catch((e) => { if (!cancelled) setError(e instanceof Error ? "Could not render this page. Try another page or reopen the preview." : "PDF rendering failed."); });
    return () => { cancelled = true; renderTask?.cancel(); textLayer?.cancel(); };
  }, [pdf, pageNumber, width, zoom, highlights]);
  return <>{error && <p role="alert" className="p-3 text-xs text-destructive">{error}</p>}<div ref={host} className="min-w-0 w-full" /></>;
}

export function PdfPreview({ workspaceId, citation }: { workspaceId: string; citation: Citation }) {
  const [loaded, setLoaded] = useState<{ pdf: PDFDocumentProxy; highlights: PdfHighlight[]; partial: boolean } | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    const open = async () => {
      const pdfjs = await import("pdfjs-dist");
      const assets = `/pdfjs/${pdfjs.version}/`;
      pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.mjs`;
      const data = await api.documents.file(workspaceId, citation.document_id, controller.signal);
      if (controller.signal.aborted) return;
      task = pdfjs.getDocument({ data, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/` });
      const pdf = await task.promise;
      const pages: string[][] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        if (controller.signal.aborted) return;
        setProgress(`Locating passage · page ${n} of ${pdf.numPages}`);
        const content = await (await pdf.getPage(n)).getTextContent();
        pages.push(content.items.filter((item): item is import("pdfjs-dist/types/src/display/api").TextItem => "str" in item).map((item) => item.str));
      }
      if (controller.signal.aborted) return;
      const match = findPdfPassage(pages, citation.chunk_content);
      setPage(match.highlights[0]?.page || 1);
      setLoaded({ pdf, ...match });
    };
    open().catch((e) => {
      if (controller.signal.aborted) return;
      setError(e?.name === "PasswordException" ? "This PDF is password-protected. Upload an unlocked copy to preview it." : e instanceof Error ? e.message : "Could not load this PDF.");
    });
    return () => { controller.abort(); void task?.destroy().catch(() => {}); };
  }, [workspaceId, citation, retry]);
  if (error) return <div role="alert" className="p-4 text-sm">{error}<Button variant="outline" className="mt-3 block" onClick={() => { setError(""); setLoaded(null); setProgress(""); setRetry((n) => n + 1); }}>Retry</Button></div>;
  if (!loaded) return <p role="status" className="p-5 text-xs text-muted-foreground">{progress || "Loading original PDF…"}</p>;
  const { pdf, highlights, partial } = loaded;
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-xs">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
        <span>Page {page} / {pdf.numPages}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page === pdf.numPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}><ZoomOut className="size-4" /></Button>
        <span className="min-w-9 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}><ZoomIn className="size-4" /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Jump to citation" disabled={!highlights.length} onClick={() => { setPage(highlights[0].page); setZoom(1); }}><LocateFixed className="size-4" /></Button>
      </div>
    </div>
    <p role="status" className="px-4 py-2 text-xs text-muted-foreground">{highlights.length ? partial ? "Matching phrase highlighted · PDF text order differs from the saved passage." : "Supporting passage highlighted in the original PDF." : "Could not locate this passage reliably. The PDF may be scanned or its text may have changed."}</p>
    {highlights.length > 0 && <div className="flex gap-1 px-3 pb-2">{[...new Set(highlights.map((h) => h.page))].map((n) => <Button key={n} variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setPage(n)}>Citation · p. {n}</Button>)}</div>}
    <div className="min-h-0 flex-1 overflow-auto bg-slate-200/60 py-3"><PdfPage key={page} pdf={pdf} pageNumber={page} highlights={highlights} zoom={zoom} /></div>
  </div>;
}
