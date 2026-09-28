import { describe, expect, it } from "vitest";
import type { UIMessageChunk } from "ai";
import {
  buildDeterministicFallbackMessage,
  createDeterministicFallbackResponse,
  createFallbackAwareResponse
} from "../../src/agent/fallback";
import { createInitialAuctionState } from "../../src/domain";

describe("deterministic inference fallback", () => {
  it("grounds its recommendation in the deterministic engine", () => {
    const message = buildDeterministicFallbackMessage(
      createInitialAuctionState()
    );

    expect(message).toContain("Workers AI is unavailable or its daily quota");
    expect(message).toContain("BID on Aarya Sen");
    expect(message).toContain("next valid bid is ₹260L");
    expect(message).toContain("maximum recommended bid is ₹460L");
    expect(message).toContain("₹3860L remains in the purse");
  });

  it("returns a valid UI message stream for synchronous failures", async () => {
    const response = createDeterministicFallbackResponse(
      createInitialAuctionState()
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("Biddr is using its deterministic auction engine");
    expect(body).toContain("Aarya Sen");
  });

  it.each([
    ["How much purse remains?", "₹38.60 Cr remaining"],
    ["Who are the remaining fast bowlers?", "Kabir Das (91)"],
    ["What is our team composition?", "7 players and 8 open slots"],
    ["Who is the current player?", "Aarya Sen, a fast bowler"],
    ["What is the current lot and latest bid?", "lot 1 of 12"]
  ])("answers %s from deterministic state", (question, expected) => {
    expect(
      buildDeterministicFallbackMessage(createInitialAuctionState(), question)
    ).toContain(expected);
  });

  it("redirects unrelated fallback questions to auction capabilities", () => {
    const message = buildDeterministicFallbackMessage(
      createInitialAuctionState(),
      "What is the weather tomorrow?"
    );

    expect(message).toContain("focused on this fictional auction");
    expect(message).not.toContain("BID on Aarya Sen");
  });

  it("replaces a provider error chunk with normal fallback text", async () => {
    const failedStream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({ type: "error", errorText: "secret provider error" });
        controller.close();
      }
    });
    const response = createFallbackAwareResponse(
      failedStream,
      createInitialAuctionState,
      () => "What's our maximum safe bid?"
    );
    const body = await response.text();

    expect(body).toContain("Biddr is using its deterministic auction engine");
    expect(body).not.toContain("secret provider error");
    expect(body).not.toContain('"type":"error"');
    expect(body).toContain("maximum safe bid for Aarya Sen is ₹4.60 Cr");
  });
});
