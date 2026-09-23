import { describe, expect, it } from "vitest";
import { safeValidateUIMessages } from "ai";
import {
  createInitialAgentState,
  passAgentCurrentPlayer
} from "../../src/agent/state";
import {
  assertBiddrModelToolSurface,
  BIDDR_MODEL_TOOL_NAMES,
  commitSimulatedBidInputSchema,
  createAuctionToolHandlers,
  createAuctionTools,
  listRemainingPlayersInputSchema,
  readOnlyToolInputSchema
} from "../../src/agent/tools";
import { analyzeBid } from "../../src/domain";

function createContext() {
  let state = createInitialAgentState();
  return {
    context: {
      getAgentState: () => state,
      setAgentState: (nextState: typeof state) => {
        state = nextState;
      }
    },
    getState: () => state
  };
}

describe("auction tool schemas", () => {
  it("ignores harmless arguments supplied to read-only tools", () => {
    expect(
      readOnlyToolInputSchema.parse({
        player: "current",
        includeReasoning: true
      })
    ).toEqual({ player: "current", includeReasoning: true });
  });

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

  it("accepts only positive whole-lakh simulated bids", () => {
    expect(commitSimulatedBidInputSchema.parse({ amountLakh: 260 })).toEqual({
      amountLakh: 260
    });
    expect(() =>
      commitSimulatedBidInputSchema.parse({ amountLakh: 260.5 })
    ).toThrow();
    expect(() =>
      commitSimulatedBidInputSchema.parse({ amountLakh: -260 })
    ).toThrow();
    expect(() =>
      commitSimulatedBidInputSchema.parse({ amountLakh: 260, actionId: "fake" })
    ).toThrow();
  });
});

describe("deterministic auction tool handlers", () => {
  it("exposes the complete typed read and analysis tool surface", () => {
    const { context } = createContext();
    const tools = createAuctionTools(context);

    expect(Object.keys(tools).sort()).toEqual([...BIDDR_MODEL_TOOL_NAMES].sort());
    expect(() => assertBiddrModelToolSurface(tools)).not.toThrow();
    for (const configuredTool of Object.values(tools)) {
      expect(configuredTool.inputSchema).toBeDefined();
      expect(configuredTool.outputSchema).toBeDefined();
      expect(configuredTool.execute).toBeTypeOf("function");
    }
    expect(tools.commitSimulatedBid.needsApproval).toBe(true);
  });

  it("rejects a model tool surface with unapproved capabilities", () => {
    expect(() =>
      assertBiddrModelToolSurface({
        getAuctionState: {},
        openUrl: {}
      })
    ).toThrow("approved auction-only surface");
  });

  it("grounds auction, player, composition, and strategy data in current state", () => {
    const { context, getState } = createContext();
    const state = getState().auction;
    const handlers = createAuctionToolHandlers(context);

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
      getAgentState: () => agentState,
      setAgentState: (nextState) => {
        agentState = nextState;
      }
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
    const { context } = createContext();
    const handlers = createAuctionToolHandlers(context);
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
    const { context, getState } = createContext();
    const state = getState().auction;
    const handlers = createAuctionToolHandlers(context);

    expect(handlers.analyzeBid()).toEqual(analyzeBid(state));
  });

  it("validates persisted tool inputs and outputs before model reuse", async () => {
    const { context } = createContext();
    const tools = createAuctionTools(context);
    const analyze = tools.analyzeBid.execute;
    if (!analyze) throw new Error("Analysis tool must be executable.");

    const output = await analyze(
      { player: "current" },
      { toolCallId: "analysis-1", messages: [] }
    );
    const valid = await safeValidateUIMessages({
      messages: [
        {
          id: "assistant-analysis",
          role: "assistant",
          parts: [
            {
              type: "tool-analyzeBid",
              toolCallId: "analysis-1",
              state: "output-available",
              input: { player: "current" },
              output
            }
          ]
        }
      ],
      tools: tools as never
    });
    const invalid = await safeValidateUIMessages({
      messages: [
        {
          id: "assistant-corrupt-output",
          role: "assistant",
          parts: [
            {
              type: "tool-analyzeBid",
              toolCallId: "analysis-2",
              state: "output-available",
              input: {},
              output: { decision: "BID", maximumBidLakh: "corrupt" }
            }
          ]
        }
      ],
      tools: tools as never
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("mutates state once after an approved tool execution", async () => {
    const { context, getState } = createContext();
    const before = getState();
    const tools = createAuctionTools(context);
    const execute = tools.commitSimulatedBid.execute;

    if (!execute) throw new Error("Commit tool must be executable.");
    const first = await execute(
      { amountLakh: 260 },
      { toolCallId: "approved-bid-1", messages: [] }
    );
    const afterFirst = getState();
    const replay = await execute(
      { amountLakh: 260 },
      { toolCallId: "approved-bid-1", messages: [] }
    );

    expect(first).toMatchObject({
      duplicate: false,
      playerId: "aarya-sen",
      amountLakh: 260
    });
    expect(afterFirst.auction.purseRemainingLakh).toBe(
      before.auction.purseRemainingLakh - 260
    );
    expect(afterFirst.auction.squad).toHaveLength(before.auction.squad.length + 1);
    expect(replay).toMatchObject({ duplicate: true, actionId: "approved-bid-1" });
    expect(replay).toMatchObject({
      playerId: "aarya-sen",
      playerName: "Aarya Sen",
      amountLakh: 260,
      purseRemainingLakh: 3600,
      squadSize: 8
    });
    expect(getState()).toEqual(afterFirst);
  });

  it("does not mutate state when a proposed bid is invalid", async () => {
    const { context, getState } = createContext();
    const before = structuredClone(getState());
    const execute = createAuctionTools(context).commitSimulatedBid.execute;

    if (!execute) throw new Error("Commit tool must be executable.");
    expect(() =>
      execute(
        { amountLakh: 261 },
        { toolCallId: "invalid-bid", messages: [] }
      )
    ).toThrow("auction increment");
    expect(getState()).toEqual(before);
  });
});
