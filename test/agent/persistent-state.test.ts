import { describe, expect, it } from "vitest";
import {
  parseBiddrAgentState,
  strategyPreferencesSchema
} from "../../src/agent/schemas";
import {
  advanceAgentCurrentLot,
  createInitialAgentState,
  passAgentCurrentPlayer,
  rememberAgentStrategy,
  resetAgentState
} from "../../src/agent/state";

describe("persistent Agent state transitions", () => {
  it("remembers validated strategy through a serialization round trip", () => {
    const initial = createInitialAgentState();
    const strategy = strategyPreferencesSchema.parse({
      reservePercent: 45,
      riskTolerance: "conservative",
      priorityRoles: ["wicketkeeper", "spin-bowler"]
    });
    const updated = rememberAgentStrategy(initial, strategy);
    const restored = JSON.parse(JSON.stringify(updated)) as typeof updated;

    expect(restored.auction.strategy).toEqual(strategy);
    expect(initial.auction.strategy.reservePercent).toBe(30);
    expect(updated.auction).not.toBe(initial.auction);
  });

  it("persists pass and advance transitions without changing the purse", () => {
    const initial = createInitialAgentState();
    const afterPass = passAgentCurrentPlayer(initial);
    const afterAdvance = advanceAgentCurrentLot(afterPass);

    expect(afterPass.auction.results["aarya-sen"]?.outcome).toBe("passed");
    expect(afterAdvance.auction.results["vivaan-rao"]?.outcome).toBe("unsold");
    expect(afterAdvance.auction.currentLotIndex).toBe(2);
    expect(afterAdvance.auction.purseRemainingLakh).toBe(
      initial.auction.purseRemainingLakh
    );
  });

  it("resets auction state and strategy to a fresh known snapshot", () => {
    const changed = rememberAgentStrategy(createInitialAgentState(), {
      reservePercent: 50,
      riskTolerance: "aggressive",
      priorityRoles: ["batter"]
    });
    const reset = resetAgentState();

    expect(reset).toEqual(createInitialAgentState());
    expect(reset).not.toEqual(changed);
  });

  it("rejects malformed or duplicate strategy preferences", () => {
    expect(() =>
      strategyPreferencesSchema.parse({
        reservePercent: 91,
        riskTolerance: "balanced",
        priorityRoles: []
      })
    ).toThrow();
    expect(() =>
      strategyPreferencesSchema.parse({
        reservePercent: 30,
        riskTolerance: "balanced",
        priorityRoles: ["batter", "batter"]
      })
    ).toThrow(/must not contain duplicates/);
    expect(() =>
      strategyPreferencesSchema.parse({
        reservePercent: 30,
        riskTolerance: "balanced",
        priorityRoles: [],
        injected: true
      })
    ).toThrow();
  });

  it("validates persisted Agent state before it can be used", () => {
    const valid = createInitialAgentState();
    expect(parseBiddrAgentState(valid)).toEqual(valid);

    const malformed = structuredClone(valid) as Record<string, unknown>;
    malformed.injected = true;
    expect(() => parseBiddrAgentState(malformed)).toThrow();

    const invalidPurse = structuredClone(valid);
    invalidPurse.auction.purseRemainingLakh = -1;
    expect(() => parseBiddrAgentState(invalidPurse)).toThrow();

    const duplicateAction = structuredClone(valid);
    duplicateAction.processedActionIds = ["action-1", "action-1"];
    expect(() => parseBiddrAgentState(duplicateAction)).toThrow(
      "must not contain duplicates"
    );

    const orphanedResult = structuredClone(valid);
    orphanedResult.processedBidResults = {
      "not-retained": {
        actionId: "not-retained",
        playerId: "aarya-sen",
        playerName: "Aarya Sen",
        amountLakh: 260,
        purseRemainingLakh: 3600,
        squadSize: 8
      }
    };
    expect(() => parseBiddrAgentState(orphanedResult)).toThrow(
      "Stored bid results"
    );
  });
});
