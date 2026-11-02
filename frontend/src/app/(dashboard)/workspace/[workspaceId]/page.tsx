"use client";
import { useParams } from "next/navigation";
import { WorkspaceView } from "@/components/workspace/workspace-view";
export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <WorkspaceView key={workspaceId} workspaceId={workspaceId} />;
}
