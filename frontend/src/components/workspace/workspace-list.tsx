"use client";

import { useState } from "react";
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
import { Plus, FolderOpen, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Workspace } from "@/types";

interface WorkspaceListProps {
  workspaces: Workspace[];
  onRefresh: () => void;
}

export function WorkspaceList({ workspaces, onRefresh }: WorkspaceListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

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
      console.error("Failed to create workspace:", e);
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
      console.error("Failed to delete workspace:", e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Your Workspaces</h1>
          <p className="text-muted-foreground">
            Create isolated AI environments for different domains
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            New Workspace
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Research Papers"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will this workspace be used for?"
                  rows={3}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !name.trim()} className="w-full">
                {creating ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workspaces.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No workspaces yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first workspace to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Card
              key={ws.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => router.push(`/workspace/${ws.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{ws.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(ws.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                {ws.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {ws.description}
                  </p>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{ws.document_count} documents</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
