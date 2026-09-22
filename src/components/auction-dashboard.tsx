import {
  GaugeIcon,
  UsersThreeIcon,
  WalletIcon
} from "@phosphor-icons/react";
import type { BiddrAgentState } from "../agent/state";
import {
  PLAYER_ROLES,
  ROLE_TARGETS,
  getCurrentPlayer,
  getNextBidAmount,
  getTeamComposition,
  type PlayerRole
} from "../domain";
import { formatLakhAsCrore } from "../client/format";

const ROLE_LABELS: Record<PlayerRole, { singular: string; plural: string }> = {
  batter: { singular: "Batter", plural: "Batters" },
  wicketkeeper: { singular: "Wicketkeeper", plural: "Wicketkeepers" },
  "all-rounder": { singular: "All-rounder", plural: "All-rounders" },
  "fast-bowler": { singular: "Fast bowler", plural: "Fast bowlers" },
  "spin-bowler": { singular: "Spin bowler", plural: "Spin bowlers" }
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function LoadingAuctionDashboard() {
  return (
    <section
      className="auction-column"
      aria-labelledby="auction-heading"
      aria-busy="true"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live simulation</p>
          <h1 id="auction-heading">Auction command</h1>
        </div>
        <span className="lot-pill">Syncing</span>
      </div>
      <article
        className="player-card dashboard-loading"
        role="status"
        aria-label="Loading auction state"
      >
        <span className="loading-mark" aria-hidden="true" />
        <div>
          <h2>Loading auction state</h2>
          <p>Connecting this browser to its private Biddr session…</p>
        </div>
      </article>
    </section>
  );
}

export function AuctionDashboard({
  agentState
}: {
  agentState: BiddrAgentState | undefined;
}) {
  if (!agentState) return <LoadingAuctionDashboard />;

  const { auction } = agentState;
  const currentPlayer = getCurrentPlayer(auction);
  const composition = getTeamComposition(auction);
  const pursePercent = Math.round(
    (auction.purseRemainingLakh / auction.initialPurseLakh) * 100
  );
  const lotNumber =
    auction.status === "active" ? auction.currentLotIndex + 1 : null;

  return (
    <section className="auction-column" aria-labelledby="auction-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live simulation · {auction.teamName}</p>
          <h1 id="auction-heading">Auction command</h1>
        </div>
        <span className="lot-pill">
          {lotNumber === null
            ? "Auction complete"
            : `Lot ${String(lotNumber).padStart(2, "0")} / ${String(auction.playerQueue.length).padStart(2, "0")}`}
        </span>
      </div>

      {currentPlayer ? (
        <article className="player-card">
          <div className="player-card-topline">
            <span className="role-label">
              {ROLE_LABELS[currentPlayer.role].singular}
            </span>
            <span className="fictional-label">
              Rating {currentPlayer.rating} · Fictional player
            </span>
          </div>
          <div className="player-identity">
            <div className="player-avatar" aria-hidden="true">
              {getInitials(currentPlayer.name)}
            </div>
            <div>
              <h2>{currentPlayer.name}</h2>
              <p>{currentPlayer.style}</p>
            </div>
          </div>
          <dl className="bid-grid">
            <div>
              <dt>Base price</dt>
              <dd>{formatLakhAsCrore(currentPlayer.basePriceLakh)}</dd>
            </div>
            <div>
              <dt>Current bid</dt>
              <dd>
                {formatLakhAsCrore(
                  auction.currentBid?.amountLakh ?? currentPlayer.basePriceLakh
                )}
              </dd>
              <small>{auction.currentBid?.bidder ?? "Opening call"}</small>
            </div>
            <div>
              <dt>Next bid</dt>
              <dd className="accent-text">
                {formatLakhAsCrore(getNextBidAmount(auction))}
              </dd>
            </div>
          </dl>
          <div
            className="placeholder-actions"
            aria-label="Auction controls preview"
          >
            <button className="button button-primary" type="button" disabled>
              Place bid
            </button>
            <button className="button button-secondary" type="button" disabled>
              Pass
            </button>
          </div>
        </article>
      ) : (
        <article className="player-card auction-complete-card" role="status">
          <span className="role-label">All lots resolved</span>
          <h2>Auction complete</h2>
          <p>
            The final squad and remaining purse are shown below. Reset controls
            will be enabled in a later interaction step.
          </p>
        </article>
      )}

      <section className="metrics-grid" aria-label="Team auction metrics">
        <article className="metric-card">
          <WalletIcon size={20} aria-hidden="true" />
          <span>Available purse</span>
          <strong>{formatLakhAsCrore(auction.purseRemainingLakh)}</strong>
          <small>{pursePercent}% remaining</small>
        </article>
        <article className="metric-card">
          <UsersThreeIcon size={20} aria-hidden="true" />
          <span>Squad</span>
          <strong>
            {composition.totalPlayers} / {auction.squadLimit}
          </strong>
          <small>
            {composition.openSlots} slot{composition.openSlots === 1 ? "" : "s"}{" "}
            open
          </small>
        </article>
        <article className="metric-card">
          <GaugeIcon size={20} aria-hidden="true" />
          <span>Reserve target</span>
          <strong>{auction.strategy.reservePercent}%</strong>
          <small>{auction.strategy.riskTolerance} risk</small>
        </article>
      </section>

      <article className="panel squad-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Composition</p>
            <h2>Squad requirements</h2>
          </div>
          <span>{composition.totalPlayers} signed</span>
        </div>
        <ul className="role-list">
          {PLAYER_ROLES.map((role) => {
            const current = composition.counts[role];
            const target = ROLE_TARGETS[role];
            const label = ROLE_LABELS[role].plural;

            return (
              <li key={role}>
                <div>
                  <span>{label}</span>
                  <strong>
                    {current} / {target}
                  </strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${label}: ${current} of ${target}`}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(target, current)}
                  aria-valuenow={current}
                >
                  <span
                    style={{
                      width: `${Math.min((current / target) * 100, 100)}%`
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
