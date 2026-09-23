import { describe, expect, it } from "vitest";
import {
  BIDDR_TOOL_CONTINUATION_PROMPT,
  prepareBiddrModelStep
} from "../../src/agent/model-loop";
import { BIDDR_MODEL_TOOL_NAMES } from "../../src/agent/tools";

describe("model tool-loop orchestration", () => {
  it("makes the complete approved tool surface available on the first step", () => {
    const prepared = prepareBiddrModelStep([]);

    expect(prepared.activeTools).toEqual(BIDDR_MODEL_TOOL_NAMES);
    expect(prepared).not.toHaveProperty("system");
    expect(prepared).not.toHaveProperty("toolChoice");
  });

  it("removes successful tools and tells the model to use their results", () => {
    const prepared = prepareBiddrModelStep([
      {
        toolCalls: [{ toolName: "getStrategy" }],
        toolResults: [{ toolName: "getStrategy" }]
      }
    ]);

    expect(prepared.activeTools).not.toContain("getStrategy");
    expect(prepared.system).toBe(BIDDR_TOOL_CONTINUATION_PROMPT);
    expect(prepared.system).toContain("Do not request a tool that is no longer available");
  });

  it("keeps a failed tool available for one retry", () => {
    const prepared = prepareBiddrModelStep([
      {
        toolCalls: [{ toolName: "analyzeBid" }],
        toolResults: []
      }
    ]);

    expect(prepared.activeTools).toContain("analyzeBid");
  });

  it("forces a text response after every tool has already succeeded", () => {
    const completedTools = BIDDR_MODEL_TOOL_NAMES.map((toolName) => ({
      toolName
    }));
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
