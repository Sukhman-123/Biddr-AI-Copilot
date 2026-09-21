import { AIChatAgent } from "@cloudflare/ai-chat";
import { routeAgentRequest } from "agents";
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

  async onChatMessage() {
    return Response.json(
      {
        error: "The Biddr copilot will be connected in Phase 3."
      },
      { status: 503 }
    );
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
