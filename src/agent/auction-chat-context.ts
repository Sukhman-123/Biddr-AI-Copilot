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

export function buildAuctionChatContext(state: AuctionState): string {
  assertAuctionState(state);
  const currentPlayer = getCurrentPlayer(state);
  const composition = getTeamComposition(state);
  const remainingPlayers = getRemainingPlayersByRole(state);
  const active = currentPlayer
    ? {
        player: {
          id: currentPlayer.id,
          name: currentPlayer.name,
          role: currentPlayer.role,
          style: currentPlayer.style,
          basePriceLakh: currentPlayer.basePriceLakh,
          estimatedValueLakh: currentPlayer.estimatedValueLakh,
          rating: currentPlayer.rating
        },
        currentBid: state.currentBid,
        nextBidLakh: getNextBidAmount(state),
        recommendation: analyzeBid(state)
      }
    : null;

  const context = {
    moneyUnit: "All monetary values are integer INR lakh; 100 lakh equals ₹1 crore.",
    auction: {
      status: state.status,
      teamName: state.teamName,
      currentLot:
        state.status === "active" ? state.currentLotIndex + 1 : null,
      totalLots: state.playerQueue.length,
      purseRemainingLakh: state.purseRemainingLakh,
      initialPurseLakh: state.initialPurseLakh,
      squadSize: state.squad.length,
      squadLimit: state.squadLimit,
      completedLots: Object.keys(state.results).length
    },
    active,
    strategy: state.strategy,
    teamComposition: composition,
    roleMarkets: Object.fromEntries(
      PLAYER_ROLES.map((role) => [role, getRoleMarket(state, role)])
    ),
    remainingPlayers: Object.fromEntries(
      PLAYER_ROLES.map((role) => [
        role,
        remainingPlayers[role].map((player) => ({
          id: player.id,
          name: player.name,
          estimatedValueLakh: player.estimatedValueLakh,
          rating: player.rating
        }))
      ])
    ),
    squad: state.squad
  };

  return [
    "[TRUSTED_DETERMINISTIC_AUCTION_CONTEXT]",
    JSON.stringify(context),
    "[END_TRUSTED_DETERMINISTIC_AUCTION_CONTEXT]"
  ].join("\n");
}
