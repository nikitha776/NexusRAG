"use client";

import { useState, useRef } from "react";
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

  const loadDocuments = async () => {
    try {
      const docs = await api.documents.list(workspaceId);
      setDocuments(docs);
    } catch (e) {
      console.error("Failed to load documents:", e);
    }
  };

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
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            multiple
            accept=".pdf,.txt,.md,.csv"
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Supported: PDF, TXT, MD, CSV
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 border rounded-lg">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No documents uploaded yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.file_size)} • {doc.chunk_count} chunks
                </p>
              </div>
              <Badge className={statusColor(doc.status)} variant="secondary">
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
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
