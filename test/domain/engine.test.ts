import { describe, expect, it } from "vitest";
import {
  AuctionRuleError,
  advanceCurrentLot,
  analyzeBid,
  assertAuctionState,
  commitBid,
  createInitialAuctionState,
  getCurrentPlayer,
  getRemainingPlayersByRole,
  getRoleMarket,
  getTeamComposition,
  passCurrentPlayer,
  resetAuction,
  withStrategy
} from "../../src/domain";

describe("auction seed and calculations", () => {
  it("creates an independent, valid initial state", () => {
    const first = createInitialAuctionState();
    const second = createInitialAuctionState();

    expect(() => assertAuctionState(first)).not.toThrow();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.squad).not.toBe(second.squad);
    expect(getCurrentPlayer(first)?.name).toBe("Aarya Sen");
    expect(
      first.squad.reduce(
        (total, member) => total + member.acquisitionPriceLakh,
        first.purseRemainingLakh
      )
    ).toBe(first.initialPurseLakh);
  });

  it("calculates squad composition and open requirements", () => {
    const composition = getTeamComposition(createInitialAuctionState());

    expect(composition).toEqual({
      totalPlayers: 7,
      openSlots: 8,
      counts: {
        batter: 3,
        wicketkeeper: 1,
        "all-rounder": 1,
        "fast-bowler": 1,
        "spin-bowler": 1
      },
      gaps: {
        batter: 2,
        wicketkeeper: 1,
        "all-rounder": 2,
        "fast-bowler": 2,
        "spin-bowler": 1
      }
    });
  });

  it("groups only unresolved players into the remaining market", () => {
    const initial = createInitialAuctionState();
    const remaining = getRemainingPlayersByRole(initial);

    expect(remaining["fast-bowler"]).toHaveLength(3);
    expect(remaining.batter).toHaveLength(2);

    const afterPass = passCurrentPlayer(initial);
    expect(getRemainingPlayersByRole(afterPass)["fast-bowler"]).toHaveLength(2);
  });

  it("produces a bounded role scarcity score", () => {
    const market = getRoleMarket(createInitialAuctionState(), "fast-bowler");

    expect(market).toEqual({
      role: "fast-bowler",
      squadGap: 2,
      target: 3,
      remainingSupply: 3,
      scarcityScore: 67
    });
  });
});

describe("bid analysis", () => {
  it("returns a deterministic, transparent recommendation", () => {
    const state = createInitialAuctionState();
    const first = analyzeBid(state);
    const second = analyzeBid(state);

    expect(first).toEqual(second);
    expect(first.playerId).toBe("aarya-sen");
    expect(first.decision).toBe("BID");
    expect(first.nextBidLakh).toBe(260);
    expect(first.maximumBidLakh).toBeGreaterThan(first.nextBidLakh);
    expect(first.factors).toMatchObject({
      playerValueLakh: 390,
      roleGap: 2,
      remainingRoleSupply: 3,
      scarcityScore: 67,
      reserveFloorLakh: 1800,
      spendableAboveReserveLakh: 2060,
      openSquadSlots: 8
    });
    expect(first.reasons).toHaveLength(4);
  });

  it("changes the decision when a stricter remembered strategy removes headroom", () => {
    const state = createInitialAuctionState();
    const strict = withStrategy(state, {
      reservePercent: 60,
      riskTolerance: "conservative",
      priorityRoles: []
    });

    expect(analyzeBid(state).decision).toBe("BID");
    expect(analyzeBid(strict).decision).toBe("PASS");
    expect(analyzeBid(strict).maximumBidLakh).toBe(0);
  });

  it("passes after bidding moves above the calculated ceiling", () => {
    const state = createInitialAuctionState();
    const ceiling = analyzeBid(state).maximumBidLakh;
    const expensiveState = {
      ...state,
      currentBid: {
        playerId: "aarya-sen",
        amountLakh: ceiling,
        bidder: "Harbour Hawks"
      }
    };

    expect(analyzeBid(expensiveState).decision).toBe("PASS");
    expect(analyzeBid(expensiveState).nextBidLakh).toBeGreaterThan(ceiling);
  });
});

describe("auction transitions", () => {
  it("commits a valid winning bid without mutating the input", () => {
    const state = createInitialAuctionState();
    const original = structuredClone(state);
    const next = commitBid(state, 260);

    expect(state).toEqual(original);
    expect(next.purseRemainingLakh).toBe(3600);
    expect(next.squad).toHaveLength(8);
    expect(next.squad.at(-1)).toMatchObject({
      playerId: "aarya-sen",
      acquisitionPriceLakh: 260,
      source: "auction"
    });
    expect(next.results["aarya-sen"]).toMatchObject({
      outcome: "won",
      amountLakh: 260,
      winner: "Bengaluru Comets"
    });
    expect(getCurrentPlayer(next)?.id).toBe("vivaan-rao");
    expect(
      next.squad.reduce(
        (total, member) => total + member.acquisitionPriceLakh,
        next.purseRemainingLakh
      )
    ).toBe(next.initialPurseLakh);
    expect(() => assertAuctionState(next)).not.toThrow();
  });

  it("rejects bids below the next amount or outside the auction increment", () => {
    const state = createInitialAuctionState();

    expect(() => commitBid(state, 250)).toThrowError(AuctionRuleError);
    expect(() => commitBid(state, 270)).toThrowError(
      /₹20L auction increment/
    );
  });

  it("rejects bids above the deterministic ceiling", () => {
    const state = createInitialAuctionState();
    const recommendation = analyzeBid(state);

    expect(() =>
      commitBid(state, recommendation.maximumBidLakh + 20)
    ).toThrowError(/deterministic ceiling/);
  });

  it("rejects a bid that exceeds the available purse", () => {
    const state = createInitialAuctionState();
    const constrained = {
      ...state,
      initialPurseLakh: 2390,
      purseRemainingLakh: 250
    };

    expect(() => commitBid(constrained, 260)).toThrowError(
      /available purse/
    );
  });

  it("passes on a player and advances without changing purse or squad", () => {
    const state = createInitialAuctionState();
    const next = passCurrentPlayer(state);

    expect(next.purseRemainingLakh).toBe(state.purseRemainingLakh);
    expect(next.squad).toEqual(state.squad);
    expect(next.results["aarya-sen"]?.outcome).toBe("passed");
    expect(getCurrentPlayer(next)?.id).toBe("vivaan-rao");
  });

  it("advances an externally bid lot as sold elsewhere", () => {
    const state = createInitialAuctionState();
    const next = advanceCurrentLot(state);

    expect(next.results["aarya-sen"]).toEqual({
      playerId: "aarya-sen",
      outcome: "sold-elsewhere",
      amountLakh: 240,
      winner: "Harbour Hawks"
    });
    expect(next.eventLog.at(-1)?.type).toBe("lot-advanced");
  });

  it("marks an opening-call lot as unsold", () => {
    const secondLot = passCurrentPlayer(createInitialAuctionState());
    const thirdLot = advanceCurrentLot(secondLot);

    expect(thirdLot.results["vivaan-rao"]).toMatchObject({
      outcome: "unsold",
      amountLakh: null,
      winner: null
    });
  });

  it("completes cleanly after resolving every lot", () => {
    let state = createInitialAuctionState();
    while (state.status === "active") {
      state = passCurrentPlayer(state);
    }

    expect(state.currentLotIndex).toBe(state.playerQueue.length);
    expect(state.currentBid).toBeNull();
    expect(Object.keys(state.results)).toHaveLength(state.playerQueue.length);
    expect(() => assertAuctionState(state)).not.toThrow();
  });

  it("resets to a fresh copy of the known seed", () => {
    const changed = commitBid(createInitialAuctionState(), 260);
    const reset = resetAuction();

    expect(reset).toEqual(createInitialAuctionState());
    expect(reset).not.toEqual(changed);
  });
});

describe("state invariants", () => {
  it("rejects negative purse and mismatched active bids", () => {
    const state = createInitialAuctionState();

    expect(() =>
      assertAuctionState({ ...state, purseRemainingLakh: -1 })
    ).toThrowError(/Purse value is invalid/);
    expect(() =>
      assertAuctionState({
        ...state,
        currentBid: { ...state.currentBid!, playerId: "wrong-player" }
      })
    ).toThrowError(/does not belong/);
  });

  it("validates strategy ranges and duplicate priorities", () => {
    const state = createInitialAuctionState();

    expect(() =>
      withStrategy(state, {
        reservePercent: 91,
        riskTolerance: "balanced",
        priorityRoles: []
      })
    ).toThrowError(/0 to 90/);
    expect(() =>
      withStrategy(state, {
        reservePercent: 30,
        riskTolerance: "balanced",
        priorityRoles: ["batter", "batter"]
      })
    ).toThrowError(/must not contain duplicates/);
  });
});
