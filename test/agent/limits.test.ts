import { describe, expect, it } from "vitest";
import {
  MAX_MODEL_CONTEXT_MESSAGES,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  selectRecentChatMessages
} from "../../src/agent/limits";

describe("model execution limits", () => {
  it("keeps tool and output budgets finite", () => {
    expect(MAX_TOOL_STEPS).toBe(6);
    expect(MAX_OUTPUT_TOKENS).toBe(768);
    expect(MAX_MODEL_CONTEXT_MESSAGES).toBe(24);
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
});

