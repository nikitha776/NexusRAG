"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PanelLeft, Files, Settings, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/store";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DocumentManager } from "@/components/documents/document-manager";
import { FileSelector } from "@/components/documents/file-selector";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Workspace } from "@/types";

const subscribe = (callback: () => void) => {
  const query = window.matchMedia("(min-width: 1024px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

export function WorkspaceView({ workspaceId, sessionId = null }: { workspaceId: string; sessionId?: string | null }) {
  const pathname = usePathname();
  const chatPrefix = `/workspace/${workspaceId}/chat/`;
  const routeSessionId = pathname
    ? (pathname.startsWith(chatPrefix) ? pathname.slice(chatPrefix.length).split("/")[0] : null)
    : sessionId;
  const [selection, setSelection] = useState<{ from: string; to: string; id: string | null } | null>(null);
  // Next's pathname update can arrive after local state. Mount a new chat with
  // the intended session immediately, rather than briefly loading the old one.
  const activeSessionId = selection && (pathname === selection.from || pathname === selection.to)
    ? selection.id : routeSessionId;
  const [conversationVersion, setConversationVersion] = useState(0);
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1024px)").matches, () => false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [showChats, setShowChats] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [drawer, setDrawer] = useState<"chats" | "sources" | null>(null);
  const documentCount = useAppStore((state) => state.documents.length);

  useEffect(() => {
    let cancelled = false;
    const store = useAppStore.getState();
    if (store.activeWorkspace?.id !== workspaceId) store.setActiveWorkspace(null);
    Promise.all([api.workspaces.get(workspaceId), api.documents.list(workspaceId), api.chat.listSessions(workspaceId)])
      .then(([ws, docs, sessions]) => {
        if (cancelled) return;
        store.setActiveWorkspace(ws);
        store.setDocuments(docs);
        store.setChatSessions(sessions);
        setWorkspace(ws);
        setError(null);
      }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this workspace."); });
    return () => { cancelled = true; };
  }, [workspaceId, retry]);

  useEffect(() => {
    const restoreConversation = () => { setSelection(null); setConversationVersion((version) => version + 1); };
    window.addEventListener("popstate", restoreConversation);
    return () => window.removeEventListener("popstate", restoreConversation);
  }, []);

  const selectSession = (id: string | null) => {
    setDrawer(null);
    if (id !== null && id === activeSessionId) return;
    // Only a deliberate conversation change should reset the chat component.
    const path = id ? `/workspace/${workspaceId}/chat/${id}` : `/workspace/${workspaceId}`;
    setSelection({ from: window.location.pathname, to: path, id });
    setConversationVersion((version) => version + 1);
    if (path !== window.location.pathname) window.history.pushState(null, "", path);
  };
  const chats = <ChatSidebar workspaceId={workspaceId} activeSessionId={activeSessionId} onSessionSelect={selectSession} />;
  const sources = <div className="h-full overflow-y-auto p-4 space-y-6"><DocumentManager workspaceId={workspaceId} /><div className="border-t pt-5"><FileSelector /></div></div>;

  if (!workspace) return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
    {error ? <><p role="alert">{error}</p><Button onClick={() => { setError(null); setRetry((n) => n + 1); }}><RefreshCw className="size-4" /> Retry</Button></> : <p role="status" className="animate-pulse text-muted-foreground">Loading workspace…</p>}
    <Link href="/dashboard" className="text-sm underline">Back to workspaces</Link>
  </div>;

  return <div className="workspace-shell h-dvh flex flex-col">
    <header className="workspace-toolbar flex h-20 shrink-0 items-center gap-2 px-4 sm:px-6">
      <Link href="/dashboard" aria-label="Back to workspaces" className="workspace-control rounded-full p-3"><ArrowLeft className="size-4" /></Link>
      <div className="min-w-0 flex-1 px-2"><h1 className="truncate text-sm font-semibold">{workspace.name}</h1><p className="truncate text-xs text-muted-foreground">{workspace.description || "Your documents, connected to your questions"}</p></div>
      <Button className="workspace-control" variant="ghost" size="sm" aria-label="Toggle conversations" aria-expanded={desktop ? showChats : drawer === "chats"} onClick={() => desktop ? setShowChats(!showChats) : setDrawer("chats")}><PanelLeft className="size-4" /><span className="hidden sm:inline">Chats</span></Button>
      <Button className="workspace-control" variant="outline" size="sm" aria-expanded={desktop ? showSources : drawer === "sources"} onClick={() => desktop ? setShowSources(!showSources) : setDrawer("sources")}><Files className="size-4" /> Sources<span className="rounded bg-primary/10 px-1.5 text-primary">{documentCount}</span></Button>
      <Link href="/settings" aria-label="Settings" className="workspace-control p-3"><Settings className="size-4" /></Link>
    </header>
    <div className="flex flex-1 min-h-0 gap-3 px-3 pb-3 sm:px-5 sm:pb-5">
      {desktop && showChats && <aside aria-label="Conversations" className="workspace-panel w-60 shrink-0">{chats}</aside>}
      <main className="min-w-0 flex-1"><ChatInterface
        key={`${workspaceId}:${conversationVersion}`}
        workspaceId={workspaceId}
        sessionId={activeSessionId}
        onSessionCreated={(session) => {
          setSelection(null);
          useAppStore.getState().addChatSession(session);
          // Save the shareable URL without navigating or remounting the chat.
          window.history.replaceState(null, "", `/workspace/${workspaceId}/chat/${session.id}`);
        }}
      /></main>
      {desktop && showSources && <aside aria-label="Sources" className="workspace-panel w-80 shrink-0">{sources}</aside>}
    </div>
    {!desktop && <Sheet open={drawer !== null} onOpenChange={(open) => { if (!open) setDrawer(null); }}>
      <SheetContent side={drawer === "chats" ? "left" : "right"} className="workspace-drawer w-[90vw]! max-w-sm! gap-0">
        <SheetHeader><SheetTitle>{drawer === "chats" ? "Conversations" : "Sources"}</SheetTitle><SheetDescription>{drawer === "chats" ? "Continue a conversation or start a new one." : "Upload files and choose which ones to use in chat."}</SheetDescription></SheetHeader>
        <div className="flex-1 min-h-0">{drawer === "chats" ? chats : sources}</div>
      </SheetContent>
    </Sheet>}
  </div>;
}
