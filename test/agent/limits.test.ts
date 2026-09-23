import { describe, expect, it } from "vitest";
import {
  MAX_MODEL_CONTEXT_MESSAGES,
  MAX_MODEL_CONTEXT_CHARACTERS,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  MAX_USER_MESSAGE_CHARACTERS,
  hasSuccessfulToolResult,
  selectBoundedChatContext,
  selectRecentChatMessages,
  selectUnusedToolNames
} from "../../src/agent/limits";

describe("model execution limits", () => {
  it("keeps tool and output budgets finite", () => {
    expect(MAX_TOOL_STEPS).toBe(6);
    expect(MAX_OUTPUT_TOKENS).toBe(768);
    expect(MAX_MODEL_CONTEXT_MESSAGES).toBe(24);
    expect(MAX_MODEL_CONTEXT_CHARACTERS).toBe(12_000);
    expect(MAX_USER_MESSAGE_CHARACTERS).toBe(1_200);
  });

  it("prevents a tool from running twice in one model response", () => {
    const available = selectUnusedToolNames(
      ["getAuctionState", "analyzeBid", "getStrategy"],
      [
        {
          toolCalls: [{ toolName: "getAuctionState" }],
          toolResults: [{ toolName: "getAuctionState" }]
        },
        {
          toolCalls: [{ toolName: "analyzeBid" }],
          toolResults: [{ toolName: "analyzeBid" }]
        }
      ]
    );

    expect(available).toEqual(["getStrategy"]);
  });

  it("allows one retry after a failed tool call and then stops", () => {
    const toolNames = ["analyzeBid"] as const;
    const failedAttempt = {
      toolCalls: [{ toolName: "analyzeBid" }],
      toolResults: []
    };

    expect(selectUnusedToolNames(toolNames, [failedAttempt])).toEqual([
      "analyzeBid"
    ]);
    expect(
      selectUnusedToolNames(toolNames, [failedAttempt, failedAttempt])
    ).toEqual([]);
  });

  it("stops after a successful deterministic bid analysis", () => {
    const shouldStop = hasSuccessfulToolResult("analyzeBid");

    expect(
      shouldStop({
        steps: [
          {
            toolCalls: [{ toolName: "analyzeBid" }],
            toolResults: [{ toolName: "analyzeBid" }]
          }
        ]
      })
    ).toBe(true);
    expect(
      shouldStop({
        steps: [
          {
            toolCalls: [{ toolName: "analyzeBid" }],
            toolResults: []
          }
        ]
      })
    ).toBe(false);
  });

  it("keeps only the recent bounded conversation window", () => {
    const messages = Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      role: index % 2 === 0 ? "user" : "assistant"
    }));
    const selected = selectRecentChatMessages(messages);

    expect(selected.length).toBeLessThanOrEqual(MAX_MODEL_CONTEXT_MESSAGES);
    expect(selected[0]?.role).toBe("user");
    expect(selected.at(-1)?.id).toBe("29");
    expect(messages).toHaveLength(30);
  });

  it("drops a leading assistant message from a sliced context window", () => {
    const selected = selectRecentChatMessages(
      [
        { id: "1", role: "user" },
        { id: "2", role: "assistant" },
        { id: "3", role: "user" },
        { id: "4", role: "assistant" }
      ],
      3
    );

    expect(selected.map((message) => message.id)).toEqual(["3", "4"]);
  });

  it("rejects invalid context-window limits", () => {
    expect(() => selectRecentChatMessages([], 0)).toThrow(RangeError);
    expect(() => selectRecentChatMessages([], 1.5)).toThrow(RangeError);
  });

  it("caps model context by character budget as well as message count", () => {
    const selected = selectBoundedChatContext(
      [
        { id: "1", role: "user", text: "a".repeat(40) },
        { id: "2", role: "assistant", text: "b".repeat(40) },
        { id: "3", role: "user", text: "c".repeat(40) }
      ],
      3,
      80
    );

    expect(selected.map((message) => message.id)).toEqual(["3"]);
    expect(() => selectBoundedChatContext([], 3, 0)).toThrow(RangeError);
  });
});
