import { describe, expect, it } from "vitest";
import { buildAuctionChatContext } from "../../src/agent/auction-chat-context";
import { resolveCopilotConversation } from "../../src/agent/knowledge-base";
import { createInitialAuctionState, passCurrentPlayer } from "../../src/domain";

function scopedContext(question: string) {
  const state = createInitialAuctionState();
  const resolution = resolveCopilotConversation(
    [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: question }]
      }
    ],
    state
  );
  const framed = buildAuctionChatContext(state, resolution);
  const payload = framed.split("\n")[1];
  if (!payload) throw new Error("Auction context is missing its JSON payload");
  return JSON.parse(payload) as Record<string, unknown>;
}

describe("trusted deterministic auction chat context", () => {
  it("contains every fact needed by the primary copilot questions", () => {
    const context = buildAuctionChatContext(createInitialAuctionState());

    expect(context).toContain("TRUSTED_DETERMINISTIC_AUCTION_CONTEXT");
    expect(context).toContain('"name":"Aarya Sen"');
    expect(context).toContain('"purseRemainingLakh":3860');
    expect(context).toContain('"maximumBidLakh":460');
    expect(context).toContain('"nextBidLakh":260');
    expect(context).toContain('"reservePercent":30');
    expect(context).toContain('"fast-bowler"');
    expect(context).toContain('"roleMarkets"');
  });

  it("tracks auction transitions rather than retaining a stale snapshot", () => {
    const nextState = passCurrentPlayer(createInitialAuctionState());
    const context = buildAuctionChatContext(nextState);

    expect(context).toContain('"name":"Vivaan Rao"');
    expect(context).not.toContain('"active":{"player":{"id":"aarya-sen"');
  });

  it("provides bid facts without unrelated rosters for safe-bid questions", () => {
    const context = scopedContext("What's our maximum safe bid?");
    const active = context.active as Record<string, unknown>;

    expect(active).toHaveProperty("recommendation.maximumBidLakh", 460);
    expect(active).toHaveProperty("nextBidLakh", 260);
    expect(context).toHaveProperty("strategy.reservePercent", 30);
    expect(context).not.toHaveProperty("remainingPlayers");
    expect(context).not.toHaveProperty("roleMarkets");
    expect(context).not.toHaveProperty("squad");
  });

  it("provides squad details without bid analysis for composition questions", () => {
    const context = scopedContext("What is our team composition?");
    const active = context.active as Record<string, unknown>;

    expect(context).toHaveProperty("teamComposition.openSlots", 8);
    expect(context).toHaveProperty("squad");
    expect(active).not.toHaveProperty("recommendation");
    expect(context).not.toHaveProperty("remainingPlayers");
    expect(context).not.toHaveProperty("strategy");
  });

  it("filters remaining-player context to the requested role", () => {
    const context = scopedContext("Who are the remaining pacers?");
    const remaining = context.remainingPlayers as Record<string, unknown>;
    const markets = context.roleMarkets as Record<string, unknown>;

    expect(Object.keys(remaining)).toEqual(["fast-bowler"]);
    expect(Object.keys(markets)).toEqual(["fast-bowler"]);
    expect(JSON.stringify(remaining)).toContain("Kabir Das");
    expect(JSON.stringify(remaining)).not.toContain("Vivaan Rao");
    expect(context).toHaveProperty("teamComposition.gaps.fast-bowler", 2);
  });

  it("combines the sections required by a compound question", () => {
    const context = scopedContext(
      "How much purse remains and which players are still available?"
    );
    const selection = context.selection as Record<string, unknown>;

    expect(selection.intents).toEqual([
      "purse-reserve",
      "remaining-players"
    ]);
    expect(context).toHaveProperty("auction.purseRemainingLakh", 3860);
    expect(context).toHaveProperty("active.recommendation");
    expect(context).toHaveProperty("remainingPlayers");
    expect(context).toHaveProperty("roleMarkets");
  });

  it("keeps unsupported questions on a minimal auction scope", () => {
    const context = scopedContext("What is the weather tomorrow?");
    const active = context.active as Record<string, unknown>;

    expect(context).toHaveProperty("auction.status", "active");
    expect(active).toEqual({
      player: { id: "aarya-sen", name: "Aarya Sen", role: "fast-bowler" }
    });
    expect(context).not.toHaveProperty("strategy");
    expect(context).not.toHaveProperty("teamComposition");
    expect(context).not.toHaveProperty("remainingPlayers");
    expect(context).not.toHaveProperty("squad");
  });

  it("includes a resolved future player without mixing recommendation ownership", () => {
    const state = createInitialAuctionState();
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Analyze this player" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "BID on Aarya Sen." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "What about Kabir?" }]
        }
      ],
      state
    );
    const framed = buildAuctionChatContext(state, resolution);
    const payload = framed.split("\n")[1];
    if (!payload) throw new Error("Auction context is missing its JSON payload");
    const context = JSON.parse(payload) as Record<string, unknown>;

    expect(context).toHaveProperty("referencedPlayer.name", "Kabir Das");
    expect(context).toHaveProperty("referencedPlayer.rating", 91);
    expect(context).toHaveProperty("active.player.name", "Aarya Sen");
    expect(context).toHaveProperty(
      "active.recommendation.playerId",
      "aarya-sen"
    );
    expect(context).not.toHaveProperty("remainingPlayers");
    expect(context).not.toHaveProperty("squad");
  });
});
