export const AUCTION_CONTEXT_SECTIONS = [
  "financial-summary",
  "squad-summary",
  "active-player-details",
  "active-bid",
  "recommendation",
  "strategy",
  "team-composition",
  "role-markets",
  "remaining-players",
  "squad"
] as const;

export type AuctionContextSection =
  (typeof AUCTION_CONTEXT_SECTIONS)[number];

export type CopilotStarterIcon =
  | "analysis"
  | "currency"
  | "roles"
  | "strategy";

type CopilotCapabilityDefinition = {
  id: string;
  title: string;
  examples: readonly string[];
  patterns: readonly RegExp[];
  contextSections: readonly AuctionContextSection[];
  starterIcon: CopilotStarterIcon | null;
  starterOrder?: number;
};

export const COPILOT_CAPABILITIES = [
  {
    id: "simulated-bid",
    title: "Simulated bid",
    examples: ["Prepare a simulated bid of 260 lakh"],
    patterns: [
      /\b(?:prepare|place|make|submit|commit|confirm|accept)\b.*\bbid\b/i,
      /\bbid\b.*\b(?:₹|rs\.?|inr|lakh|lakhs|crore|crores|cr)\b/i
    ],
    contextSections: [
      "financial-summary",
      "active-player-details",
      "active-bid",
      "recommendation",
      "strategy"
    ],
    starterIcon: null
  },
  {
    id: "safe-bid",
    title: "Safe bid",
    examples: ["What’s our maximum safe bid?"],
    patterns: [
      /\b(?:maximum|max|safe|ceiling|limit|headroom|next)\b.*\bbid\b/i,
      /\b(?:bid|spend|go)\b.*\b(?:maximum|max|safe|ceiling|limit|higher|high)\b/i,
      /\bhow (?:high|far)\b/i,
      /\bhow much can we bid\b/i
    ],
    contextSections: [
      "financial-summary",
      "active-player-details",
      "active-bid",
      "recommendation",
      "strategy"
    ],
    starterIcon: "currency",
    starterOrder: 2
  },
  {
    id: "auction-status",
    title: "Auction status",
    examples: ["What is the current lot and latest bid?"],
    patterns: [
      /\b(?:auction status|auction progress|current lot|which lot|lot number)\b/i,
      /\b(?:current|latest) bid(?:der)?\b/i,
      /\bis the auction (?:active|complete|finished|over)\b/i
    ],
    contextSections: ["active-bid"],
    starterIcon: null
  },
  {
    id: "current-player",
    title: "Current player",
    examples: ["Who is the current player?"],
    patterns: [
      /\b(?:who|which) is the current player\b/i,
      /\bcurrent player(?:'s)?\b.*\b(?:name|role|style|rating|base price|estimated value|details?)\b/i,
      /\b(?:name|role|style|rating|base price|estimated value)\b.*\bcurrent player\b/i
    ],
    contextSections: ["active-player-details", "active-bid"],
    starterIcon: null
  },
  {
    id: "team-composition",
    title: "Team composition",
    examples: ["What is our team composition?"],
    patterns: [
      /\b(?:team|squad) composition\b/i,
      /\b(?:who|which players?) (?:is|are) in (?:our|the) (?:team|squad)\b/i,
      /\b(?:squad size|open slots?|players? (?:do we have|in our squad))\b/i
    ],
    contextSections: ["squad-summary", "team-composition", "squad"],
    starterIcon: null
  },
  {
    id: "player-analysis",
    title: "Player analysis",
    examples: ["Analyze this player"],
    patterns: [
      /\b(?:analy[sz]e|assess|evaluate|recommend)\b.*\b(?:player|him|her|lot)\b/i,
      /\b(?:should|do) we bid\b/i,
      /\b(?:worth|value|valuation)\b/i,
      /\b(?:bid|caution|pass)\b.*\bdecision\b/i
    ],
    contextSections: [
      "financial-summary",
      "active-player-details",
      "active-bid",
      "recommendation",
      "strategy"
    ],
    starterIcon: "analysis",
    starterOrder: 1
  },
  {
    id: "squad-priority",
    title: "Squad priority",
    examples: ["Which squad role should we target next?"],
    patterns: [
      /\b(?:role|position|squad gap|need|priority|prioritise|prioritize|target)\b/i,
      /\bwhat should we (?:target|buy|fill) next\b/i
    ],
    contextSections: [
      "squad-summary",
      "strategy",
      "team-composition",
      "role-markets"
    ],
    starterIcon: "roles",
    starterOrder: 3
  },
  {
    id: "purse-reserve",
    title: "Purse and reserve",
    examples: ["How much can we spend while protecting our reserve?"],
    patterns: [
      /\b(?:purse|budget|reserve|afford|cash|funds?|spendable|spending)\b/i,
      /\bhow much (?:is left|do we have|can we spend)\b/i
    ],
    contextSections: [
      "financial-summary",
      "squad-summary",
      "active-bid",
      "recommendation",
      "strategy",
      "team-composition"
    ],
    starterIcon: null
  },
  {
    id: "remaining-players",
    title: "Remaining players",
    examples: ["Who are the remaining fast bowlers?"],
    patterns: [
      /\b(?:remaining|available|upcoming|left|next)\b.*\bplayers?\b/i,
      /\bplayers?\b.*\b(?:remaining|available|upcoming|left)\b/i,
      /\b(?:remaining|available|upcoming|left|next)\b.*\b(?:batters?|wicketkeepers?|all[- ]rounders?|fast bowlers?|pacers?|spin bowlers?|spinners?)\b/i,
      /\bwho (?:is|are)(?: still)? (?:available|left|up next)\b/i,
      /\b(?:batters?|wicketkeepers?|all[- ]rounders?|fast bowlers?|pacers?|spin bowlers?|spinners?)\b.*\b(?:remaining|available|left)\b/i
    ],
    contextSections: [
      "squad-summary",
      "team-composition",
      "role-markets",
      "remaining-players"
    ],
    starterIcon: null
  },
  {
    id: "comparison",
    title: "Player comparison",
    examples: ["Compare this player with the remaining options"],
    patterns: [
      /\b(?:compare|comparison|versus|vs\.?|alternative|better option)\b/i,
      /\bbetter than\b/i
    ],
    contextSections: [
      "financial-summary",
      "squad-summary",
      "active-player-details",
      "active-bid",
      "recommendation",
      "strategy",
      "team-composition",
      "role-markets",
      "remaining-players"
    ],
    starterIcon: null
  },
  {
    id: "strategy-summary",
    title: "Auction strategy",
    examples: ["Summarize our auction strategy"],
    patterns: [
      /\b(?:strategy|plan|approach|risk tolerance|preference|priorities)\b/i,
      /\bsummari[sz]e\b.*\bauction\b/i
    ],
    contextSections: [
      "financial-summary",
      "squad-summary",
      "recommendation",
      "strategy",
      "team-composition",
      "role-markets"
    ],
    starterIcon: "strategy",
    starterOrder: 4
  },
  {
    id: "capabilities",
    title: "Copilot capabilities",
    examples: ["What can I ask you?"],
    patterns: [
      /\bwhat can (?:you|i) (?:do|ask)\b/i,
      /\b(?:help|capabilities|supported questions|examples?)\b/i
    ],
    contextSections: ["squad-summary", "team-composition"],
    starterIcon: null
  },
  {
    id: "unsupported",
    title: "Unsupported request",
    examples: [],
    patterns: [],
    contextSections: [],
    starterIcon: null
  }
] as const satisfies readonly CopilotCapabilityDefinition[];

export type CopilotKnowledgeIntent =
  (typeof COPILOT_CAPABILITIES)[number]["id"];

export const COPILOT_KNOWLEDGE_INTENTS: readonly CopilotKnowledgeIntent[] =
  COPILOT_CAPABILITIES.map(({ id }) => id);

export function getCopilotCapability(intent: CopilotKnowledgeIntent) {
  const capability = COPILOT_CAPABILITIES.find(({ id }) => id === intent);
  if (!capability) throw new Error(`Unknown Copilot capability: ${intent}`);
  return capability;
}

export function getRequiredContextSections(
  intents: readonly CopilotKnowledgeIntent[]
): ReadonlySet<AuctionContextSection> {
  return new Set(
    intents.flatMap((intent) => getCopilotCapability(intent).contextSections)
  );
}

export function getCopilotStarterCapabilities() {
  return [...COPILOT_CAPABILITIES]
    .filter(({ starterIcon }) => starterIcon !== null)
    .sort(
    (left, right) =>
      ("starterOrder" in left ? left.starterOrder : Number.MAX_SAFE_INTEGER) -
      ("starterOrder" in right ? right.starterOrder : Number.MAX_SAFE_INTEGER)
    );
}
