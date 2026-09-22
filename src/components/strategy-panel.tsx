import { useMemo, useState, type FormEvent } from "react";
import {
  PLAYER_ROLES,
  type PlayerRole,
  type RiskTolerance,
  type StrategyPreferences
} from "../domain";

const ROLE_LABELS: Record<PlayerRole, string> = {
  batter: "Batter",
  wicketkeeper: "Wicketkeeper",
  "all-rounder": "All-rounder",
  "fast-bowler": "Fast bowler",
  "spin-bowler": "Spin bowler"
};

const RISK_OPTIONS: ReadonlyArray<{
  value: RiskTolerance;
  label: string;
}> = [
  { value: "conservative", label: "Conservative" },
  { value: "balanced", label: "Balanced" },
  { value: "aggressive", label: "Aggressive" }
];

function copyStrategy(strategy: StrategyPreferences): StrategyPreferences {
  return {
    ...strategy,
    priorityRoles: [...strategy.priorityRoles]
  };
}

function strategiesMatch(
  first: StrategyPreferences,
  second: StrategyPreferences
): boolean {
  return (
    first.reservePercent === second.reservePercent &&
    first.riskTolerance === second.riskTolerance &&
    PLAYER_ROLES.every(
      (role) =>
        first.priorityRoles.includes(role) ===
        second.priorityRoles.includes(role)
    )
  );
}

export function StrategyPanel({
  strategy,
  disabled = false,
  saving = false,
  onSave
}: {
  strategy: StrategyPreferences;
  disabled?: boolean;
  saving?: boolean;
  onSave: ((strategy: StrategyPreferences) => void | Promise<void>) | undefined;
}) {
  const [draft, setDraft] = useState(() => copyStrategy(strategy));

  const dirty = useMemo(
    () => !strategiesMatch(draft, strategy),
    [draft, strategy]
  );

  const handleRoleChange = (role: PlayerRole, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      priorityRoles: checked
        ? [...current.priorityRoles, role]
        : current.priorityRoles.filter((priority) => priority !== role)
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || disabled || saving || !onSave) return;
    void onSave(copyStrategy(draft));
  };

  return (
    <section className="panel strategy-panel" aria-labelledby="strategy-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Durable memory</p>
          <h2 id="strategy-heading">Auction strategy</h2>
        </div>
        <span>{dirty ? "Unsaved changes" : "Saved to Agent"}</span>
      </div>

      <div className="active-strategy" aria-label="Active strategy preferences">
        <span>{strategy.reservePercent}% reserve</span>
        <span>{strategy.riskTolerance} risk</span>
        {strategy.priorityRoles.map((role) => (
          <span key={role}>{ROLE_LABELS[role]} priority</span>
        ))}
      </div>

      <form className="strategy-form" onSubmit={handleSubmit}>
        <label className="reserve-control" htmlFor="reserve-percent">
          <span>
            Reserve purse
            <output htmlFor="reserve-percent">{draft.reservePercent}%</output>
          </span>
          <input
            id="reserve-percent"
            type="range"
            min={0}
            max={90}
            step={5}
            value={draft.reservePercent}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                reservePercent: event.currentTarget.valueAsNumber
              }))
            }
            disabled={disabled || saving}
          />
        </label>

        <fieldset disabled={disabled || saving}>
          <legend>Risk tolerance</legend>
          <div className="strategy-options">
            {RISK_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  type="radio"
                  name="risk-tolerance"
                  value={option.value}
                  checked={draft.riskTolerance === option.value}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      riskTolerance: option.value
                    }))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset disabled={disabled || saving}>
          <legend>Priority roles</legend>
          <div className="priority-options">
            {PLAYER_ROLES.map((role) => (
              <label key={role}>
                <input
                  type="checkbox"
                  checked={draft.priorityRoles.includes(role)}
                  onChange={(event) =>
                    handleRoleChange(role, event.currentTarget.checked)
                  }
                />
                <span>{ROLE_LABELS[role]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="strategy-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={disabled || saving || !dirty || !onSave}
          >
            {saving ? "Saving…" : "Save strategy"}
          </button>
          <small>
            Saved preferences immediately influence deterministic bid ceilings.
          </small>
        </div>
      </form>
    </section>
  );
}
