import { tool } from "ai";
import { z } from "zod";
import {
  PLAYER_ROLES,
  analyzeBid,
  assertAuctionState,
  getCurrentPlayer,
  getNextBidAmount,
  getRemainingPlayersByRole,
  getTeamComposition,
  type Player,
  type PlayerRole
} from "../domain";
import {
  commitAgentBid,
  type BiddrAgentState
} from "./state";
import { strategyPreferencesSchema } from "./schemas";

/**
 * This is the entire model-exposed capability surface. Keep direct Agent
 * callables separate: they are browser controls, not model tools.
 */
export const BIDDR_MODEL_TOOL_NAMES = [
  "analyzeBid",
  "commitSimulatedBid",
  "getAuctionState",
  "getCurrentPlayer",
  "getStrategy",
  "getTeamComposition",
  "listRemainingPlayers"
] as const;

export function assertBiddrModelToolSurface(
  tools: Record<string, unknown>
): void {
  const actual = Object.keys(tools).sort();
  const expected = [...BIDDR_MODEL_TOOL_NAMES].sort();
  if (
    actual.length !== expected.length ||
    actual.some((toolName, index) => toolName !== expected[index])
  ) {
    throw new Error(
      "Biddr model tools must remain limited to the approved auction-only surface."
    );
  }
}

export const readOnlyToolInputSchema = z.object({}).catchall(z.unknown());

export const listRemainingPlayersInputSchema = z
  .object({
    role: z.enum(PLAYER_ROLES).optional(),
    limit: z.number().int().min(1).max(12).default(12)
  })
  .strict();

export const commitSimulatedBidInputSchema = z
  .object({
    amountLakh: z.number().int().positive()
  })
  .strict();

const playerSummarySchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(160),
    role: z.enum(PLAYER_ROLES),
    style: z.string().min(1).max(300),
    basePriceLakh: z.number().int().nonnegative(),
    estimatedValueLakh: z.number().int().nonnegative(),
    rating: z.number().int().min(0).max(100)
  })
  .strict();

const currentBidOutputSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    amountLakh: z.number().int().nonnegative(),
    bidder: z.string().min(1).max(160)
  })
  .strict();

const roleCountsSchema = z
  .object({
    batter: z.number().int().nonnegative(),
    wicketkeeper: z.number().int().nonnegative(),
    "all-rounder": z.number().int().nonnegative(),
    "fast-bowler": z.number().int().nonnegative(),
    "spin-bowler": z.number().int().nonnegative()
  })
  .strict();

const getAuctionStateOutputSchema = z
  .object({
    auctionId: z.string().min(1).max(128),
    status: z.enum(["active", "complete"]),
    teamName: z.string().min(1).max(160),
    currentLot: z.number().int().positive().nullable(),
    totalLots: z.number().int().positive(),
    purseRemainingLakh: z.number().int().nonnegative(),
    initialPurseLakh: z.number().int().nonnegative(),
    squadSize: z.number().int().nonnegative(),
    squadLimit: z.number().int().positive(),
    currentPlayerId: z.string().min(1).max(128).nullable(),
    currentBid: currentBidOutputSchema.nullable(),
    completedLots: z.number().int().nonnegative(),
    recentBids: z
      .array(
        z
          .object({
            sequence: z.number().int().positive(),
            playerId: z.string().min(1).max(128),
            amountLakh: z.number().int().nonnegative(),
            bidder: z.string().min(1).max(160)
          })
          .strict()
      )
      .max(5)
  })
  .strict();

const getCurrentPlayerOutputSchema = z.union([
  z
    .object({
      status: z.enum(["active", "complete"]),
      player: z.null(),
      nextBidLakh: z.null()
    })
    .strict(),
  z
    .object({
      status: z.literal("active"),
      player: playerSummarySchema,
      currentBid: currentBidOutputSchema.nullable(),
      nextBidLakh: z.number().int().positive()
    })
    .strict()
]);

const getTeamCompositionOutputSchema = z
  .object({
    teamName: z.string().min(1).max(160),
    purseRemainingLakh: z.number().int().nonnegative(),
    totalPlayers: z.number().int().nonnegative(),
    openSlots: z.number().int().nonnegative(),
    counts: roleCountsSchema,
    gaps: roleCountsSchema,
    squad: z
      .array(
        z
          .object({
            playerId: z.string().min(1).max(128),
            name: z.string().min(1).max(160),
            role: z.enum(PLAYER_ROLES),
            acquisitionPriceLakh: z.number().int().nonnegative(),
            source: z.enum(["retained", "auction"])
          })
          .strict()
      )
      .max(100)
  })
  .strict();

const listRemainingPlayersOutputSchema = z
  .object({
    role: z.union([z.enum(PLAYER_ROLES), z.literal("all")]),
    totalAvailable: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative().max(12),
    players: z.array(playerSummarySchema).max(12)
  })
  .strict();

const analyzeBidOutputSchema = z
  .object({
    playerId: z.string().min(1).max(128),
    decision: z.enum(["BID", "CAUTION", "PASS"]),
    maximumBidLakh: z.number().int().nonnegative(),
    nextBidLakh: z.number().int().positive(),
    headroomLakh: z.number().int(),
    factors: z
      .object({
        playerValueLakh: z.number().int().nonnegative(),
        nextBidLakh: z.number().int().positive(),
        roleTarget: z.number().int().nonnegative(),
        roleGap: z.number().int().nonnegative(),
        remainingRoleSupply: z.number().int().nonnegative(),
        scarcityScore: z.number().finite(),
        needMultiplier: z.number().finite(),
        priorityMultiplier: z.number().finite(),
        riskMultiplier: z.number().finite(),
        reserveFloorLakh: z.number().int().nonnegative(),
        spendableAboveReserveLakh: z.number().int().nonnegative(),
        openSquadSlots: z.number().int().nonnegative(),
        slotBudgetCapLakh: z.number().int().nonnegative(),
        rawCeilingLakh: z.number().int().nonnegative()
      })
      .strict(),
    reasons: z.array(z.string().min(1).max(300)).min(1).max(8)
  })
  .strict();

const commitSimulatedBidOutputSchema = z
  .object({
    actionId: z.string().min(1).max(256),
    duplicate: z.boolean(),
    playerId: z.string().min(1).max(128),
    playerName: z.string().min(1).max(160),
    amountLakh: z.number().int().positive(),
    purseRemainingLakh: z.number().int().nonnegative(),
    squadSize: z.number().int().nonnegative()
  })
  .strict();

type ListRemainingPlayersInput = z.output<
  typeof listRemainingPlayersInputSchema
>;

export type AuctionToolContext = {
  getAgentState: () => BiddrAgentState;
  setAgentState: (state: BiddrAgentState) => void;
};

function playerSummary(player: Player) {
  return {
    id: player.id,
    name: player.name,
    role: player.role,
    style: player.style,
    basePriceLakh: player.basePriceLakh,
    estimatedValueLakh: player.estimatedValueLakh,
    rating: player.rating
  };
}

function flattenRemainingPlayers(
  grouped: Record<PlayerRole, Player[]>,
  role?: PlayerRole
): Player[] {
  if (role) return grouped[role];
  return PLAYER_ROLES.flatMap((playerRole) => grouped[playerRole]);
}

export function createAuctionToolHandlers(context: AuctionToolContext) {
  const readState = () => {
    const state = context.getAgentState().auction;
    assertAuctionState(state);
    return state;
  };

  return {
    getAuctionState: () => {
      const state = readState();
      const currentPlayer = getCurrentPlayer(state);

      return {
        auctionId: state.auctionId,
        status: state.status,
        teamName: state.teamName,
        currentLot: state.status === "active" ? state.currentLotIndex + 1 : null,
        totalLots: state.playerQueue.length,
        purseRemainingLakh: state.purseRemainingLakh,
        initialPurseLakh: state.initialPurseLakh,
        squadSize: state.squad.length,
        squadLimit: state.squadLimit,
        currentPlayerId: currentPlayer?.id ?? null,
        currentBid: state.currentBid ? { ...state.currentBid } : null,
        completedLots: Object.keys(state.results).length,
        recentBids: state.bidHistory.slice(-5).map((bid) => ({ ...bid }))
      };
    },

    getCurrentPlayer: () => {
      const state = readState();
      const player = getCurrentPlayer(state);

      if (!player) {
        return { status: state.status, player: null, nextBidLakh: null };
      }

      return {
        status: state.status,
        player: playerSummary(player),
        currentBid: state.currentBid ? { ...state.currentBid } : null,
        nextBidLakh: getNextBidAmount(state)
      };
    },

    getTeamComposition: () => {
      const state = readState();
      return {
        teamName: state.teamName,
        purseRemainingLakh: state.purseRemainingLakh,
        ...getTeamComposition(state),
        squad: state.squad.map((member) => ({ ...member }))
      };
    },

    listRemainingPlayers: (input: ListRemainingPlayersInput) => {
      const state = readState();
      const grouped = getRemainingPlayersByRole(state);
      const available = flattenRemainingPlayers(grouped, input.role);

      return {
        role: input.role ?? "all",
        totalAvailable: available.length,
        returned: Math.min(available.length, input.limit),
        players: available.slice(0, input.limit).map(playerSummary)
      };
    },

    analyzeBid: () => analyzeBid(readState()),

    getStrategy: () => {
      const state = readState();
      return {
        ...state.strategy,
        priorityRoles: [...state.strategy.priorityRoles]
      };
    },

    commitSimulatedBid: (input: {
      amountLakh: number;
      actionId: string;
    }) => {
      const committed = commitAgentBid(
        context.getAgentState(),
        input.amountLakh,
        input.actionId
      );
      if (!committed.result.duplicate) {
        context.setAgentState(committed.state);
      }
      return committed.result;
    }
  };
}

export function createAuctionTools(context: AuctionToolContext) {
  const handlers = createAuctionToolHandlers(context);

  return {
    getAuctionState: tool({
      description:
        "Read the current auction summary, purse, active lot, current bid, and recent bid history. Use this instead of guessing auction numbers.",
      inputSchema: readOnlyToolInputSchema,
      outputSchema: getAuctionStateOutputSchema,
      execute: handlers.getAuctionState
    }),
    getCurrentPlayer: tool({
      description:
        "Read the active fictional player's role, style, valuation, current bid, and next valid bid.",
      inputSchema: readOnlyToolInputSchema,
      outputSchema: getCurrentPlayerOutputSchema,
      execute: handlers.getCurrentPlayer
    }),
    getTeamComposition: tool({
      description:
        "Read the user's current fictional squad, role counts, open slots, role gaps, and remaining purse.",
      inputSchema: readOnlyToolInputSchema,
      outputSchema: getTeamCompositionOutputSchema,
      execute: handlers.getTeamComposition
    }),
    listRemainingPlayers: tool({
      description:
        "List unresolved fictional auction players, optionally filtered by role. Use this to compare future supply and scarcity.",
      inputSchema: listRemainingPlayersInputSchema,
      outputSchema: listRemainingPlayersOutputSchema,
      execute: handlers.listRemainingPlayers
    }),
    analyzeBid: tool({
      description:
        "Run Biddr's deterministic valuation engine for the active player. Returns BID, CAUTION, or PASS, a maximum bid, transparent numerical factors, and reasons.",
      inputSchema: readOnlyToolInputSchema,
      outputSchema: analyzeBidOutputSchema,
      execute: handlers.analyzeBid
    }),
    getStrategy: tool({
      description:
        "Read the remembered reserve percentage, risk tolerance, and priority roles that influence recommendations.",
      inputSchema: readOnlyToolInputSchema,
      outputSchema: strategyPreferencesSchema,
      execute: handlers.getStrategy
    }),
    commitSimulatedBid: tool({
      description:
        "Commit an exact simulated bid only after analyzing the active player. This spends purse and adds the player, so it always requires explicit user approval.",
      inputSchema: commitSimulatedBidInputSchema,
      outputSchema: commitSimulatedBidOutputSchema,
      needsApproval: true,
      execute: (input, options) =>
        handlers.commitSimulatedBid({
          amountLakh: input.amountLakh,
          actionId: options.toolCallId
        })
    })
  };
}
