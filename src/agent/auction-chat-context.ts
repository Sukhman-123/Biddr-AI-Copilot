import {
  PLAYER_ROLES,
  analyzeBid,
  assertAuctionState,
  getCurrentPlayer,
  getNextBidAmount,
  getRemainingPlayersByRole,
  getRoleMarket,
  getTeamComposition,
  type AuctionState
} from "../domain";
import type {
  CopilotConversationResolution
} from "./knowledge-base";
import {
  getRequiredContextSections,
  type AuctionContextSection
} from "../shared/copilot-capabilities";

export function buildAuctionChatContext(
  state: AuctionState,
  resolution?: CopilotConversationResolution
): string {
  assertAuctionState(state);
  const includeFullContext = resolution === undefined;
  const intents = resolution?.intents ?? [];
  const requiredSections = getRequiredContextSections(intents);
  const includesSection = (section: AuctionContextSection) =>
    includeFullContext || requiredSections.has(section);
  const currentPlayer = getCurrentPlayer(state);
  const composition = getTeamComposition(state);
  const includeRecommendation = includesSection("recommendation");
  const includePlayerDetails = includesSection("active-player-details");
  const includeBidState = includesSection("active-bid");
  const includeStrategy = includesSection("strategy");
  const includeTeamComposition = includesSection("team-composition");
  const includeSquad = includesSection("squad");
  const includeRoleMarkets = includesSection("role-markets");
  const includeRemainingPlayers = includesSection("remaining-players");
  const includeFinancialSummary = includesSection("financial-summary");
  const includeSquadSummary = includesSection("squad-summary");
  const selectedRole =
    resolution?.referencedRole ??
    (intents.includes("comparison") ? currentPlayer?.role ?? null : null);
  const selectedRoles =
    selectedRole && !includeFullContext ? [selectedRole] : PLAYER_ROLES;
  const remainingPlayers = includeRemainingPlayers
    ? getRemainingPlayersByRole(state)
    : null;
  const active = currentPlayer
    ? {
        player: {
          id: currentPlayer.id,
          name: currentPlayer.name,
          role: currentPlayer.role,
          ...(includePlayerDetails
            ? {
                style: currentPlayer.style,
                basePriceLakh: currentPlayer.basePriceLakh,
                estimatedValueLakh: currentPlayer.estimatedValueLakh,
                rating: currentPlayer.rating
              }
            : {})
        },
        ...(includeBidState
          ? {
              currentBid: state.currentBid,
              nextBidLakh: getNextBidAmount(state)
            }
          : {}),
        ...(includeRecommendation
          ? { recommendation: analyzeBid(state) }
          : {})
      }
    : null;

  const context: Record<string, unknown> = {
    moneyUnit: "All monetary values are integer INR lakh; 100 lakh equals ₹1 crore.",
    selection: {
      intents: includeFullContext ? ["full-context"] : intents,
      referencedRole: selectedRole,
      includedSections: [
        "auction",
        "active",
        ...(includeStrategy ? ["strategy"] : []),
        ...(includeTeamComposition ? ["teamComposition"] : []),
        ...(includeRoleMarkets ? ["roleMarkets"] : []),
        ...(includeRemainingPlayers ? ["remainingPlayers"] : []),
        ...(includeSquad ? ["squad"] : []),
        ...(resolution?.referencedPlayer &&
        !resolution.referencedPlayerIsCurrent
          ? ["referencedPlayer"]
          : [])
      ]
    },
    auction: {
      status: state.status,
      teamName: state.teamName,
      currentLot:
        state.status === "active" ? state.currentLotIndex + 1 : null,
      totalLots: state.playerQueue.length,
      completedLots: Object.keys(state.results).length,
      ...(includeFinancialSummary
        ? {
            purseRemainingLakh: state.purseRemainingLakh,
            initialPurseLakh: state.initialPurseLakh
          }
        : {}),
      ...(includeSquadSummary
        ? {
            squadSize: state.squad.length,
            squadLimit: state.squadLimit
          }
        : {})
    },
    active
  };
  if (includeStrategy) context.strategy = state.strategy;
  if (includeTeamComposition) context.teamComposition = composition;
  if (includeRoleMarkets) {
    context.roleMarkets = Object.fromEntries(
      selectedRoles.map((role) => [role, getRoleMarket(state, role)])
    );
  }
  if (includeRemainingPlayers && remainingPlayers) {
    context.remainingPlayers = Object.fromEntries(
      selectedRoles.map((role) => [
        role,
        remainingPlayers[role].map((player) => ({
          id: player.id,
          name: player.name,
          estimatedValueLakh: player.estimatedValueLakh,
          rating: player.rating
        }))
      ])
    );
  }
  if (includeSquad) context.squad = state.squad;
  if (
    resolution?.referencedPlayer &&
    !resolution.referencedPlayerIsCurrent
  ) {
    context.referencedPlayer = resolution.referencedPlayer;
  }

  return [
    "[TRUSTED_DETERMINISTIC_AUCTION_CONTEXT]",
    JSON.stringify(context),
    "[END_TRUSTED_DETERMINISTIC_AUCTION_CONTEXT]"
  ].join("\n");
}
