import type {
  AuctionState,
  Player,
  PlayerRole,
  SquadMember,
  StrategyPreferences
} from "./types";

export const ROLE_TARGETS: Readonly<Record<PlayerRole, number>> = {
  batter: 5,
  wicketkeeper: 2,
  "all-rounder": 3,
  "fast-bowler": 3,
  "spin-bowler": 2
};

export const DEFAULT_STRATEGY: Readonly<StrategyPreferences> = {
  reservePercent: 30,
  riskTolerance: "balanced",
  priorityRoles: ["fast-bowler", "all-rounder"]
};

export const AUCTION_PLAYERS: ReadonlyArray<Player> = [
  {
    id: "aarya-sen",
    name: "Aarya Sen",
    role: "fast-bowler",
    style: "Right-arm pace · New-ball specialist",
    basePriceLakh: 120,
    estimatedValueLakh: 390,
    rating: 88
  },
  {
    id: "vivaan-rao",
    name: "Vivaan Rao",
    role: "batter",
    style: "Left-hand opener · Powerplay aggressor",
    basePriceLakh: 100,
    estimatedValueLakh: 330,
    rating: 84
  },
  {
    id: "meher-kaul",
    name: "Meher Kaul",
    role: "all-rounder",
    style: "Middle-order batter · Right-arm seam",
    basePriceLakh: 140,
    estimatedValueLakh: 420,
    rating: 89
  },
  {
    id: "ishaan-bedi",
    name: "Ishaan Bedi",
    role: "wicketkeeper",
    style: "Wicketkeeper · Finisher",
    basePriceLakh: 80,
    estimatedValueLakh: 245,
    rating: 80
  },
  {
    id: "zoya-mir",
    name: "Zoya Mir",
    role: "spin-bowler",
    style: "Left-arm wrist spin · Middle-overs attack",
    basePriceLakh: 90,
    estimatedValueLakh: 285,
    rating: 83
  },
  {
    id: "kabir-das",
    name: "Kabir Das",
    role: "fast-bowler",
    style: "Right-arm express pace · Death overs",
    basePriceLakh: 150,
    estimatedValueLakh: 460,
    rating: 91
  },
  {
    id: "tara-menon",
    name: "Tara Menon",
    role: "batter",
    style: "Right-hand anchor · Spin specialist",
    basePriceLakh: 70,
    estimatedValueLakh: 230,
    rating: 79
  },
  {
    id: "arjun-nanda",
    name: "Arjun Nanda",
    role: "all-rounder",
    style: "Top-order batter · Off spin",
    basePriceLakh: 110,
    estimatedValueLakh: 315,
    rating: 82
  },
  {
    id: "niharika-bose",
    name: "Niharika Bose",
    role: "wicketkeeper",
    style: "Wicketkeeper · Top-order accelerator",
    basePriceLakh: 100,
    estimatedValueLakh: 305,
    rating: 85
  },
  {
    id: "reyaan-puri",
    name: "Reyaan Puri",
    role: "spin-bowler",
    style: "Leg spin · Lower-order hitter",
    basePriceLakh: 80,
    estimatedValueLakh: 255,
    rating: 81
  },
  {
    id: "diya-suri",
    name: "Diya Suri",
    role: "fast-bowler",
    style: "Left-arm pace · Swing specialist",
    basePriceLakh: 130,
    estimatedValueLakh: 375,
    rating: 87
  },
  {
    id: "advait-jain",
    name: "Advait Jain",
    role: "all-rounder",
    style: "Finisher · Left-arm orthodox",
    basePriceLakh: 90,
    estimatedValueLakh: 280,
    rating: 80
  }
];

const RETAINED_SQUAD: ReadonlyArray<SquadMember> = [
  {
    playerId: "retained-vihaan",
    name: "Vihaan Malik",
    role: "batter",
    acquisitionPriceLakh: 360,
    source: "retained"
  },
  {
    playerId: "retained-anika",
    name: "Anika Roy",
    role: "batter",
    acquisitionPriceLakh: 310,
    source: "retained"
  },
  {
    playerId: "retained-omar",
    name: "Omar Sheikh",
    role: "batter",
    acquisitionPriceLakh: 250,
    source: "retained"
  },
  {
    playerId: "retained-mira",
    name: "Mira Iyer",
    role: "wicketkeeper",
    acquisitionPriceLakh: 260,
    source: "retained"
  },
  {
    playerId: "retained-dev",
    name: "Dev Khanna",
    role: "all-rounder",
    acquisitionPriceLakh: 360,
    source: "retained"
  },
  {
    playerId: "retained-samar",
    name: "Samar Gill",
    role: "fast-bowler",
    acquisitionPriceLakh: 330,
    source: "retained"
  },
  {
    playerId: "retained-rhea",
    name: "Rhea Pillai",
    role: "spin-bowler",
    acquisitionPriceLakh: 270,
    source: "retained"
  }
];

function copyStrategy(
  strategy: Readonly<StrategyPreferences>
): StrategyPreferences {
  return {
    ...strategy,
    priorityRoles: [...strategy.priorityRoles]
  };
}

export function createInitialAuctionState(): AuctionState {
  const players = AUCTION_PLAYERS.map((player) => ({ ...player }));
  const firstPlayer = players[0];

  if (!firstPlayer) {
    throw new Error("Auction seed requires at least one player");
  }

  return {
    schemaVersion: 1,
    auctionId: "biddr-demo-v1",
    teamName: "Bengaluru Comets",
    status: "active",
    initialPurseLakh: 6000,
    purseRemainingLakh: 3860,
    squadLimit: 15,
    squad: RETAINED_SQUAD.map((member) => ({ ...member })),
    playerQueue: players,
    currentLotIndex: 0,
    currentBid: {
      playerId: firstPlayer.id,
      amountLakh: 240,
      bidder: "Harbour Hawks"
    },
    results: {},
    bidHistory: [
      {
        sequence: 1,
        playerId: firstPlayer.id,
        amountLakh: 240,
        bidder: "Harbour Hawks"
      }
    ],
    eventLog: [
      {
        sequence: 1,
        type: "auction-started",
        playerId: firstPlayer.id,
        description: "Auction opened with Aarya Sen at the current bid."
      }
    ],
    strategy: copyStrategy(DEFAULT_STRATEGY)
  };
}
