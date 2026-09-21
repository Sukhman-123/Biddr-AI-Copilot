import { describe, expect, it } from "vitest";
import { createInitialAgentState } from "../../src/agent/state";

describe("BiddrCopilotAgent foundation", () => {
  it("creates an isolated, versioned auction state for each Agent instance", () => {
    const first = createInitialAgentState();
    const second = createInitialAgentState();

    expect(first.schemaVersion).toBe(1);
    expect(first.auction.status).toBe("active");
    expect(first.auction.strategy.reservePercent).toBe(30);
    expect(first.processedActionIds).toEqual([]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.auction).not.toBe(second.auction);
  });
});
