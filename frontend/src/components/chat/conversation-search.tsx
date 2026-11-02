"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Search, Loader2, MessageSquare, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { focusSearchMessage } from "@/lib/chat-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { ChatSearchCursor, ChatSearchHit } from "@/types";

function Highlight({ text, query }: { text: string; query: string }) {
  const parts: ReactNode[] = [];
  const needle = query.toLocaleLowerCase();
  let from = 0, position = text.toLocaleLowerCase().indexOf(needle);
  if (!needle || position < 0) return <>{text}</>;
  while (position >= 0) {
    parts.push(text.slice(from, position));
    parts.push(<mark key={position} className="rounded bg-primary/15 px-0.5 text-foreground">{text.slice(position, position + query.length)}</mark>);
    from = position + query.length;
    position = text.toLocaleLowerCase().indexOf(needle, from);
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

type SearchState = {
  status: "idle" | "loading" | "ready" | "error";
  query: string;
  workspaceId?: string;
  results: ChatSearchHit[];
  next: ChatSearchCursor | null;
  requestedCursor?: ChatSearchCursor;
  error: string | null;
};
const initialState: SearchState = { status: "idle", query: "", results: [], next: null, error: null };

export function ConversationSearch({ workspaceId }: { workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [workspaceOnly, setWorkspaceOnly] = useState(false);
  const [state, setState] = useState<SearchState>(initialState);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const changeOpen = (value: boolean) => {
    setOpen(value);
    if (!value) {
      request.current?.abort();
      setState(initialState);
      setDraft("");
    }
  };
  const runSearch = async (query: string, scope?: string, cursor?: ChatSearchCursor) => {
    if (query.length < 2) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...initialState, ...(cursor ? previous : {}),
      status: "loading", query, workspaceId: scope, requestedCursor: cursor, error: null }));
    try {
      const result = await api.chat.search(query, { workspaceId: scope, cursor, signal: controller.signal });
      if (controller.signal.aborted) return;
      setState((previous) => {
        const combined = cursor ? [...previous.results, ...result.results] : result.results;
        return { ...previous, status: "ready", results: [...new Map(combined.map((hit) => [hit.id, hit])).values()], next: result.next, error: null };
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((previous) => ({ ...previous, status: "error", error: error instanceof Error ? error.message : "Could not search conversations." }));
    }
  };
  const term = draft.trim().replace(/\s+/g, " ");

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="workspace-control" aria-label="Search conversations" />}>
      <Search className="size-4" /><span className="hidden sm:inline">Search chats</span>
    </DialogTrigger>
    <DialogContent className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Search conversations</DialogTitle>
        <DialogDescription>Find saved questions, answers, and chat titles across your workspaces.</DialogDescription>
      </DialogHeader>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void runSearch(term, workspaceOnly ? workspaceId : undefined); }}>
        <Input aria-label="Search conversation text" placeholder="Search a word or phrase…" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" disabled={term.length < 2}>Search</Button>
      </form>
      {workspaceId && <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={workspaceOnly} onChange={(event) => {
          request.current?.abort(); setState(initialState); setWorkspaceOnly(event.target.checked);
        }} /> Only this workspace
      </label>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "idle" && <p className="py-8 text-center text-sm text-muted-foreground">Enter at least two characters and press Search.</p>}
        {state.query && <p className="mb-3 text-xs text-muted-foreground">Results for “{state.query}” · {state.workspaceId ? "This workspace" : "All workspaces"}</p>}
        {state.status === "ready" && !state.results.length && <p className="py-8 text-center text-sm text-muted-foreground">No conversations found. Try another word or phrase.</p>}
        <ul aria-label="Conversation search results" className="space-y-2">
          {state.results.map((hit) => <li key={hit.id}>
            <Link href={`/workspace/${encodeURIComponent(hit.workspace_id)}/chat/${encodeURIComponent(hit.session_id)}${hit.message_id ? `#message-${encodeURIComponent(hit.message_id)}` : ""}`}
              onClick={() => {
                changeOpen(false);
                // Also handle a match in the chat already on screen, where a
                // hash-only Next navigation does not reload message history.
                if (hit.message_id) window.requestAnimationFrame(() => {
                  const target = document.getElementById(`message-${hit.message_id}`);
                  if (target) focusSearchMessage(target);
                });
              }} className="block rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
              <div className="flex items-start gap-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 break-words text-sm font-medium"><Highlight text={hit.title} query={state.query} /></span><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></div>
              <p className="mt-1 text-xs text-muted-foreground">{hit.workspace_name} · {hit.match_type === "title" ? "Chat title" : hit.role === "user" ? "Your question" : "Answer"} · {new Date(hit.created_at).toLocaleDateString()}</p>
              {hit.match_type === "message" && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed"><Highlight text={hit.snippet} query={state.query} /></p>}
            </Link>
          </li>)}
        </ul>
        {state.status === "loading" && <p role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching conversations…</p>}
        {state.error && <div role="alert" className="mt-3 rounded-xl border border-destructive/30 p-3 text-sm">{state.error}<Button variant="ghost" size="sm" onClick={() => void runSearch(state.query, state.workspaceId, state.requestedCursor)}>Retry search</Button></div>}
        {state.next && <Button type="button" variant="ghost" className="mt-3 w-full" disabled={state.status === "loading"} onClick={() => void runSearch(state.query, state.workspaceId, state.next || undefined)}>Load more results</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
