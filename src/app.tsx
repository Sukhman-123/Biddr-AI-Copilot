import {
  ChatCircleDotsIcon,
  ShieldCheckIcon,
  SparkleIcon
} from "@phosphor-icons/react";
import {
  useBiddrAgent,
  type AgentConnectionStatus
} from "./client/use-biddr-agent";
import { AuctionDashboard } from "./components/auction-dashboard";

const connectionLabels: Record<AgentConnectionStatus, string> = {
  connecting: "Connecting to Agent",
  connected: "Agent connected",
  reconnecting: "Reconnecting to Agent",
  unavailable: "Agent unavailable"
};

type AppProps = {
  sessionId: string;
};

function App({ sessionId }: AppProps) {
  const { agent, connectionStatus, reconnect } = useBiddrAgent(sessionId);

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
          <button className="button button-secondary" type="button" disabled>
            Reset demo
          </button>
        </div>
      </header>

      <main id="main" className="workspace">
        <AuctionDashboard agentState={agent.state} />

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

          <div className="chat-preview">
            <div className="empty-chat">
              <ChatCircleDotsIcon size={30} aria-hidden="true" />
              <h3>Your copilot joins in Phase 3</h3>
              <p>
                Streaming chat, live auction tools, and remembered strategy will
                appear here after the deterministic engine is complete.
              </p>
            </div>

            <section className="guardrail-note" aria-label="Recommendation policy">
              <ShieldCheckIcon size={19} aria-hidden="true" />
              <div>
                <strong>Numbers stay deterministic</strong>
                <p>The AI explains decisions; tested code sets every bid ceiling.</p>
              </div>
            </section>
          </div>

          <form className="composer" aria-label="Copilot message preview">
            <label htmlFor="copilot-message">Ask the copilot</label>
            <div className="composer-row">
              <textarea
                id="copilot-message"
                rows={2}
                placeholder="Should I bid on Aarya Sen?"
                disabled
              />
              <button className="send-button" type="submit" disabled>
                Send
              </button>
            </div>
            <small>Chat integration is intentionally disabled in Phase 1.</small>
          </form>
        </aside>
      </main>
    </div>
  );
}

export default App;
