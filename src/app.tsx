import {
  ChatCircleDotsIcon,
  GaugeIcon,
  ShieldCheckIcon,
  SparkleIcon,
  UsersThreeIcon,
  WalletIcon
} from "@phosphor-icons/react";

const squadRoles = [
  { role: "Batters", current: 3, target: 5 },
  { role: "All-rounders", current: 1, target: 3 },
  { role: "Wicketkeepers", current: 1, target: 2 },
  { role: "Bowlers", current: 2, target: 5 }
];

function App() {
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
        <section className="auction-column" aria-labelledby="auction-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Live simulation</p>
              <h1 id="auction-heading">Auction command</h1>
            </div>
            <span className="lot-pill">Lot 04 / 12</span>
          </div>

          <article className="player-card">
            <div className="player-card-topline">
              <span className="role-label">Fast bowler</span>
              <span className="fictional-label">Fictional player</span>
            </div>
            <div className="player-identity">
              <div className="player-avatar" aria-hidden="true">
                AS
              </div>
              <div>
                <h2>Aarya Sen</h2>
                <p>Right-arm pace · New-ball specialist</p>
              </div>
            </div>
            <dl className="bid-grid">
              <div>
                <dt>Base price</dt>
                <dd>₹1.20 Cr</dd>
              </div>
              <div>
                <dt>Current bid</dt>
                <dd>₹2.40 Cr</dd>
              </div>
              <div>
                <dt>Next bid</dt>
                <dd className="accent-text">₹2.60 Cr</dd>
              </div>
            </dl>
            <div className="placeholder-actions" aria-label="Auction controls preview">
              <button className="button button-primary" type="button" disabled>
                Place bid
              </button>
              <button className="button button-secondary" type="button" disabled>
                Pass
              </button>
            </div>
          </article>

          <section className="metrics-grid" aria-label="Team auction metrics">
            <article className="metric-card">
              <WalletIcon size={20} aria-hidden="true" />
              <span>Available purse</span>
              <strong>₹38.60 Cr</strong>
              <small>64% remaining</small>
            </article>
            <article className="metric-card">
              <UsersThreeIcon size={20} aria-hidden="true" />
              <span>Squad</span>
              <strong>7 / 15</strong>
              <small>8 slots open</small>
            </article>
            <article className="metric-card">
              <GaugeIcon size={20} aria-hidden="true" />
              <span>Reserve target</span>
              <strong>30%</strong>
              <small>Strategy memory</small>
            </article>
          </section>

          <article className="panel squad-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Composition</p>
                <h2>Squad requirements</h2>
              </div>
              <span>7 signed</span>
            </div>
            <ul className="role-list">
              {squadRoles.map(({ role, current, target }) => (
                <li key={role}>
                  <div>
                    <span>{role}</span>
                    <strong>
                      {current} / {target}
                    </strong>
                  </div>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={`${role}: ${current} of ${target}`}
                    aria-valuemin={0}
                    aria-valuemax={target}
                    aria-valuenow={current}
                  >
                    <span style={{ width: `${(current / target) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>

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
            <span className="connection-state">Foundation ready</span>
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

