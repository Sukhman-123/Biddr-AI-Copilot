import { describe, expect, it } from "vitest";
import {
  createInitialAgentState,
  passAgentCurrentPlayer
} from "../../src/agent/state";
import {
  createAuctionToolHandlers,
  createAuctionTools,
  listRemainingPlayersInputSchema
} from "../../src/agent/tools";
import { analyzeBid, createInitialAuctionState } from "../../src/domain";

describe("auction tool schemas", () => {
  it("accepts bounded role filters and supplies the default limit", () => {
    expect(listRemainingPlayersInputSchema.parse({})).toEqual({ limit: 12 });
    expect(
      listRemainingPlayersInputSchema.parse({
        role: "fast-bowler",
        limit: 2
      })
    ).toEqual({ role: "fast-bowler", limit: 2 });
  });

  it("rejects unknown roles, invalid limits, and extra properties", () => {
    expect(() =>
      listRemainingPlayersInputSchema.parse({ role: "coach" })
    ).toThrow();
    expect(() => listRemainingPlayersInputSchema.parse({ limit: 0 })).toThrow();
    expect(() =>
      listRemainingPlayersInputSchema.parse({ limit: 2, injected: true })
    ).toThrow();
  });
});

describe("deterministic auction tool handlers", () => {
  it("exposes the complete typed read and analysis tool surface", () => {
    const tools = createAuctionTools({
      getAuctionState: createInitialAuctionState
    });

    expect(Object.keys(tools).sort()).toEqual([
      "analyzeBid",
      "getAuctionState",
      "getCurrentPlayer",
      "getStrategy",
      "getTeamComposition",
      "listRemainingPlayers"
    ]);
    for (const configuredTool of Object.values(tools)) {
      expect(configuredTool.inputSchema).toBeDefined();
      expect(configuredTool.execute).toBeTypeOf("function");
    }
  });

  it("grounds auction, player, composition, and strategy data in current state", () => {
    const state = createInitialAuctionState();
    const handlers = createAuctionToolHandlers({ getAuctionState: () => state });

    expect(handlers.getAuctionState()).toMatchObject({
      teamName: "Bengaluru Comets",
      purseRemainingLakh: 3860,
      squadSize: 7,
      currentPlayerId: "aarya-sen"
    });
    expect(handlers.getCurrentPlayer()).toMatchObject({
      player: { id: "aarya-sen", role: "fast-bowler" },
      nextBidLakh: 260
    });
    expect(handlers.getTeamComposition()).toMatchObject({
      totalPlayers: 7,
      openSlots: 8,
      gaps: { "fast-bowler": 2 }
    });
    expect(handlers.getStrategy()).toEqual(state.strategy);
  });

  it("uses fresh state for every call rather than a captured snapshot", () => {
    let agentState = createInitialAgentState();
    const handlers = createAuctionToolHandlers({
      getAuctionState: () => agentState.auction
    });

    expect(handlers.getCurrentPlayer()).toMatchObject({
      player: { id: "aarya-sen" }
    });
    agentState = passAgentCurrentPlayer(agentState);
    expect(handlers.getCurrentPlayer()).toMatchObject({
      player: { id: "vivaan-rao" }
    });
  });

  it("filters and bounds remaining-player results", () => {
    const handlers = createAuctionToolHandlers({
      getAuctionState: createInitialAuctionState
    });
    const result = handlers.listRemainingPlayers({
      role: "fast-bowler",
      limit: 2
    });

    expect(result.totalAvailable).toBe(3);
    expect(result.returned).toBe(2);
    expect(result.players).toHaveLength(2);
    expect(result.players.every((player) => player.role === "fast-bowler")).toBe(
      true
    );
  });

  it("returns the authoritative deterministic recommendation unchanged", () => {
    const state = createInitialAuctionState();
    const handlers = createAuctionToolHandlers({ getAuctionState: () => state });

    expect(handlers.analyzeBid()).toEqual(analyzeBid(state));
  });
});
