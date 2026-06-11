"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { Document } from "@/types";

interface DocumentManagerProps {
  workspaceId: string;
}

export function DocumentManager({ workspaceId }: DocumentManagerProps) {
  const { documents, setDocuments, addDocuments, removeDocument } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await api.documents.list(workspaceId);
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploaded = await api.documents.upload(workspaceId, Array.from(files));
      addDocuments(uploaded);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Delete this document and its embeddings?")) return;
    try {
      await api.documents.delete(workspaceId, docId);
      removeDocument(docId);
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const statusColor = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "processing":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      case "error":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold leading-tight">Documents</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload and manage your source documents
          </p>
        </div>
      </div>

      {/* Upload dropzone */}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          multiple
          accept=".pdf,.txt,.md,.csv"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-5 transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {uploading ? "Uploading..." : "Click to upload documents"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, TXT, MD, CSV supported
            </p>
          </div>
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-10 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/20">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-muted mx-auto mb-3">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground/70">
            No documents yet
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">
            Upload PDFs, text files, or CSVs to start building your knowledge base
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 px-3.5 py-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/5 flex-shrink-0">
                <FileText className="h-4 w-4 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatFileSize(doc.file_size)} &middot; {doc.chunk_count} chunks
                </p>
              </div>
              <Badge
                className={`${statusColor(doc.status)} text-[11px] font-medium px-2 py-0.5`}
                variant="secondary"
              >
                {doc.status === "processing" && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                {doc.status === "error" && (
                  <AlertCircle className="mr-1 h-3 w-3" />
                )}
                {doc.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
