import { describe, expect, it } from "vitest";
import {
  buildCopilotKnowledgeContext,
  classifyCopilotQuestion,
  findMentionedRole,
  getLatestUserQuestion,
  resolveCopilotConversation
} from "../../src/agent/knowledge-base";
import { createInitialAuctionState } from "../../src/domain";

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

  it("inherits the previous intent for a short explanatory follow-up", () => {
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Analyze this player" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "BID on Aarya Sen." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "Why?" }]
        }
      ],
      createInitialAuctionState()
    );

    expect(resolution.intents).toEqual(["player-analysis"]);
    expect(resolution.inheritedIntents).toEqual(["player-analysis"]);
    expect(resolution.referencedPlayer?.name).toBe("Aarya Sen");
    expect(resolution.referencedPlayerIsCurrent).toBe(true);
  });

  it("resolves a named future player without treating them as current", () => {
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Analyze this player" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "Aarya Sen is the current player." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "What about Kabir?" }]
        }
      ],
      createInitialAuctionState()
    );

    expect(resolution.intents).toEqual(["player-analysis"]);
    expect(resolution.referencedPlayer?.name).toBe("Kabir Das");
    expect(resolution.referencedPlayerIsCurrent).toBe(false);
    expect(resolution.referencedRole).toBe("fast-bowler");
  });

  it("resolves unique short names from the retained squad", () => {
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "What is our team composition?" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "The squad has seven players." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "What about Dev?" }]
        }
      ],
      createInitialAuctionState()
    );

    expect(resolution.referencedPlayer).toMatchObject({
      name: "Dev Khanna",
      source: "squad",
      acquisitionPriceLakh: 360
    });
    expect(resolution.referencedPlayerIsCurrent).toBe(false);
  });

  it("combines a direct follow-up intent with inherited guidance", () => {
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "What's our maximum safe bid?" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "The ceiling is for Aarya Sen." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "Can we afford that?" }]
        }
      ],
      createInitialAuctionState()
    );

    expect(resolution.intents).toEqual(["purse-reserve", "safe-bid"]);
    expect(resolution.inheritedIntents).toEqual(["safe-bid"]);
    expect(resolution.referencedPlayer?.name).toBe("Aarya Sen");
  });

  it("does not inherit context for an unrelated short question", () => {
    const resolution = resolveCopilotConversation(
      [
        {
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Analyze this player" }]
        },
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "BID on Aarya Sen." }]
        },
        {
          id: "user-2",
          role: "user",
          parts: [{ type: "text", text: "Weather tomorrow?" }]
        }
      ],
      createInitialAuctionState()
    );

    expect(resolution.intents).toEqual(["unsupported"]);
    expect(resolution.isFollowUp).toBe(false);
  });

  it.each([
    ["pacers", "fast-bowler"],
    ["keepers", "wicketkeeper"],
    ["all rounders", "all-rounder"],
    ["spinners", "spin-bowler"],
    ["batsmen", "batter"]
  ] as const)("normalizes the %s role alias", (alias, role) => {
    expect(findMentionedRole(alias)).toBe(role);
  });

  it("adds resolved references to the trusted knowledge context", () => {
    const state = createInitialAuctionState();
    const messages = [
      {
        id: "user-1",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "Analyze this player" }]
      },
      {
        id: "user-2",
        role: "user" as const,
        parts: [{ type: "text" as const, text: "What about Kabir?" }]
      }
    ];
    const resolution = resolveCopilotConversation(messages, state);
    const context = buildCopilotKnowledgeContext(
      resolution.question,
      resolution
    );

    expect(context).toContain("Conversation follow-up resolution");
    expect(context).toContain("Referenced player: Kabir Das");
    expect(context).toContain("Referenced player is current: false");
    expect(context).toContain("never apply the current player's");
  });
});
