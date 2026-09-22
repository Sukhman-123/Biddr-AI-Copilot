import { useCallback, useState } from "react";
import { isTerminalCloseEvent } from "agents/client";
import { useAgent } from "agents/react";
import type { BiddrAgentState } from "../agent/state";
import type { BiddrCopilotAgent } from "../server";

export const BIDDR_AGENT_CLASS_NAME = "BiddrCopilotAgent";

export type AgentConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "unavailable";

export function useBiddrAgent(sessionId: string) {
  const [connectionStatus, setConnectionStatus] =
    useState<AgentConnectionStatus>("connecting");
  const agent = useAgent<BiddrCopilotAgent, BiddrAgentState>({
    agent: BIDDR_AGENT_CLASS_NAME,
    name: sessionId,
    onOpen: () => setConnectionStatus("connected"),
    onError: () =>
      setConnectionStatus((status) =>
        status === "unavailable" ? status : "reconnecting"
      ),
    onClose: (event) => {
      if (!isTerminalCloseEvent(event)) {
        setConnectionStatus("reconnecting");
      }
    },
    onConnectionError: () => setConnectionStatus("unavailable")
  });

  const reconnect = useCallback(() => {
    setConnectionStatus("connecting");
    agent.reconnect();
  }, [agent]);

  return { agent, connectionStatus, reconnect };
}
