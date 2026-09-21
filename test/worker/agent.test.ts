import { env } from "cloudflare:workers";
import {
  evictDurableObject,
  runInDurableObject
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { BiddrCopilotAgent } from "../../src/server";
import { createAuctionTools } from "../../src/agent/tools";

function getAgentStub(name: string) {
  const id = env.BiddrCopilotAgent.idFromName(name);
  return env.BiddrCopilotAgent.get(id);
}

describe("BiddrCopilotAgent in the Workers runtime", () => {
  it("persists auction and strategy state across Agent reconstruction", async () => {
    const stub = getAgentStub("persistence-test");

    await runInDurableObject<BiddrCopilotAgent, void>(
      stub,
      async (agent) => {
        agent.rememberStrategy({
          reservePercent: 40,
          riskTolerance: "conservative",
          priorityRoles: ["fast-bowler", "wicketkeeper"]
        });
        agent.passPlayer();
      }
    );

    await evictDurableObject(stub);

    await runInDurableObject<BiddrCopilotAgent, void>(stub, async (agent) => {
      const restored = agent.getSnapshot();
      expect(restored.auction.strategy).toEqual({
        reservePercent: 40,
        riskTolerance: "conservative",
        priorityRoles: ["fast-bowler", "wicketkeeper"]
      });
      expect(restored.auction.currentLotIndex).toBe(1);
      expect(restored.auction.results["aarya-sen"]?.outcome).toBe("passed");
    });
  });

  it("keeps a rejected proposal read-only and commits an approved bid once", async () => {
    const stub = getAgentStub("approval-test");

    await runInDurableObject<BiddrCopilotAgent, void>(stub, async (agent) => {
      const tools = createAuctionTools({
        getAgentState: () => agent.getSnapshot(),
        setAgentState: (state) => agent.setState(state)
      });
      const before = structuredClone(agent.getSnapshot());

      expect(tools.commitSimulatedBid.needsApproval).toBe(true);
      expect(agent.getSnapshot()).toEqual(before);

      const execute = tools.commitSimulatedBid.execute;
      if (!execute) throw new Error("Commit tool must be executable.");

      const approved = await execute(
        { amountLakh: 260 },
        { toolCallId: "worker-approved-bid", messages: [] }
      );
      const afterApproval = structuredClone(agent.getSnapshot());
      const replay = await execute(
        { amountLakh: 260 },
        { toolCallId: "worker-approved-bid", messages: [] }
      );

      expect(approved).toMatchObject({
        duplicate: false,
        playerId: "aarya-sen"
      });
      expect(afterApproval.auction.purseRemainingLakh).toBe(3600);
      expect(afterApproval.auction.squad.at(-1)).toMatchObject({
        playerId: "aarya-sen",
        acquisitionPriceLakh: 260
      });
      expect(replay).toMatchObject({ duplicate: true });
      expect(agent.getSnapshot()).toEqual(afterApproval);
    });
  });

  it("keeps read and validation failures from mutating Agent state", async () => {
    const stub = getAgentStub("safe-tools-test");

    await runInDurableObject<BiddrCopilotAgent, void>(stub, async (agent) => {
      const tools = createAuctionTools({
        getAgentState: () => agent.getSnapshot(),
        setAgentState: (state) => agent.setState(state)
      });
      const before = structuredClone(agent.getSnapshot());
      const analyze = tools.analyzeBid.execute;
      const commit = tools.commitSimulatedBid.execute;
      if (!analyze || !commit) throw new Error("Tools must be executable.");

      await analyze({}, { toolCallId: "read-only", messages: [] });
      expect(agent.getSnapshot()).toEqual(before);
      expect(() =>
        commit(
          { amountLakh: 261 },
          { toolCallId: "invalid-worker-bid", messages: [] }
        )
      ).toThrow("auction increment");
      expect(agent.getSnapshot()).toEqual(before);
    });
  });
});
