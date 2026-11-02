import { expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
import { readAnswerStream, type AnswerEvent } from "@/lib/api";

function response(text: string) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    // Fragment JSON and multibyte characters across network chunks.
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }));
}

it("decodes fragmented tokens and waits for the persisted final message", async () => {
  const events: AnswerEvent[] = [];
  await readAnswerStream(response('{"type":"token","text":"Café"}\n{"type":"done","message":{"content":"Café"}}'), (event) => events.push(event));
  expect(events[0]).toEqual({ type: "token", text: "Café" });
  expect(events[1].type).toBe("done");
});

it("reports failed and truncated streams instead of treating partial text as saved", async () => {
  await expect(readAnswerStream(response('{"type":"token","text":"partial"}\n'), vi.fn())).rejects.toThrow("before the answer was saved");
  await expect(readAnswerStream(response('{"type":"error","detail":"Provider offline"}\n'), vi.fn())).rejects.toThrow("Provider offline");
});
