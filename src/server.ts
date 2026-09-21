import {
  AIChatAgent,
  type OnChatMessageOptions
} from "@cloudflare/ai-chat";
import { convertToModelMessages, streamText } from "ai";
import { routeAgentRequest } from "agents";
import { createWorkersAI } from "workers-ai-provider";
import { BIDDR_MODEL_ID, BIDDR_SYSTEM_PROMPT } from "./agent/model";
import {
  createInitialAgentState,
  type BiddrAgentState
} from "./agent/state";

/**
 * The stateful Biddr agent is intentionally a foundation-only shell in Phase 1.
 * Auction state, model tools, and streaming responses are introduced in Phases
 * 2 and 3 after the deterministic domain engine exists.
 */
export class BiddrCopilotAgent extends AIChatAgent<Env, BiddrAgentState> {
  initialState = createInitialAgentState();
  maxPersistedMessages = 100;
  chatRecovery = true;

  async onChatMessage(
    _onFinish: unknown,
    options?: OnChatMessageOptions
  ) {
    const workersai = createWorkersAI({ binding: this.env.AI });
    const result = streamText({
      model: workersai(BIDDR_MODEL_ID, {
        sessionAffinity: this.sessionAffinity
      }),
      system: BIDDR_SYSTEM_PROMPT,
      messages: await convertToModelMessages(this.messages),
      ...(options?.abortSignal ? { abortSignal: options.abortSignal } : {})
    });

    return result.toUIMessageStreamResponse();
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
