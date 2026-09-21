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
  type AuctionState,
  type Player,
  type PlayerRole
} from "../domain";

const emptyInputSchema = z.object({}).strict();

export const listRemainingPlayersInputSchema = z
  .object({
    role: z.enum(PLAYER_ROLES).optional(),
    limit: z.number().int().min(1).max(12).default(12)
  })
  .strict();

type ListRemainingPlayersInput = z.output<
  typeof listRemainingPlayersInputSchema
>;

export type AuctionToolContext = {
  getAuctionState: () => AuctionState;
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
    const state = context.getAuctionState();
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
    }
  };
}

export function createAuctionTools(context: AuctionToolContext) {
  const handlers = createAuctionToolHandlers(context);

  return {
    getAuctionState: tool({
      description:
        "Read the current auction summary, purse, active lot, current bid, and recent bid history. Use this instead of guessing auction numbers.",
      inputSchema: emptyInputSchema,
      execute: handlers.getAuctionState
    }),
    getCurrentPlayer: tool({
      description:
        "Read the active fictional player's role, style, valuation, current bid, and next valid bid.",
      inputSchema: emptyInputSchema,
      execute: handlers.getCurrentPlayer
    }),
    getTeamComposition: tool({
      description:
        "Read the user's current fictional squad, role counts, open slots, role gaps, and remaining purse.",
      inputSchema: emptyInputSchema,
      execute: handlers.getTeamComposition
    }),
    listRemainingPlayers: tool({
      description:
        "List unresolved fictional auction players, optionally filtered by role. Use this to compare future supply and scarcity.",
      inputSchema: listRemainingPlayersInputSchema,
      execute: handlers.listRemainingPlayers
    }),
    analyzeBid: tool({
      description:
        "Run Biddr's deterministic valuation engine for the active player. Returns BID, CAUTION, or PASS, a maximum bid, transparent numerical factors, and reasons.",
      inputSchema: emptyInputSchema,
      execute: handlers.analyzeBid
    }),
    getStrategy: tool({
      description:
        "Read the remembered reserve percentage, risk tolerance, and priority roles that influence recommendations.",
      inputSchema: emptyInputSchema,
      execute: handlers.getStrategy
    })
  };
}

