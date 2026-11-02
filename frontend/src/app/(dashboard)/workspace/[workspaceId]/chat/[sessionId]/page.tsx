"use client";
import { useParams } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
export default function ChatSessionPage() {
  const { workspaceId, sessionId } = useParams<{ workspaceId: string; sessionId: string }>();
  return <WorkspaceView key={workspaceId} workspaceId={workspaceId} sessionId={sessionId} />;
}
