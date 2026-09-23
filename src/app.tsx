import {
  ArrowLeftIcon,
  SparkleIcon
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { StrategyPreferences } from "./domain";
import {
  useBiddrAgent,
  type AgentConnectionStatus
} from "./client/use-biddr-agent";
import { AuctionDashboard } from "./components/auction-dashboard";
import { CopilotChat } from "./components/copilot-chat";
import { ResetDemoButton } from "./components/reset-demo-button";

const connectionLabels: Record<AgentConnectionStatus, string> = {
  connecting: "Connecting",
  connected: "Online",
  reconnecting: "Reconnecting",
  unavailable: "Offline"
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
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const mobileChatLauncherRef = useRef<HTMLButtonElement>(null);
  const mobileChatCloseRef = useRef<HTMLButtonElement>(null);
  const [actionFeedback, setActionFeedback] =
    useState<ActionFeedback | null>(null);
  const controlsDisabled =
    connectionStatus !== "connected" || !agent.state || pendingAction !== null;

  useEffect(() => {
    if (!mobileChatOpen) return;

    const previousOverflow = document.body.style.overflow;
    const backgroundElements = [
      document.querySelector<HTMLElement>(".topbar"),
      document.querySelector<HTMLElement>(".auction-column")
    ].filter((element): element is HTMLElement => element !== null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileChatOpen(false);
        window.requestAnimationFrame(() => mobileChatLauncherRef.current?.focus());
      }
    };

    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => element.setAttribute("inert", ""));
    window.addEventListener("keydown", closeOnEscape);
    mobileChatCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => element.removeAttribute("inert"));
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileChatOpen]);

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
      <a className="skip-link" href="#main">
        Skip to auction workspace
      </a>
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

      <main id="main" className="workspace" tabIndex={-1}>
        <AuctionDashboard
          agentState={agent.state}
          controlsDisabled={controlsDisabled}
          pendingAction={pendingAction}
          actionFeedback={actionFeedback}
          onAdvance={advanceLot}
          onPass={passPlayer}
          onSaveStrategy={saveStrategy}
        />

        <button
          className="mobile-chat-launcher"
          ref={mobileChatLauncherRef}
          type="button"
          aria-controls="copilot-panel"
          aria-expanded={mobileChatOpen}
          data-chat-open={mobileChatOpen}
          onClick={() => setMobileChatOpen(true)}
        >
          <SparkleIcon size={17} weight="fill" aria-hidden="true" />
          Open strategy room
        </button>

        <aside
          id="copilot-panel"
          className="copilot-column"
          data-mobile-open={mobileChatOpen}
          aria-labelledby="copilot-heading"
          role={mobileChatOpen ? "dialog" : undefined}
          aria-modal={mobileChatOpen || undefined}
        >
          <div className="copilot-header">
            <button
              className="mobile-chat-close"
              ref={mobileChatCloseRef}
              type="button"
              aria-label="Back to auction"
              onClick={() => {
                setMobileChatOpen(false);
                window.requestAnimationFrame(() =>
                  mobileChatLauncherRef.current?.focus()
                );
              }}
            >
              <ArrowLeftIcon size={19} aria-hidden="true" />
            </button>
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
              {connectionStatus === "reconnecting" ? (
                <p className="connection-help" role="status">
                  Restoring the connection. Your auction state remains saved.
                </p>
              ) : null}
              {connectionStatus === "unavailable" ? (
                <p className="connection-help" role="alert">
                  The Agent is unavailable. Your auction state remains saved;
                  retry when your connection is ready.
                </p>
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
