"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { toast } from "sonner";

export const DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md,.csv";

export function useDocumentUpload(workspaceId: string) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, [workspaceId]);

  const upload = async (files: File[]): Promise<boolean> => {
    if (!files.length || lock.current) return false;
    const invalid = files.find((file) => !/\.(pdf|docx|txt|md|csv)$/i.test(file.name) || file.size === 0 || file.size > 50 * 1024 * 1024);
    if (files.length > 10 || invalid) {
      setError(invalid ? `${invalid.name}: choose a nonempty PDF, DOCX, TXT, MD, or CSV under 50 MB.` : "Choose up to 10 files at a time.");
      return false;
    }
    lock.current = true;
    setUploading(true);
    setError(null);
    const currentWorkspace = () => useAppStore.getState().activeWorkspace?.id === workspaceId;
    try {
      const result = await api.documents.upload(workspaceId, files);
      if (currentWorkspace()) useAppStore.getState().addDocuments(result.documents);
      if (result.documents.length) toast.success(`${result.documents.length} file(s) uploaded. Processing has started.`);
      if (result.errors.length) {
        const message = result.errors.map((item) => `${item.filename}: ${item.error}`).join("\n");
        toast.error(message);
        if (mounted.current && currentWorkspace()) setError(message);
      }
      return result.documents.length > 0 && mounted.current && currentWorkspace();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed. Please retry.";
      toast.error(message);
      if (mounted.current && currentWorkspace()) setError(message);
      return false;
    } finally {
      lock.current = false;
      if (mounted.current && currentWorkspace()) setUploading(false);
    }
  };

  return { upload, uploading, error, setError };
}
