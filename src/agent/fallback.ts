import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessageChunk
} from "ai";
import {
  PLAYER_ROLES,
  analyzeBid,
  getCurrentPlayer,
  getNextBidAmount,
  getRemainingPlayersByRole,
  getRoleMarket,
  getTeamComposition,
  type PlayerRole,
  type AuctionState
} from "../domain";
import {
  classifyCopilotQuestion,
  findMentionedRole,
  type CopilotConversationResolution,
  type CopilotKnowledgeIntent
} from "./knowledge-base";

const FALLBACK_TEXT_PART_ID = "biddr-deterministic-fallback";

export function buildDeterministicFallbackMessage(
  state: AuctionState,
  question = "",
  resolution?: CopilotConversationResolution
): string {
  const prefix =
    "Workers AI is unavailable or its daily quota has been reached, so Biddr is using its deterministic auction engine to answer this question.";
  const player = getCurrentPlayer(state);

  if (!question.trim()) {
    if (!player) {
      return "Workers AI is unavailable or its daily quota has been reached. Biddr is using its deterministic auction state: all lots are complete, so there is no active bid to evaluate.";
    }

    const recommendation = analyzeBid(state);
    return [
      "Workers AI is unavailable or its daily quota has been reached, so Biddr is using its deterministic auction engine.",
      `${recommendation.decision} on ${player.name}.`,
      `The next valid bid is ₹${recommendation.nextBidLakh}L, the maximum recommended bid is ₹${recommendation.maximumBidLakh}L, and ₹${state.purseRemainingLakh}L remains in the purse.`,
      ...recommendation.reasons
    ].join(" ");
  }

  const intents = resolution?.intents ?? classifyCopilotQuestion(question);
  const answers = intents.map((intent) =>
    buildIntentFallback(state, intent, question, resolution)
  );
  return [prefix, ...new Set(answers)].join(" ");
}

function formatMoney(amountLakh: number): string {
  return amountLakh >= 100
    ? `₹${(amountLakh / 100).toFixed(2)} Cr`
    : `₹${amountLakh}L`;
}

function formatRole(role: PlayerRole): string {
  return role.replaceAll("-", " ");
}

function buildIntentFallback(
  state: AuctionState,
  intent: CopilotKnowledgeIntent,
  question: string,
  resolution?: CopilotConversationResolution
): string {
  const player = getCurrentPlayer(state);
  const referencedPlayer = resolution?.referencedPlayer ?? null;

  if (intent === "capabilities") {
    return "You can ask about the current player, safe and next bids, squad gaps, role priorities, purse and reserve, remaining players, comparisons, strategy, or a simulated bid.";
  }
  if (intent === "unsupported") {
    return "I’m focused on this fictional auction. Ask me about the current player, bidding, the squad, purse, remaining players, or strategy.";
  }
  if (intent === "simulated-bid") {
    return "I can’t safely open a bid approval while model inference is unavailable. Your auction state is unchanged; please try the request again.";
  }
  if (!player) {
    return "The auction is complete, so there is no active player or next bid.";
  }

  const recommendation = analyzeBid(state);
  const composition = getTeamComposition(state);

  switch (intent) {
    case "auction-status":
      return `The auction is active on lot ${state.currentLotIndex + 1} of ${state.playerQueue.length}: ${player.name}. The current bid is ${formatMoney(state.currentBid?.amountLakh ?? player.basePriceLakh)}${state.currentBid ? ` by ${state.currentBid.bidder}` : " at the base price"}, and the next valid bid is ${formatMoney(getNextBidAmount(state))}.`;
    case "current-player":
      return `The current player is ${player.name}, a ${formatRole(player.role)} (${player.style}), rated ${player.rating}. The base price is ${formatMoney(player.basePriceLakh)} and estimated value is ${formatMoney(player.estimatedValueLakh)}.`;
    case "team-composition": {
      const counts = PLAYER_ROLES.map(
        (role) => `${formatRole(role)} ${composition.counts[role]}`
      ).join(", ");
      const gaps = PLAYER_ROLES.filter((role) => composition.gaps[role] > 0)
        .map((role) => `${formatRole(role)} ${composition.gaps[role]}`)
        .join(", ");
      return `${state.teamName} has ${composition.totalPlayers} players and ${composition.openSlots} open slots. Role counts: ${counts}. Unfilled gaps: ${gaps || "none"}.`;
    }
    case "player-analysis":
      if (referencedPlayer && referencedPlayer.id !== player.id) {
        if (referencedPlayer.source === "squad") {
          return `${referencedPlayer.name} is already in ${state.teamName}'s squad as a ${formatRole(referencedPlayer.role)}, acquired for ${formatMoney(referencedPlayer.acquisitionPriceLakh ?? 0)}. Bid analysis applies only to the active auction player, ${player.name}.`;
        }
        return `${referencedPlayer.name} is a ${formatRole(referencedPlayer.role)} (${referencedPlayer.style ?? "style unavailable"}), rated ${referencedPlayer.rating ?? "unrated"}, with an estimated value of ${formatMoney(referencedPlayer.estimatedValueLakh ?? 0)}. ${player.name} is the active player, so a deterministic bid ceiling for ${referencedPlayer.name} will only be available when that player becomes active.`;
      }
      return `${recommendation.decision} on ${player.name}. The maximum safe bid is ${formatMoney(recommendation.maximumBidLakh)} and the next valid bid is ${formatMoney(recommendation.nextBidLakh)}, leaving ${formatMoney(Math.max(recommendation.headroomLakh, 0))} headroom. ${recommendation.reasons.slice(0, 3).join(" ")}`;
    case "safe-bid":
      if (referencedPlayer && referencedPlayer.id !== player.id) {
        return `${referencedPlayer.name} is not the active player, so there is no deterministic safe-bid ceiling for them yet. The current ceiling of ${formatMoney(recommendation.maximumBidLakh)} applies only to ${player.name}.`;
      }
      return `The maximum safe bid for ${player.name} is ${formatMoney(recommendation.maximumBidLakh)}. The next valid bid is ${formatMoney(recommendation.nextBidLakh)}, leaving ${formatMoney(Math.max(recommendation.headroomLakh, 0))} headroom; stop when the next bid would exceed the ceiling.`;
    case "squad-priority": {
      const priorities = PLAYER_ROLES.map((role) => getRoleMarket(state, role))
        .filter((market) => market.squadGap > 0)
        .sort(
          (left, right) =>
            right.scarcityScore - left.scarcityScore ||
            right.squadGap - left.squadGap
        )
        .slice(0, 3);
      return `Prioritize ${priorities.map((market) => `${formatRole(market.role)} (gap ${market.squadGap}, ${market.remainingSupply} remaining, scarcity ${market.scarcityScore}/100)`).join(", then ")}.`;
    }
    case "purse-reserve":
      return `${state.teamName} has ${formatMoney(state.purseRemainingLakh)} remaining. ${formatMoney(recommendation.factors.reserveFloorLakh)} is protected, leaving ${formatMoney(recommendation.factors.spendableAboveReserveLakh)} above reserve across ${composition.openSlots} open slots.`;
    case "remaining-players": {
      const remaining = getRemainingPlayersByRole(state);
      const role = resolution?.referencedRole ?? findMentionedRole(question);
      const roles = role ? [role] : PLAYER_ROLES;
      const summaries = roles.map((currentRole) => {
        const players = remaining[currentRole];
        const names = players
          .slice(0, 3)
          .map((candidate) => `${candidate.name} (${candidate.rating})`)
          .join(", ");
        return `${formatRole(currentRole)}: ${players.length} remaining${names ? ` — ${names}` : ""}`;
      });
      return summaries.join("; ") + ".";
    }
    case "comparison": {
      const comparisonRole = referencedPlayer?.role ?? player.role;
      const comparisonId = referencedPlayer?.id ?? player.id;
      const comparisonName = referencedPlayer?.name ?? player.name;
      const alternatives = getRemainingPlayersByRole(state)[comparisonRole]
        .filter((candidate) => candidate.id !== comparisonId)
        .sort((left, right) => right.rating - left.rating)
        .slice(0, 2);
      if (alternatives.length === 0) {
        return `${comparisonName} has no remaining ${formatRole(comparisonRole)} alternatives in the current queue.`;
      }
      const comparisonSummary =
        referencedPlayer?.source === "squad"
          ? `${referencedPlayer.name} is already in the squad at ${formatMoney(referencedPlayer.acquisitionPriceLakh ?? 0)}`
          : referencedPlayer
            ? `${referencedPlayer.name} is rated ${referencedPlayer.rating ?? "unrated"} with an estimated value of ${formatMoney(referencedPlayer.estimatedValueLakh ?? 0)}`
            : `${player.name} is rated ${player.rating} with an estimated value of ${formatMoney(player.estimatedValueLakh)}`;
      return `${comparisonSummary}. Remaining ${formatRole(comparisonRole)} alternatives: ${alternatives.map((candidate) => `${candidate.name}, rated ${candidate.rating}, estimated ${formatMoney(candidate.estimatedValueLakh)}`).join("; ")}.`;
    }
    case "strategy-summary":
      return `The strategy is ${state.strategy.riskTolerance}, protects ${state.strategy.reservePercent}% of the initial purse, and prioritizes ${state.strategy.priorityRoles.map(formatRole).join(" and ")}. With the current squad and purse, the engine recommends ${recommendation.decision} on ${player.name} up to ${formatMoney(recommendation.maximumBidLakh)}.`;
  }
}

function writeFallbackChunks(
  enqueue: (chunk: UIMessageChunk) => void,
  message: string
) {
  enqueue({ type: "text-start", id: FALLBACK_TEXT_PART_ID });
  enqueue({
    type: "text-delta",
    id: FALLBACK_TEXT_PART_ID,
    delta: message
  });
  enqueue({ type: "text-end", id: FALLBACK_TEXT_PART_ID });
}

export function createDeterministicFallbackResponse(
  state: AuctionState,
  question = "",
  resolution?: CopilotConversationResolution
): Response {
  const message = buildDeterministicFallbackMessage(
    state,
    question,
    resolution
  );
  return createTextResponse(message);
}

export function createTextResponse(message: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writeFallbackChunks((chunk) => writer.write(chunk), message);
    }
  });

  return createUIMessageStreamResponse({ stream });
}

export function createFallbackAwareResponse(
  modelStream: ReadableStream<UIMessageChunk>,
  getState: () => AuctionState,
  getQuestion: () => string = () => "",
  getResolution: () => CopilotConversationResolution | undefined = () =>
    undefined
): Response {
  let fallbackWritten = false;
  const stream = modelStream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (chunk.type !== "error") {
          controller.enqueue(chunk);
          return;
        }

        if (!fallbackWritten) {
          fallbackWritten = true;
          writeFallbackChunks((fallbackChunk) => {
            controller.enqueue(fallbackChunk);
          }, buildDeterministicFallbackMessage(
            getState(),
            getQuestion(),
            getResolution()
          ));
        }
      }
    })
  );

  return createUIMessageStreamResponse({ stream });
}
