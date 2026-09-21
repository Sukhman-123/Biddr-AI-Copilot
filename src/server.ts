import {
  AIChatAgent,
  type OnChatMessageOptions
} from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  streamText
} from "ai";
import { callable, routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
  createDeterministicFallbackResponse,
  createFallbackAwareResponse
} from "./agent/fallback";
import {
  CHAT_RECOVERY_CONFIG,
  CHAT_STREAM_STALL_TIMEOUT_MS,
  MAX_PERSISTED_CHAT_MESSAGES
} from "./agent/chat-config";
import {
  MAX_MODEL_CONTEXT_MESSAGES,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  selectRecentChatMessages
} from "./agent/limits";
import { BIDDR_MODEL_ID, BIDDR_SYSTEM_PROMPT } from "./agent/model";
import { strategyPreferencesSchema } from "./agent/schemas";
import {
  advanceAgentCurrentLot,
  createInitialAgentState,
  passAgentCurrentPlayer,
  rememberAgentStrategy,
  resetAgentState,
  type BiddrAgentState
} from "./agent/state";
import { createAuctionTools } from "./agent/tools";
import type { StrategyPreferences } from "./domain";

/**
 * The stateful Biddr agent is intentionally a foundation-only shell in Phase 1.
 * Auction state, model tools, and streaming responses are introduced in Phases
 * 2 and 3 after the deterministic domain engine exists.
 */
export class BiddrCopilotAgent extends AIChatAgent<Env, BiddrAgentState> {
  initialState = createInitialAgentState();
  maxPersistedMessages = MAX_PERSISTED_CHAT_MESSAGES;
  chatRecovery = CHAT_RECOVERY_CONFIG;
  chatStreamStallTimeoutMs = CHAT_STREAM_STALL_TIMEOUT_MS;

  @callable()
  getSnapshot(): BiddrAgentState {
    return this.state;
  }

  @callable()
  rememberStrategy(input: StrategyPreferences): BiddrAgentState {
    const strategy = strategyPreferencesSchema.parse(input);
    const nextState = rememberAgentStrategy(this.state, strategy);
    this.setState(nextState);
    return nextState;
  }

  @callable()
  passPlayer(): BiddrAgentState {
    const nextState = passAgentCurrentPlayer(this.state);
    this.setState(nextState);
    return nextState;
  }

  @callable()
  advanceLot(): BiddrAgentState {
    const nextState = advanceAgentCurrentLot(this.state);
    this.setState(nextState);
    return nextState;
  }

  @callable()
  resetDemo(): BiddrAgentState {
    const nextState = resetAgentState();
    this.setState(nextState);
    return nextState;
  }

  async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    try {
      const workersai = createWorkersAI({ binding: this.env.AI });
      const recentMessages = selectRecentChatMessages(
        this.messages,
        MAX_MODEL_CONTEXT_MESSAGES
      );
      const modelMessages = pruneMessages({
        messages: await convertToModelMessages(recentMessages),
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages"
      });
      const result = streamText({
        model: workersai(BIDDR_MODEL_ID, {
          sessionAffinity: this.sessionAffinity
        }),
        system: BIDDR_SYSTEM_PROMPT,
        messages: modelMessages,
        tools: createAuctionTools({
          getAgentState: () => this.state,
          setAgentState: (state) => this.setState(state)
        }),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        stopWhen: stepCountIs(MAX_TOOL_STEPS),
        ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {})
      });
      const modelStream = result.toUIMessageStream({
        onError: () => "Workers AI unavailable"
      });

      return createFallbackAwareResponse(
        modelStream,
        () => this.state.auction
      );
    } catch {
      return createDeterministicFallbackResponse(this.state.auction);
    }
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
