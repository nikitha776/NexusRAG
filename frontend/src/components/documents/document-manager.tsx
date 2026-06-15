"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Trash2,
  Loader2,
  Upload,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  CloudUpload,
} from "lucide-react";
import type { Document } from "@/types";

interface DocumentManagerProps {
  workspaceId: string;
}

export function DocumentManager({ workspaceId }: DocumentManagerProps) {
  const { documents, setDocuments, addDocuments, removeDocument, updateDocument } =
    useAppStore();
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await api.documents.list(workspaceId);
      setDocuments(docs);
    } catch (e) {
      // Backend may be offline
    }
  }, [workspaceId, setDocuments]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const hasProcessing = documents.some((d) => d.status === "processing");

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = setInterval(loadDocuments, 3000);
    return () => clearInterval(interval);
  }, [hasProcessing, loadDocuments]);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await api.documents.upload(workspaceId, files);
      addDocuments(uploaded);
    } catch (e) {
      // Handle error
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    handleUpload(Array.from(files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleUpload(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document and its embeddings?")) return;
    try {
      await api.documents.delete(workspaceId, docId);
      removeDocument(docId);
    } catch (e) {
      // Handle error
    }
  };

  const handleReprocess = async (docId: string) => {
    try {
      updateDocument(docId, { status: "processing" as const, chunk_count: 0 });
      await api.documents.reprocess(workspaceId, docId);
    } catch (e) {
      // Handle error
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "processing":
        return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Sources</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {documents.length}
        </span>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        multiple
        accept=".pdf,.txt,.md,.csv,.doc,.docx"
        className="hidden"
      />

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-4 transition-all duration-200 cursor-pointer ${
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border/60 hover:border-primary/40 hover:bg-muted/30"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {uploading ? (
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          ) : (
            <CloudUpload className={`h-6 w-6 ${isDragOver ? "text-primary" : "text-muted-foreground"} transition-colors`} />
          )}
          <div>
            <p className="text-sm font-medium">
              {uploading ? "Uploading..." : "Drop files here or click to upload"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              PDF, TXT, MD, CSV, DOC supported
            </p>
          </div>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No sources yet</p>
          <p className="text-xs text-muted-foreground">
            Upload documents to start building your knowledge base
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-all duration-200"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-muted flex-shrink-0 group-hover:bg-muted/80 transition-colors">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {statusIcon(doc.status)}
                  <span className="text-[11px] text-muted-foreground">
                    {doc.status === "ready"
                      ? `${formatFileSize(doc.file_size)} · ${doc.chunk_count} chunks`
                      : doc.status === "processing"
                      ? "Processing..."
                      : "Failed"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.status === "error" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 flex-shrink-0 rounded-lg"
                    onClick={() => handleReprocess(doc.id)}
                    title="Retry processing"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0 rounded-lg hover:bg-red-100 hover:text-red-600"
                  onClick={() => handleDelete(doc.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
