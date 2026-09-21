export const PLAYER_ROLES = [
  "batter",
  "wicketkeeper",
  "all-rounder",
  "fast-bowler",
  "spin-bowler"
] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export type RiskTolerance = "conservative" | "balanced" | "aggressive";

export type RecommendationDecision = "BID" | "CAUTION" | "PASS";

/** Money is represented as whole lakhs to avoid floating-point currency bugs. */
export type MoneyLakh = number;

export type Player = {
  id: string;
  name: string;
  role: PlayerRole;
  style: string;
  basePriceLakh: MoneyLakh;
  estimatedValueLakh: MoneyLakh;
  rating: number;
};

export type SquadMember = {
  playerId: string;
  name: string;
  role: PlayerRole;
  acquisitionPriceLakh: MoneyLakh;
  source: "retained" | "auction";
};

export type StrategyPreferences = {
  reservePercent: number;
  riskTolerance: RiskTolerance;
  priorityRoles: PlayerRole[];
};

export type CurrentBid = {
  playerId: string;
  amountLakh: MoneyLakh;
  bidder: string;
};

export type BidRecord = {
  sequence: number;
  playerId: string;
  amountLakh: MoneyLakh;
  bidder: string;
};

export type LotResult = {
  playerId: string;
  outcome: "won" | "passed" | "sold-elsewhere" | "unsold";
  amountLakh: MoneyLakh | null;
  winner: string | null;
};

export type AuctionEvent = {
  sequence: number;
  type: "auction-started" | "bid-won" | "player-passed" | "lot-advanced";
  playerId: string;
  description: string;
};

export type AuctionStatus = "active" | "complete";

export type AuctionState = {
  schemaVersion: 1;
  auctionId: string;
  teamName: string;
  status: AuctionStatus;
  initialPurseLakh: MoneyLakh;
  purseRemainingLakh: MoneyLakh;
  squadLimit: number;
  squad: SquadMember[];
  playerQueue: Player[];
  currentLotIndex: number;
  currentBid: CurrentBid | null;
  results: Record<string, LotResult>;
  bidHistory: BidRecord[];
  eventLog: AuctionEvent[];
  strategy: StrategyPreferences;
};

export type TeamComposition = {
  totalPlayers: number;
  openSlots: number;
  counts: Record<PlayerRole, number>;
  gaps: Record<PlayerRole, number>;
};

export type RoleMarket = {
  role: PlayerRole;
  squadGap: number;
  target: number;
  remainingSupply: number;
  scarcityScore: number;
};

export type ValuationFactors = {
  playerValueLakh: MoneyLakh;
  nextBidLakh: MoneyLakh;
  roleTarget: number;
  roleGap: number;
  remainingRoleSupply: number;
  scarcityScore: number;
  needMultiplier: number;
  priorityMultiplier: number;
  riskMultiplier: number;
  reserveFloorLakh: MoneyLakh;
  spendableAboveReserveLakh: MoneyLakh;
  openSquadSlots: number;
  slotBudgetCapLakh: MoneyLakh;
  rawCeilingLakh: MoneyLakh;
};

export type BidRecommendation = {
  playerId: string;
  decision: RecommendationDecision;
  maximumBidLakh: MoneyLakh;
  nextBidLakh: MoneyLakh;
  headroomLakh: MoneyLakh;
  factors: ValuationFactors;
  reasons: string[];
};

