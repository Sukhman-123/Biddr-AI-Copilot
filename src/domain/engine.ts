import { ROLE_TARGETS, createInitialAuctionState } from "./seed";
import {
  PLAYER_ROLES,
  type AuctionState,
  type BidRecommendation,
  type LotResult,
  type MoneyLakh,
  type Player,
  type PlayerRole,
  type RoleMarket,
  type StrategyPreferences,
  type TeamComposition
} from "./types";

export class AuctionRuleError extends Error {
  constructor(
    readonly code:
      | "AUCTION_COMPLETE"
      | "INVALID_STATE"
      | "INVALID_BID"
      | "INSUFFICIENT_PURSE"
      | "SQUAD_FULL"
      | "ABOVE_RECOMMENDED_CEILING",
    message: string
  ) {
    super(message);
    this.name = "AuctionRuleError";
  }
}

const RISK_MULTIPLIERS = {
  conservative: 0.92,
  balanced: 1,
  aggressive: 1.08
} as const;

function emptyRoleRecord(): Record<PlayerRole, number> {
  return {
    batter: 0,
    wicketkeeper: 0,
    "all-rounder": 0,
    "fast-bowler": 0,
    "spin-bowler": 0
  };
}

function roundTo(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function copyState(state: AuctionState): AuctionState {
  return {
    ...state,
    squad: state.squad.map((member) => ({ ...member })),
    playerQueue: state.playerQueue.map((player) => ({ ...player })),
    currentBid: state.currentBid ? { ...state.currentBid } : null,
    results: Object.fromEntries(
      Object.entries(state.results).map(([id, result]) => [id, { ...result }])
    ),
    bidHistory: state.bidHistory.map((bid) => ({ ...bid })),
    eventLog: state.eventLog.map((event) => ({ ...event })),
    strategy: {
      ...state.strategy,
      priorityRoles: [...state.strategy.priorityRoles]
    }
  };
}

export function getCurrentPlayer(state: AuctionState): Player | null {
  if (state.status === "complete") return null;
  return state.playerQueue[state.currentLotIndex] ?? null;
}

export function getTeamComposition(state: AuctionState): TeamComposition {
  const counts = emptyRoleRecord();

  for (const member of state.squad) {
    counts[member.role] += 1;
  }

  const gaps = emptyRoleRecord();
  for (const role of PLAYER_ROLES) {
    gaps[role] = Math.max(ROLE_TARGETS[role] - counts[role], 0);
  }

  return {
    totalPlayers: state.squad.length,
    openSlots: Math.max(state.squadLimit - state.squad.length, 0),
    counts,
    gaps
  };
}

export function getRemainingPlayersByRole(
  state: AuctionState
): Record<PlayerRole, Player[]> {
  const remaining: Record<PlayerRole, Player[]> = {
    batter: [],
    wicketkeeper: [],
    "all-rounder": [],
    "fast-bowler": [],
    "spin-bowler": []
  };

  for (let index = state.currentLotIndex; index < state.playerQueue.length; index += 1) {
    const player = state.playerQueue[index];
    if (player && !state.results[player.id]) {
      remaining[player.role].push({ ...player });
    }
  }

  return remaining;
}

export function getRoleMarket(
  state: AuctionState,
  role: PlayerRole
): RoleMarket {
  const composition = getTeamComposition(state);
  const remainingSupply = getRemainingPlayersByRole(state)[role].length;
  const squadGap = composition.gaps[role];
  const target = ROLE_TARGETS[role];
  const supplyPressure =
    squadGap === 0 ? 0 : Math.min(squadGap / Math.max(remainingSupply, 1), 1);
  const rosterPressure = squadGap / target;
  const scarcityScore = Math.round(
    Math.min(1, supplyPressure * 0.65 + rosterPressure * 0.35) * 100
  );

  return { role, squadGap, target, remainingSupply, scarcityScore };
}

export function getBidIncrement(currentAmountLakh: MoneyLakh): MoneyLakh {
  if (currentAmountLakh < 200) return 10;
  if (currentAmountLakh < 500) return 20;
  if (currentAmountLakh < 1000) return 25;
  return 50;
}

export function getNextBidAmount(state: AuctionState): MoneyLakh {
  const player = getRequiredCurrentPlayer(state);
  const currentAmount = state.currentBid?.amountLakh ?? player.basePriceLakh;
  return currentAmount + getBidIncrement(currentAmount);
}

function getRequiredCurrentPlayer(state: AuctionState): Player {
  const player = getCurrentPlayer(state);
  if (!player) {
    throw new AuctionRuleError(
      "AUCTION_COMPLETE",
      "The auction has no active player."
    );
  }
  return player;
}

function maximumAlignedBid(
  rawMaximum: MoneyLakh,
  currentAmount: MoneyLakh,
  increment: MoneyLakh
): MoneyLakh {
  if (rawMaximum < currentAmount + increment) return 0;
  return currentAmount + Math.floor((rawMaximum - currentAmount) / increment) * increment;
}

export function analyzeBid(
  state: AuctionState,
  strategy: StrategyPreferences = state.strategy
): BidRecommendation {
  assertAuctionState(state);
  const player = getRequiredCurrentPlayer(state);
  const market = getRoleMarket(state, player.role);
  const composition = getTeamComposition(state);
  const currentAmount = state.currentBid?.amountLakh ?? player.basePriceLakh;
  const increment = getBidIncrement(currentAmount);
  const nextBidLakh = currentAmount + increment;

  const needMultiplier = roundTo(0.84 + market.scarcityScore * 0.0038);
  const priorityMultiplier = strategy.priorityRoles.includes(player.role)
    ? 1.08
    : 1;
  const riskMultiplier = RISK_MULTIPLIERS[strategy.riskTolerance];
  const reserveFloorLakh = Math.round(
    state.initialPurseLakh * (strategy.reservePercent / 100)
  );
  const spendableAboveReserveLakh = Math.max(
    state.purseRemainingLakh - reserveFloorLakh,
    0
  );
  const openSquadSlots = composition.openSlots;
  const averageSlotBudget =
    openSquadSlots > 0 ? spendableAboveReserveLakh / openSquadSlots : 0;
  const priorityFlex = priorityMultiplier > 1 ? 1.14 : 1;
  const scarcityFlex = 0.82 + (market.scarcityScore / 100) * 1.3;
  const slotBudgetCapLakh = Math.floor(
    averageSlotBudget * scarcityFlex * priorityFlex
  );
  const valueCeiling =
    player.estimatedValueLakh *
    needMultiplier *
    priorityMultiplier *
    riskMultiplier;
  const rawCeilingLakh = Math.max(
    0,
    Math.floor(
      Math.min(
        valueCeiling,
        spendableAboveReserveLakh,
        slotBudgetCapLakh,
        state.purseRemainingLakh
      )
    )
  );
  const maximumBidLakh = maximumAlignedBid(
    rawCeilingLakh,
    currentAmount,
    increment
  );
  const headroomLakh = maximumBidLakh - nextBidLakh;

  let decision: BidRecommendation["decision"];
  if (maximumBidLakh === 0 || nextBidLakh > maximumBidLakh) {
    decision = "PASS";
  } else if (nextBidLakh >= maximumBidLakh * 0.86) {
    decision = "CAUTION";
  } else {
    decision = "BID";
  }

  const reasons = [
    `${market.squadGap} ${player.role} slot${market.squadGap === 1 ? "" : "s"} remain against ${market.remainingSupply} available player${market.remainingSupply === 1 ? "" : "s"}.`,
    `The role scarcity score is ${market.scarcityScore}/100.`,
    `₹${reserveFloorLakh}L remains protected by the ${strategy.reservePercent}% reserve preference.`,
    `The next bid is ₹${nextBidLakh}L and the aligned ceiling is ₹${maximumBidLakh}L.`
  ];

  return {
    playerId: player.id,
    decision,
    maximumBidLakh,
    nextBidLakh,
    headroomLakh,
    factors: {
      playerValueLakh: player.estimatedValueLakh,
      nextBidLakh,
      roleTarget: market.target,
      roleGap: market.squadGap,
      remainingRoleSupply: market.remainingSupply,
      scarcityScore: market.scarcityScore,
      needMultiplier,
      priorityMultiplier,
      riskMultiplier,
      reserveFloorLakh,
      spendableAboveReserveLakh,
      openSquadSlots,
      slotBudgetCapLakh,
      rawCeilingLakh
    },
    reasons
  };
}

function nextEventSequence(state: AuctionState): number {
  return (state.eventLog.at(-1)?.sequence ?? 0) + 1;
}

function nextBidSequence(state: AuctionState): number {
  return (state.bidHistory.at(-1)?.sequence ?? 0) + 1;
}

function moveToNextLot(state: AuctionState): AuctionState {
  const nextIndex = state.currentLotIndex + 1;
  const nextPlayer = state.playerQueue[nextIndex];

  if (!nextPlayer) {
    return {
      ...state,
      status: "complete",
      currentLotIndex: state.playerQueue.length,
      currentBid: null
    };
  }

  return {
    ...state,
    currentLotIndex: nextIndex,
    currentBid: {
      playerId: nextPlayer.id,
      amountLakh: nextPlayer.basePriceLakh,
      bidder: "Opening call"
    }
  };
}

function addResult(state: AuctionState, result: LotResult): AuctionState {
  return {
    ...state,
    results: {
      ...state.results,
      [result.playerId]: result
    }
  };
}

export function commitBid(
  state: AuctionState,
  amountLakh: MoneyLakh
): AuctionState {
  assertAuctionState(state);
  const player = getRequiredCurrentPlayer(state);
  const recommendation = analyzeBid(state);
  const currentAmount = state.currentBid?.amountLakh ?? player.basePriceLakh;
  const increment = getBidIncrement(currentAmount);

  if (!Number.isInteger(amountLakh) || amountLakh < recommendation.nextBidLakh) {
    throw new AuctionRuleError(
      "INVALID_BID",
      `Bid must be at least ₹${recommendation.nextBidLakh}L.`
    );
  }
  if ((amountLakh - currentAmount) % increment !== 0) {
    throw new AuctionRuleError(
      "INVALID_BID",
      `Bid must follow the ₹${increment}L auction increment.`
    );
  }
  if (amountLakh > state.purseRemainingLakh) {
    throw new AuctionRuleError(
      "INSUFFICIENT_PURSE",
      "The bid is greater than the available purse."
    );
  }
  if (state.squad.length >= state.squadLimit) {
    throw new AuctionRuleError("SQUAD_FULL", "The squad is already full.");
  }
  if (
    recommendation.maximumBidLakh === 0 ||
    amountLakh > recommendation.maximumBidLakh
  ) {
    throw new AuctionRuleError(
      "ABOVE_RECOMMENDED_CEILING",
      `Bid exceeds the deterministic ceiling of ₹${recommendation.maximumBidLakh}L.`
    );
  }

  const copied = copyState(state);
  const withPurchase: AuctionState = {
    ...copied,
    purseRemainingLakh: copied.purseRemainingLakh - amountLakh,
    squad: [
      ...copied.squad,
      {
        playerId: player.id,
        name: player.name,
        role: player.role,
        acquisitionPriceLakh: amountLakh,
        source: "auction"
      }
    ],
    currentBid: {
      playerId: player.id,
      amountLakh,
      bidder: copied.teamName
    },
    bidHistory: [
      ...copied.bidHistory,
      {
        sequence: nextBidSequence(copied),
        playerId: player.id,
        amountLakh,
        bidder: copied.teamName
      }
    ],
    eventLog: [
      ...copied.eventLog,
      {
        sequence: nextEventSequence(copied),
        type: "bid-won",
        playerId: player.id,
        description: `${copied.teamName} signed ${player.name} for ₹${amountLakh}L.`
      }
    ]
  };
  const resolved = addResult(withPurchase, {
    playerId: player.id,
    outcome: "won",
    amountLakh,
    winner: copied.teamName
  });

  return moveToNextLot(resolved);
}

export function passCurrentPlayer(state: AuctionState): AuctionState {
  assertAuctionState(state);
  const player = getRequiredCurrentPlayer(state);
  const copied = copyState(state);
  const withEvent: AuctionState = {
    ...copied,
    eventLog: [
      ...copied.eventLog,
      {
        sequence: nextEventSequence(copied),
        type: "player-passed",
        playerId: player.id,
        description: `${copied.teamName} passed on ${player.name}.`
      }
    ]
  };
  const resolved = addResult(withEvent, {
    playerId: player.id,
    outcome: "passed",
    amountLakh: copied.currentBid?.amountLakh ?? null,
    winner: copied.currentBid?.bidder ?? null
  });

  return moveToNextLot(resolved);
}

export function advanceCurrentLot(state: AuctionState): AuctionState {
  assertAuctionState(state);
  const player = getRequiredCurrentPlayer(state);
  const copied = copyState(state);
  const hasExternalBid =
    copied.currentBid !== null && copied.currentBid.bidder !== "Opening call";
  const outcome: LotResult["outcome"] = hasExternalBid
    ? "sold-elsewhere"
    : "unsold";
  const withEvent: AuctionState = {
    ...copied,
    eventLog: [
      ...copied.eventLog,
      {
        sequence: nextEventSequence(copied),
        type: "lot-advanced",
        playerId: player.id,
        description: hasExternalBid
          ? `${player.name} was sold to ${copied.currentBid?.bidder}.`
          : `${player.name} went unsold.`
      }
    ]
  };
  const resolved = addResult(withEvent, {
    playerId: player.id,
    outcome,
    amountLakh: hasExternalBid ? copied.currentBid?.amountLakh ?? null : null,
    winner: hasExternalBid ? copied.currentBid?.bidder ?? null : null
  });

  return moveToNextLot(resolved);
}

export function resetAuction(): AuctionState {
  return createInitialAuctionState();
}

export function withStrategy(
  state: AuctionState,
  strategy: StrategyPreferences
): AuctionState {
  if (
    !Number.isInteger(strategy.reservePercent) ||
    strategy.reservePercent < 0 ||
    strategy.reservePercent > 90
  ) {
    throw new AuctionRuleError(
      "INVALID_STATE",
      "Reserve percentage must be a whole number from 0 to 90."
    );
  }
  if (new Set(strategy.priorityRoles).size !== strategy.priorityRoles.length) {
    throw new AuctionRuleError(
      "INVALID_STATE",
      "Priority roles must not contain duplicates."
    );
  }

  return {
    ...copyState(state),
    strategy: {
      ...strategy,
      priorityRoles: [...strategy.priorityRoles]
    }
  };
}

export function assertAuctionState(state: AuctionState): void {
  if (state.schemaVersion !== 1) {
    throw new AuctionRuleError("INVALID_STATE", "Unsupported state version.");
  }
  if (
    !Number.isInteger(state.purseRemainingLakh) ||
    state.purseRemainingLakh < 0 ||
    state.purseRemainingLakh > state.initialPurseLakh
  ) {
    throw new AuctionRuleError("INVALID_STATE", "Purse value is invalid.");
  }
  if (state.squad.length > state.squadLimit) {
    throw new AuctionRuleError("INVALID_STATE", "Squad exceeds its limit.");
  }
  const acquisitionSpend = state.squad.reduce(
    (total, member) => total + member.acquisitionPriceLakh,
    0
  );
  if (acquisitionSpend + state.purseRemainingLakh !== state.initialPurseLakh) {
    throw new AuctionRuleError(
      "INVALID_STATE",
      "Squad acquisition spend and remaining purse do not reconcile."
    );
  }
  if (new Set(state.squad.map((member) => member.playerId)).size !== state.squad.length) {
    throw new AuctionRuleError(
      "INVALID_STATE",
      "A player appears in the squad more than once."
    );
  }
  if (
    state.currentLotIndex < 0 ||
    state.currentLotIndex > state.playerQueue.length
  ) {
    throw new AuctionRuleError("INVALID_STATE", "Current lot index is invalid.");
  }

  const currentPlayer = state.playerQueue[state.currentLotIndex];
  if (state.status === "active") {
    if (!currentPlayer || !state.currentBid) {
      throw new AuctionRuleError(
        "INVALID_STATE",
        "An active auction requires a current player and bid."
      );
    }
    if (state.currentBid.playerId !== currentPlayer.id) {
      throw new AuctionRuleError(
        "INVALID_STATE",
        "Current bid does not belong to the current player."
      );
    }
  }
  if (
    state.status === "complete" &&
    (state.currentLotIndex !== state.playerQueue.length || state.currentBid !== null)
  ) {
    throw new AuctionRuleError(
      "INVALID_STATE",
      "A completed auction cannot have an active lot."
    );
  }
}
