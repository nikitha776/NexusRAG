"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FolderOpen, Trash2, FileText, ArrowRight, Pencil } from "lucide-react";
import type { Workspace } from "@/types";

interface WorkspaceListProps {
  workspaces: Workspace[];
  onRefresh: () => void;
  isFiltered?: boolean;
}

export function WorkspaceList({ workspaces, onRefresh, isFiltered }: WorkspaceListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.workspaces.create({ name: name.trim(), description: description.trim() || undefined });
      setName("");
      setDescription("");
      setOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this workspace and all its data?")) return;
    try {
      await api.workspaces.delete(id);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the workspace.");
    }
  };

  const openEdit = (ws: Workspace) => {
    setEditId(ws.id);
    setEditName(ws.name);
    setEditDescription(ws.description || "");
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    try {
      await api.workspaces.update(editId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditOpen(false);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Workspaces</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your documents into knowledge bases
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="rounded-full gap-2 shadow-none" />}>
            <Plus className="h-4 w-4" />
            New Workspace
          </DialogTrigger>
          <DialogContent className="welcome-page rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-lg">Create workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                <Input
                  maxLength={255}
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Research Papers"
                  className="mt-2 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this workspace be used for?"
                  rows={2}
                  className="mt-2 rounded-xl resize-none"
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full rounded-xl h-10">
                {creating ? "Creating..." : "Create workspace"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces.length === 0 && isFiltered ? <p className="py-10 text-center text-muted-foreground">No workspaces match your search.</p> : workspaces.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-2">No workspaces yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
            Create your first workspace to start organizing and exploring your documents with AI
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="rounded-xl gap-2" />}>
              <Plus className="h-4 w-4" />
              Create First Workspace
            </DialogTrigger>
          </Dialog>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="welcome-card group relative p-5 transition-colors duration-200 cursor-pointer overflow-hidden hover:bg-card focus-visible:outline-2 focus-visible:outline-ring"
              role="link"
              tabIndex={0}
              onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") router.push(`/workspace/${ws.id}`); }}
              onClick={() => router.push(`/workspace/${ws.id}`)}
            >
              {/* Hover gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <FolderOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm block">{ws.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {ws.document_count} source{ws.document_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity -mr-1 -mt-1">
                    <Button
                      aria-label={`Edit ${ws.name}`}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(ws);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                    </Button>
                    <Button
                      aria-label={`Delete ${ws.name}`}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ws.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>

                {ws.description && (
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
                    {ws.description}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{ws.document_count} documents</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit workspace dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="welcome-page rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="edit-name" className="text-sm font-medium">Name</Label>
              <Input
                maxLength={255}
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Research Papers"
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What will this workspace be used for?"
                rows={2}
                className="mt-2 rounded-xl resize-none"
              />
            </div>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()} className="w-full rounded-xl h-10">
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
