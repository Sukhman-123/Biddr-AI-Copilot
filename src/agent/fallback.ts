import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageChunk
} from "ai";
import {
  analyzeBid,
  getCurrentPlayer,
  type AuctionState
} from "../domain";

const FALLBACK_TEXT_PART_ID = "biddr-deterministic-fallback";

export function buildDeterministicFallbackMessage(
  state: AuctionState
): string {
  const player = getCurrentPlayer(state);

  if (!player) {
    return "Workers AI is unavailable or its daily quota has been reached. Biddr is using its deterministic auction state: all lots are complete, so there is no active bid to evaluate.";
  }

  const recommendation = analyzeBid(state);
  return [
    "Workers AI is unavailable or its daily quota has been reached, so Biddr is using its deterministic auction engine.",
    `${recommendation.decision} on ${player.name}.`,
    `The next valid bid is ₹${recommendation.nextBidLakh}L, the maximum recommended bid is ₹${recommendation.maximumBidLakh}L, and ₹${state.purseRemainingLakh}L remains in the purse.`,
    ...recommendation.reasons
  ].join(" ");
}

function writeFallbackChunks(
  enqueue: (chunk: UIMessageChunk) => void,
  message: string
) {
  enqueue({ type: "text-start", id: FALLBACK_TEXT_PART_ID });
  enqueue({
    type: "text-delta",
    id: FALLBACK_TEXT_PART_ID,
    delta: message
  });
  enqueue({ type: "text-end", id: FALLBACK_TEXT_PART_ID });
}

export function createDeterministicFallbackResponse(
  state: AuctionState
): Response {
  const message = buildDeterministicFallbackMessage(state);
  return createTextResponse(message);
}

export function createTextResponse(message: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writeFallbackChunks((chunk) => writer.write(chunk), message);
    }
  });

  return createUIMessageStreamResponse({ stream });
}

export function createFallbackAwareResponse(
  modelStream: ReadableStream<UIMessageChunk>,
  getState: () => AuctionState
): Response {
  let fallbackWritten = false;
  const stream = modelStream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type !== "error") {
          controller.enqueue(chunk);
          return;
        }

        if (!fallbackWritten) {
          fallbackWritten = true;
          writeFallbackChunks((fallbackChunk) => {
            controller.enqueue(fallbackChunk);
          }, buildDeterministicFallbackMessage(getState()));
        }
      }
    })
  );

  return createUIMessageStreamResponse({ stream });
}
