import { describe, expect, it } from "vitest";
import { buildAuctionChatContext } from "../../src/agent/auction-chat-context";
import { createInitialAuctionState, passCurrentPlayer } from "../../src/domain";

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
});
