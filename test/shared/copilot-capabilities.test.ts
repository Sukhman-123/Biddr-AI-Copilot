import { describe, expect, it } from "vitest";
import { classifyCopilotQuestion } from "../../src/agent/knowledge-base";
import {
  AUCTION_CONTEXT_SECTIONS,
  COPILOT_CAPABILITIES,
  COPILOT_KNOWLEDGE_INTENTS,
  getCopilotStarterCapabilities,
  getRequiredContextSections
} from "../../src/shared/copilot-capabilities";

describe("Copilot capability registry", () => {
  it("contains each knowledge intent exactly once", () => {
    const ids = COPILOT_CAPABILITIES.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(COPILOT_KNOWLEDGE_INTENTS);
    expect(ids).toContain("unsupported");
  });

  it("keeps examples, matchers, and context requirements together", () => {
    for (const capability of COPILOT_CAPABILITIES) {
      for (const section of capability.contextSections) {
        expect(AUCTION_CONTEXT_SECTIONS).toContain(section);
      }

      if (capability.id === "unsupported") continue;
      expect(capability.examples.length).toBeGreaterThan(0);
      expect(capability.patterns.length).toBeGreaterThan(0);
      expect(classifyCopilotQuestion(capability.examples[0] ?? "")).toContain(
        capability.id
      );
    }
  });

  it("derives all four starter prompts from classified examples", () => {
    const starters = getCopilotStarterCapabilities();

    expect(starters.map(({ id }) => id)).toEqual([
      "player-analysis",
      "safe-bid",
      "squad-priority",
      "strategy-summary"
    ]);
    for (const starter of starters) {
      expect(classifyCopilotQuestion(starter.examples[0] ?? "")).toContain(
        starter.id
      );
    }
  });

  it("unions and deduplicates context sections for compound intents", () => {
    const sections = getRequiredContextSections([
      "purse-reserve",
      "remaining-players"
    ]);

    expect(sections).toEqual(
      new Set([
        "financial-summary",
        "squad-summary",
        "active-bid",
        "recommendation",
        "strategy",
        "team-composition",
        "role-markets",
        "remaining-players"
      ])
    );
  });
});
