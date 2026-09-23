import {
  AIChatAgent,
  type OnChatMessageOptions
} from "@cloudflare/ai-chat";
import {
  convertToModelMessages,
  pruneMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText
} from "ai";
import { callable, routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import {
  createDeterministicFallbackResponse,
  createFallbackAwareResponse,
  createTextResponse
} from "./agent/fallback";
import {
  frameValidatedChatContext
} from "./agent/chat-context";
import {
  CHAT_RECOVERY_CONFIG,
  CHAT_STREAM_STALL_TIMEOUT_MS,
  MAX_PERSISTED_CHAT_MESSAGES
} from "./agent/chat-config";
import {
  MAX_MODEL_CONTEXT_MESSAGES,
  hasSuccessfulToolResult,
  selectBoundedChatContext,
  MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
} from "./agent/limits";
import { BIDDR_MODEL_ID, BIDDR_SYSTEM_PROMPT } from "./agent/model";
import { prepareBiddrModelStep } from "./agent/model-loop";
import {
  parseBiddrAgentState,
  strategyPreferencesSchema
} from "./agent/schemas";
import {
  advanceAgentCurrentLot,
  createInitialAgentState,
  passAgentCurrentPlayer,
  rememberAgentStrategy,
  resetAgentState,
  type BiddrAgentState
} from "./agent/state";
import {
  assertBiddrModelToolSurface,
  createAuctionTools
} from "./agent/tools";
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

  private getValidatedState(): BiddrAgentState {
    return parseBiddrAgentState(this.state);
  }

  private setValidatedState(state: BiddrAgentState): void {
    this.setState(parseBiddrAgentState(state));
  }

  private getFallbackAuction() {
    try {
      return this.getValidatedState().auction;
    } catch {
      return createInitialAgentState().auction;
    }
  }

  @callable()
  getSnapshot(): BiddrAgentState {
    return this.getValidatedState();
  }

  @callable()
  rememberStrategy(input: StrategyPreferences): BiddrAgentState {
    const strategy = strategyPreferencesSchema.parse(input);
    const nextState = rememberAgentStrategy(this.getValidatedState(), strategy);
    this.setValidatedState(nextState);
    return nextState;
  }

  @callable()
  passPlayer(): BiddrAgentState {
    const nextState = passAgentCurrentPlayer(this.getValidatedState());
    this.setValidatedState(nextState);
    return nextState;
  }

  @callable()
  advanceLot(): BiddrAgentState {
    const nextState = advanceAgentCurrentLot(this.getValidatedState());
    this.setValidatedState(nextState);
    return nextState;
  }

  @callable()
  resetDemo(): BiddrAgentState {
    const nextState = resetAgentState();
    this.setValidatedState(nextState);
    return nextState;
  }

  async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    try {
      void this.getValidatedState();
      const tools = createAuctionTools({
        getAgentState: () => this.getValidatedState(),
        setAgentState: (nextState) => this.setValidatedState(nextState)
      });
      assertBiddrModelToolSurface(tools);
      const validatedMessages = await safeValidateUIMessages({
        messages: this.messages,
        // The Agent SDK supplies untyped persisted UI messages. Runtime tool
        // schemas still validate every matching static tool part here.
        tools: tools as never
      });
      if (!validatedMessages.success) {
        return createTextResponse(
          "Biddr could not safely read that conversation message. Please send your question again."
        );
      }

      const chatContext = frameValidatedChatContext(validatedMessages.data);
      if (chatContext.rejectedLatestUserMessage) {
        return createTextResponse(
          "Please keep a single chat message under 1,200 characters and send it again."
        );
      }

      const workersai = createWorkersAI({ binding: this.env.AI });
      const recentMessages = selectBoundedChatContext(
        chatContext.messages.map((message) => ({
          message,
          role: message.role,
          text: message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")
        })),
        MAX_MODEL_CONTEXT_MESSAGES
      ).map(({ message }) => message);
      const modelMessages = pruneMessages({
        messages: await convertToModelMessages(recentMessages, { tools }),
        reasoning: "before-last-message",
        toolCalls: "before-last-2-messages"
      });
      const result = streamText({
        model: workersai(BIDDR_MODEL_ID, {
          sessionAffinity: this.sessionAffinity
        }),
        system: BIDDR_SYSTEM_PROMPT,
        messages: modelMessages,
        tools,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        stopWhen: [
          hasSuccessfulToolResult("analyzeBid"),
          stepCountIs(MAX_TOOL_STEPS)
        ],
        prepareStep: ({ steps }) => prepareBiddrModelStep(steps),
        ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {})
      });
      const modelStream = result.toUIMessageStream({
        onError: () => "Workers AI unavailable"
      });

      return createFallbackAwareResponse(
        modelStream,
        () => this.getFallbackAuction()
      );
    } catch {
      return createDeterministicFallbackResponse(this.getFallbackAuction());
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
