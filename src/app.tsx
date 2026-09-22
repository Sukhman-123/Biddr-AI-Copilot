import {
  SparkleIcon
} from "@phosphor-icons/react";
import { useState } from "react";
import type { StrategyPreferences } from "./domain";
import {
  useBiddrAgent,
  type AgentConnectionStatus
} from "./client/use-biddr-agent";
import { AuctionDashboard } from "./components/auction-dashboard";
import { CopilotChat } from "./components/copilot-chat";
import { ResetDemoButton } from "./components/reset-demo-button";

const connectionLabels: Record<AgentConnectionStatus, string> = {
  connecting: "Connecting to Agent",
  connected: "Agent connected",
  reconnecting: "Reconnecting to Agent",
  unavailable: "Agent unavailable"
};

type AppProps = {
  sessionId: string;
};

type PendingAction = "strategy" | "pass" | "advance" | "reset";

type ActionFeedback = {
  tone: "success" | "error";
  message: string;
};

function App({ sessionId }: AppProps) {
  const { agent, connectionStatus, reconnect } = useBiddrAgent(sessionId);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null);
  const controlsDisabled =
    connectionStatus !== "connected" || !agent.state || pendingAction !== null;

  const runAction = async (
    action: PendingAction,
    successMessage: string,
    operation: () => Promise<unknown>
  ) => {
    if (controlsDisabled) return;

    setPendingAction(action);
    setActionFeedback(null);
    try {
      await operation();
      setActionFeedback({ tone: "success", message: successMessage });
    } catch {
      setActionFeedback({
        tone: "error",
        message:
          "The Agent could not apply that change. Reconnect and try again."
      });
    } finally {
      setPendingAction(null);
    }
  };

  const saveStrategy = (strategy: StrategyPreferences) =>
    runAction(
      "strategy",
      "Strategy saved. Future recommendations now use these preferences.",
      () => agent.stub.rememberStrategy(strategy)
    );

  const passPlayer = () =>
    runAction("pass", "Player passed. The next lot is now active.", () =>
      agent.stub.passPlayer()
    );

  const advanceLot = () =>
    runAction("advance", "Lot resolved. The auction has advanced.", () =>
      agent.stub.advanceLot()
    );

  const resetDemo = () =>
    runAction("reset", "Auction state reset to the starting lineup.", () =>
      agent.stub.resetDemo()
    );

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#main" aria-label="Biddr AI Copilot home">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>
            <strong>Biddr</strong>
            <small>AI Copilot</small>
          </span>
        </a>

        <div className="topbar-actions">
          <span className="platform-badge">
            <span className="status-dot" aria-hidden="true" />
            Cloudflare-native
          </span>
          <ResetDemoButton
            disabled={controlsDisabled}
            resetting={pendingAction === "reset"}
            onReset={resetDemo}
          />
        </div>
      </header>

      <main id="main" className="workspace">
        <AuctionDashboard
          agentState={agent.state}
          controlsDisabled={controlsDisabled}
          pendingAction={pendingAction}
          actionFeedback={actionFeedback}
          onAdvance={advanceLot}
          onPass={passPlayer}
          onSaveStrategy={saveStrategy}
        />

        <aside className="copilot-column" aria-labelledby="copilot-heading">
          <div className="copilot-header">
            <div className="copilot-title">
              <span className="copilot-icon" aria-hidden="true">
                <SparkleIcon size={18} weight="fill" />
              </span>
              <div>
                <h2 id="copilot-heading">Strategy room</h2>
                <p>Grounded auction guidance</p>
              </div>
            </div>
            <div className="connection-controls">
              <span
                className="connection-state"
                data-status={connectionStatus}
                role="status"
                aria-live="polite"
              >
                <span className="connection-dot" aria-hidden="true" />
                {connectionLabels[connectionStatus]}
              </span>
              {connectionStatus === "unavailable" ? (
                <button
                  className="connection-retry"
                  type="button"
                  onClick={reconnect}
                >
                  Retry
                </button>
              ) : null}
            </div>
          </div>

          <CopilotChat agent={agent} connectionStatus={connectionStatus} />
        </aside>
      </main>
    </div>
  );
}

export default App;
