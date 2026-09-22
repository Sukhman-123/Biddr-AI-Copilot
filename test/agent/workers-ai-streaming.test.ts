import { describe, expect, it, vi } from "vitest";
import { streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

function createSseResponse(events: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

describe("Workers AI dual-format streaming compatibility", () => {
  it("emits each Llama text chunk once when both response formats are present", async () => {
    const run = vi.fn(() =>
      createSseResponse([
        {
          response: "The ",
          choices: [{ delta: { content: "The " } }]
        },
        {
          response: "answer.",
          choices: [{ delta: { content: "answer." }, finish_reason: "stop" }]
        }
      ])
    );
    const workersai = createWorkersAI({ binding: { run } as never });
    const result = streamText({
      model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
      prompt: "Return a short answer."
    });

    await expect(result.text).resolves.toBe("The answer.");
    expect(run).toHaveBeenCalledOnce();
  });
});
