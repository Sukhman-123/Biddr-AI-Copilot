import type { UIMessage } from "ai";
import knowledgeSource from "../../knowledge/copilot-guide.md?raw";

export const COPILOT_KNOWLEDGE_INTENTS = [
  "capabilities",
  "auction-status",
  "current-player",
  "team-composition",
  "player-analysis",
  "safe-bid",
  "squad-priority",
  "purse-reserve",
  "remaining-players",
  "comparison",
  "strategy-summary",
  "simulated-bid",
  "unsupported"
] as const;

export type CopilotKnowledgeIntent =
  (typeof COPILOT_KNOWLEDGE_INTENTS)[number];

type KnowledgeSectionId = "core" | CopilotKnowledgeIntent;

const INTENT_PATTERNS: ReadonlyArray<{
  intent: Exclude<CopilotKnowledgeIntent, "unsupported">;
  patterns: readonly RegExp[];
}> = [
  {
    intent: "simulated-bid",
    patterns: [
      /\b(?:prepare|place|make|submit|commit|confirm|accept)\b.*\bbid\b/i,
      /\bbid\b.*\b(?:₹|rs\.?|inr|lakh|lakhs|crore|crores|cr)\b/i
    ]
  },
  {
    intent: "safe-bid",
    patterns: [
      /\b(?:maximum|max|safe|ceiling|limit|headroom|next)\b.*\bbid\b/i,
      /\b(?:bid|spend|go)\b.*\b(?:maximum|max|safe|ceiling|limit|higher|high)\b/i,
      /\bhow (?:high|far)\b/i,
      /\bhow much can we bid\b/i
    ]
  },
  {
    intent: "auction-status",
    patterns: [
      /\b(?:auction status|auction progress|current lot|which lot|lot number)\b/i,
      /\b(?:current|latest) bid(?:der)?\b/i,
      /\bis the auction (?:active|complete|finished|over)\b/i
    ]
  },
  {
    intent: "current-player",
    patterns: [
      /\b(?:who|which) is the current player\b/i,
      /\bcurrent player(?:'s)?\b.*\b(?:name|role|style|rating|base price|estimated value|details?)\b/i,
      /\b(?:name|role|style|rating|base price|estimated value)\b.*\bcurrent player\b/i
    ]
  },
  {
    intent: "team-composition",
    patterns: [
      /\b(?:team|squad) composition\b/i,
      /\b(?:who|which players?) (?:is|are) in (?:our|the) (?:team|squad)\b/i,
      /\b(?:squad size|open slots?|players? (?:do we have|in our squad))\b/i
    ]
  },
  {
    intent: "player-analysis",
    patterns: [
      /\b(?:analy[sz]e|assess|evaluate|recommend)\b.*\b(?:player|him|her|lot)\b/i,
      /\b(?:should|do) we bid\b/i,
      /\b(?:worth|value|valuation)\b/i,
      /\b(?:bid|caution|pass)\b.*\bdecision\b/i
    ]
  },
  {
    intent: "squad-priority",
    patterns: [
      /\b(?:role|position|squad gap|need|priority|prioritise|prioritize|target)\b/i,
      /\bwhat should we (?:target|buy|fill) next\b/i
    ]
  },
  {
    intent: "purse-reserve",
    patterns: [
      /\b(?:purse|budget|reserve|afford|cash|funds?|spendable|spending)\b/i,
      /\bhow much (?:is left|do we have|can we spend)\b/i
    ]
  },
  {
    intent: "remaining-players",
    patterns: [
      /\b(?:remaining|available|upcoming|left|next)\b.*\bplayers?\b/i,
      /\b(?:remaining|available|upcoming|left|next)\b.*\b(?:batters?|wicketkeepers?|all[- ]rounders?|fast bowlers?|pacers?|spin bowlers?|spinners?)\b/i,
      /\bwho (?:is|are)(?: still)? (?:available|left|up next)\b/i,
      /\b(?:batters?|wicketkeepers?|all[- ]rounders?|fast bowlers?|pacers?|spin bowlers?|spinners?)\b.*\b(?:remaining|available|left)\b/i
    ]
  },
  {
    intent: "comparison",
    patterns: [
      /\b(?:compare|comparison|versus|vs\.?|alternative|better option)\b/i,
      /\bbetter than\b/i
    ]
  },
  {
    intent: "strategy-summary",
    patterns: [
      /\b(?:strategy|plan|approach|risk tolerance|preference|priorities)\b/i,
      /\bsummari[sz]e\b.*\bauction\b/i
    ]
  },
  {
    intent: "capabilities",
    patterns: [
      /\bwhat can (?:you|i) (?:do|ask)\b/i,
      /\b(?:help|capabilities|supported questions|examples?)\b/i
    ]
  }
];

function parseKnowledgeSections(source: string): ReadonlyMap<KnowledgeSectionId, string> {
  const sections = new Map<KnowledgeSectionId, string>();
  const matches = [...source.matchAll(/^## ([a-z-]+)\s*$/gm)];

  matches.forEach((match, index) => {
    const id = match[1] as KnowledgeSectionId;
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    const content = source.slice(start, end).trim();
    if (sections.has(id)) {
      throw new Error(`Duplicate Copilot knowledge section: ${id}`);
    }
    sections.set(id, content);
  });

  const requiredSections: readonly KnowledgeSectionId[] = [
    "core",
    ...COPILOT_KNOWLEDGE_INTENTS
  ];
  for (const id of requiredSections) {
    if (!sections.get(id)) {
      throw new Error(`Missing Copilot knowledge section: ${id}`);
    }
  }

  return sections;
}

const KNOWLEDGE_SECTIONS = parseKnowledgeSections(knowledgeSource);

export function classifyCopilotQuestion(
  question: string
): CopilotKnowledgeIntent[] {
  const normalizedQuestion = question.trim();
  if (!normalizedQuestion) return ["unsupported"];

  const matches = INTENT_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalizedQuestion))
  ).map(({ intent }) => intent);

  return matches.length > 0 ? matches.slice(0, 3) : ["unsupported"];
}

export function getLatestUserQuestion(messages: readonly UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;

    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  return "";
}

export function buildCopilotKnowledgeContext(question: string): string {
  const intents = classifyCopilotQuestion(question);
  const selectedSections: KnowledgeSectionId[] = ["core", ...intents];
  const content = selectedSections.map((id) => {
    const section = KNOWLEDGE_SECTIONS.get(id);
    if (!section) throw new Error(`Missing Copilot knowledge section: ${id}`);
    return `## ${id}\n${section}`;
  });

  return [
    "[TRUSTED_COPILOT_KNOWLEDGE]",
    `Selected guidance: ${intents.join(", ")}`,
    ...content,
    "[END_TRUSTED_COPILOT_KNOWLEDGE]"
  ].join("\n\n");
}
