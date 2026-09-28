import { describe, expect, it } from "vitest";
import {
  BIDDR_CHAT_TOOL_NAMES,
  BIDDR_TOOL_CONTINUATION_PROMPT,
  prepareBiddrModelStep
} from "../../src/agent/model-loop";

describe("model tool-loop orchestration", () => {
  it("only makes the approval-gated write tool available to chat", () => {
    const prepared = prepareBiddrModelStep([]);

    expect(prepared.activeTools).toEqual(BIDDR_CHAT_TOOL_NAMES);
    expect(prepared).not.toHaveProperty("system");
    expect(prepared).not.toHaveProperty("toolChoice");
  });

  it("removes a successful action and preserves trusted context", () => {
    const trustedPrompt = "system\n[TRUSTED_DETERMINISTIC_AUCTION_CONTEXT]";
    const prepared = prepareBiddrModelStep([
      {
        toolCalls: [{ toolName: "commitSimulatedBid" }],
        toolResults: [{ toolName: "commitSimulatedBid" }]
      }
    ], trustedPrompt);

    expect(prepared.activeTools).toEqual([]);
    expect(prepared.system).toContain(trustedPrompt);
    expect(prepared.system).toContain(BIDDR_TOOL_CONTINUATION_PROMPT);
    expect(prepared.system).toContain("Do not request a tool that is no longer available");
  });

  it("keeps a failed action available for one retry", () => {
    const prepared = prepareBiddrModelStep([
      {
        toolCalls: [{ toolName: "commitSimulatedBid" }],
        toolResults: []
      }
    ]);

    expect(prepared.activeTools).toContain("commitSimulatedBid");
  });

  it("forces a text response after the action has succeeded", () => {
    const completedTools = [{ toolName: "commitSimulatedBid" }];
    const prepared = prepareBiddrModelStep([
      {
        toolCalls: completedTools,
        toolResults: completedTools
      }
    ]);

    expect(prepared.activeTools).toEqual([]);
    expect(prepared.toolChoice).toBe("none");
  });
});
