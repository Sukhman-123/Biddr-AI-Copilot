import type { UIMessage } from "ai";
import knowledgeSource from "../../knowledge/copilot-guide.md?raw";
import {
  getCurrentPlayer,
  type AuctionState,
  type PlayerRole
} from "../domain";
import {
  COPILOT_CAPABILITIES,
  COPILOT_KNOWLEDGE_INTENTS,
  type CopilotKnowledgeIntent
} from "../shared/copilot-capabilities";

export { COPILOT_KNOWLEDGE_INTENTS };
export type { CopilotKnowledgeIntent };

type KnowledgeSectionId = "core" | CopilotKnowledgeIntent;

export type CopilotConversationResolution = {
  question: string;
  intents: CopilotKnowledgeIntent[];
  inheritedIntents: CopilotKnowledgeIntent[];
  isFollowUp: boolean;
  referencedPlayer: CopilotPlayerReference | null;
  referencedPlayerIsCurrent: boolean;
  referencedRole: PlayerRole | null;
};

export type CopilotPlayerReference = {
  id: string;
  name: string;
  role: PlayerRole;
  source: "auction-pool" | "squad";
  style: string | null;
  basePriceLakh: number | null;
  estimatedValueLakh: number | null;
  rating: number | null;
  acquisitionPriceLakh: number | null;
};

const REFERENTIAL_QUESTION_PATTERN =
  /\b(?:he|him|his|she|her|hers|they|them|their|it|its|that|this|those|these|same|one|option)\b/i;
const FOLLOW_UP_QUESTION_PATTERN =
  /^(?:and\b|also\b|why\b|how about\b|what about\b|what if\b|tell me more\b|explain\b|compare\b)/i;

const ROLE_PATTERNS: ReadonlyArray<[PlayerRole, RegExp]> = [
  ["wicketkeeper", /\b(?:wicketkeepers?|keepers?|wk)\b/i],
  ["all-rounder", /\b(?:all[- ]rounders?|allrounders?)\b/i],
  ["fast-bowler", /\b(?:fast bowlers?|pace bowlers?|pacers?|quicks?)\b/i],
  ["spin-bowler", /\b(?:spin bowlers?|spinners?)\b/i],
  ["batter", /\b(?:batters?|batsmen|batswomen)\b/i]
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

  const matches = COPILOT_CAPABILITIES.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalizedQuestion))
  ).map(({ id }) => id);

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

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function getTrustedPlayers(state: AuctionState): CopilotPlayerReference[] {
  const players = new Map<string, CopilotPlayerReference>();
  for (const player of state.playerQueue) {
    players.set(player.id, {
      ...player,
      source: "auction-pool",
      acquisitionPriceLakh: null
    });
  }
  for (const member of state.squad) {
    if (players.has(member.playerId)) continue;
    players.set(member.playerId, {
      id: member.playerId,
      name: member.name,
      role: member.role,
      source: "squad",
      style: null,
      basePriceLakh: null,
      estimatedValueLakh: null,
      rating: null,
      acquisitionPriceLakh: member.acquisitionPriceLakh
    });
  }
  return [...players.values()];
}

function findPlayerMention(
  text: string,
  players: readonly CopilotPlayerReference[]
): CopilotPlayerReference | null {
  const normalizeWords = (value: string) =>
    ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const normalizedText = normalizeWords(text);
  const namePartCounts = new Map<string, number>();
  for (const player of players) {
    for (const part of player.name.toLowerCase().split(/\s+/)) {
      namePartCounts.set(part, (namePartCounts.get(part) ?? 0) + 1);
    }
  }
  const mentions = players.flatMap((player) => {
    const fullName = player.name.toLowerCase();
    const uniqueNameParts = fullName
      .split(/\s+/)
      .filter((part) => namePartCounts.get(part) === 1);
    const candidates = [fullName, ...uniqueNameParts].map(normalizeWords);
    const finalIndex = Math.max(
      ...candidates.map((candidate) => normalizedText.lastIndexOf(candidate))
    );
    return finalIndex >= 0 ? [{ player, finalIndex }] : [];
  });

  mentions.sort((left, right) => right.finalIndex - left.finalIndex);
  return mentions[0]?.player ?? null;
}

export function findMentionedRole(text: string): PlayerRole | null {
  return ROLE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function findPreviousUserIntents(
  messages: readonly UIMessage[],
  latestUserIndex: number
): CopilotKnowledgeIntent[] {
  for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") continue;
    const intents = classifyCopilotQuestion(getMessageText(message));
    if (!intents.includes("unsupported")) return intents;
  }
  return [];
}

export function resolveCopilotConversation(
  messages: readonly UIMessage[],
  state: AuctionState
): CopilotConversationResolution {
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      latestUserIndex = index;
      break;
    }
  }

  const latestUserMessage =
    latestUserIndex >= 0 ? messages[latestUserIndex] : undefined;
  const question = latestUserMessage
    ? getMessageText(latestUserMessage).trim()
    : "";
  const directIntents = classifyCopilotQuestion(question);
  const hasReference = REFERENTIAL_QUESTION_PATTERN.test(question);
  const isShortQuestion = question.split(/\s+/).filter(Boolean).length <= 8;
  const trustedPlayers = getTrustedPlayers(state);
  const explicitlyReferencedPlayer = findPlayerMention(question, trustedPlayers);
  const explicitlyReferencedRole = findMentionedRole(question);
  const isFollowUp =
    latestUserIndex > 0 &&
    (FOLLOW_UP_QUESTION_PATTERN.test(question) ||
      hasReference ||
      (directIntents.includes("unsupported") &&
        isShortQuestion &&
        (explicitlyReferencedPlayer !== null ||
          explicitlyReferencedRole !== null)));
  const previousIntents = isFollowUp
    ? findPreviousUserIntents(messages, latestUserIndex)
    : [];
  const baseIntents = directIntents.includes("unsupported")
    ? []
    : directIntents;
  const inheritedIntents = directIntents.includes("unsupported")
    ? previousIntents
    : hasReference
      ? previousIntents.filter((intent) => !baseIntents.includes(intent))
      : [];
  const intents = [...new Set([...baseIntents, ...inheritedIntents])].slice(
    0,
    3
  );
  const resolvedIntents = intents.length > 0 ? intents : directIntents;

  let referencedPlayer = explicitlyReferencedPlayer;
  let referencedRole = explicitlyReferencedRole;

  if (isFollowUp && (!referencedPlayer || !referencedRole)) {
    for (let index = latestUserIndex - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message) continue;
      const text = getMessageText(message);
      referencedPlayer ??= findPlayerMention(text, trustedPlayers);
      referencedRole ??= findMentionedRole(text);
      if (referencedPlayer && referencedRole) break;
    }
  }

  const currentPlayer = getCurrentPlayer(state);
  if (isFollowUp && hasReference && !referencedPlayer) {
    referencedPlayer =
      trustedPlayers.find((candidate) => candidate.id === currentPlayer?.id) ??
      null;
  }
  referencedRole ??= referencedPlayer?.role ?? null;

  return {
    question,
    intents: resolvedIntents,
    inheritedIntents,
    isFollowUp,
    referencedPlayer,
    referencedPlayerIsCurrent:
      referencedPlayer !== null && referencedPlayer.id === currentPlayer?.id,
    referencedRole
  };
}

export function buildCopilotKnowledgeContext(
  question: string,
  resolution?: CopilotConversationResolution
): string {
  const intents = resolution?.intents ?? classifyCopilotQuestion(question);
  const selectedSections: KnowledgeSectionId[] = ["core", ...intents];
  const content = selectedSections.map((id) => {
    const section = KNOWLEDGE_SECTIONS.get(id);
    if (!section) throw new Error(`Missing Copilot knowledge section: ${id}`);
    return `## ${id}\n${section}`;
  });

  return [
    "[TRUSTED_COPILOT_KNOWLEDGE]",
    `Selected guidance: ${intents.join(", ")}`,
    ...(resolution?.isFollowUp
      ? [
          "Conversation follow-up resolution:",
          `- Inherited guidance: ${resolution.inheritedIntents.join(", ") || "none"}`,
          `- Referenced player: ${resolution.referencedPlayer?.name ?? "none"}`,
          `- Referenced player is current: ${resolution.referencedPlayerIsCurrent}`,
          `- Referenced role: ${resolution.referencedRole ?? "none"}`,
          "Use these resolved references only to understand the follow-up. If the referenced player is not current, never apply the current player's deterministic recommendation or bid ceiling to them."
        ]
      : []),
    ...content,
    "[END_TRUSTED_COPILOT_KNOWLEDGE]"
  ].join("\n\n");
}
