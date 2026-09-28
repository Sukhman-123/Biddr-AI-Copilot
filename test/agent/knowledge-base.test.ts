import { describe, expect, it } from "vitest";
import {
  buildCopilotKnowledgeContext,
  classifyCopilotQuestion,
  getLatestUserQuestion
} from "../../src/agent/knowledge-base";

describe("Copilot knowledge retrieval", () => {
  it.each([
    ["Analyze this player", "player-analysis"],
    ["What is the current lot and latest bid?", "auction-status"],
    ["Who is the current player?", "current-player"],
    ["What is our team composition?", "team-composition"],
    ["What's our maximum safe bid?", "safe-bid"],
    ["Which squad role should we target next?", "squad-priority"],
    ["How much can we spend while protecting our reserve?", "purse-reserve"],
    ["Who are the remaining fast bowlers?", "remaining-players"],
    ["Compare this player with the remaining options", "comparison"],
    ["Summarize our auction strategy", "strategy-summary"],
    ["Prepare a simulated bid of 260 lakh", "simulated-bid"],
    ["What can I ask you?", "capabilities"]
  ] as const)("routes %s to %s guidance", (question, expectedIntent) => {
    expect(classifyCopilotQuestion(question)).toContain(expectedIntent);
  });

  it("falls back to auction-scoped redirection for unrelated questions", () => {
    expect(classifyCopilotQuestion("What is the weather tomorrow?")).toEqual([
      "unsupported"
    ]);
  });

  it("always includes core guidance and only selected specialist sections", () => {
    const context = buildCopilotKnowledgeContext(
      "What's our maximum safe bid?"
    );

    expect(context).toContain("[TRUSTED_COPILOT_KNOWLEDGE]");
    expect(context).toContain("## core");
    expect(context).toContain("## safe-bid");
    expect(context).not.toContain("## remaining-players");
    expect(context).not.toContain("## unsupported");
  });

  it("retrieves multiple relevant sections for compound questions", () => {
    const context = buildCopilotKnowledgeContext(
      "Analyze this player and tell me our maximum safe bid and remaining purse"
    );

    expect(context).toContain("## player-analysis");
    expect(context).toContain("## safe-bid");
    expect(context).toContain("## purse-reserve");
  });

  it("extracts only the most recent user question", () => {
    expect(
      getLatestUserQuestion([
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Analyze this player" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Earlier answer" }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "How much purse remains?" }]
        }
      ])
    ).toBe("How much purse remains?");
  });
});
