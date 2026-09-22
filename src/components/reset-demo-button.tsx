import { useState } from "react";

export function ResetDemoButton({
  disabled,
  resetting,
  onReset
}: {
  disabled: boolean;
  resetting: boolean;
  onReset: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming || disabled || resetting) {
    return (
      <button
        className="button button-secondary"
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {resetting ? "Resetting…" : "Reset demo"}
      </button>
    );
  }

  return (
    <div className="reset-confirmation" role="group" aria-label="Confirm reset">
      <button
        className="button button-danger"
        type="button"
        disabled={resetting}
        onClick={() => {
          setConfirming(false);
          void onReset();
        }}
      >
        {resetting ? "Resetting…" : "Confirm reset"}
      </button>
      <button
        className="button button-secondary"
        type="button"
        disabled={resetting}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </div>
  );
}
