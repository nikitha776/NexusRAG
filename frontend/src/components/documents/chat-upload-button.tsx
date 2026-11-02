"use client";

import { useRef } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOCUMENT_ACCEPT, useDocumentUpload } from "@/hooks/use-document-upload";

export function ChatUploadButton({ workspaceId, disabled, onUploaded }: {
  workspaceId: string;
  disabled?: boolean;
  onUploaded?: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, uploading, error, setError } = useDocumentUpload(workspaceId);

  return <>
    <input ref={input} type="file" hidden multiple accept={DOCUMENT_ACCEPT}
      aria-label="Choose documents to upload"
      onChange={async (event) => {
        const files = Array.from(event.target.files || []);
        // Allow selecting the same file again after a validation or network error.
        event.target.value = "";
        if (await upload(files)) onUploaded?.();
      }} />
    <Button type="button" variant="ghost" size="icon"
      aria-label={uploading ? "Uploading documents" : "Upload documents"}
      title="Upload documents" disabled={disabled || uploading}
      className="h-11 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
      onClick={() => { setError(null); input.current?.click(); }}>
      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-5" />}
    </Button>
    {error && <div role="alert" className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-destructive/30 bg-background p-3 text-xs whitespace-pre-wrap shadow-sm">
      {error}<button type="button" className="mt-1 block underline" onClick={() => setError(null)}>Dismiss</button>
    </div>}
  </>;
}
