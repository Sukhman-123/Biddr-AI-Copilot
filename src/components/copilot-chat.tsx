import {
  ArrowUpIcon,
  ChartDonutIcon,
  ChatCircleDotsIcon,
  CrosshairIcon,
  CurrencyInrIcon,
  DotsThreeVerticalIcon,
  ShieldCheckIcon,
  SquareIcon,
  SparkleIcon,
  UsersThreeIcon
} from "@phosphor-icons/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { isToolUIPart, type UIMessage } from "ai";
import type {
  AgentConnectionStatus,
  useBiddrAgent
} from "../client/use-biddr-agent";
import { isProminentToolActivity } from "../client/tool-activity-presentation";
import { MAX_USER_MESSAGE_CHARACTERS } from "../agent/limits";
import {
  ToolActivity,
  ToolActivityGroup
} from "./tool-activity";

const STARTER_PROMPTS = [
  { label: "Analyze this player", Icon: CrosshairIcon },
  { label: "What’s our maximum safe bid?", Icon: CurrencyInrIcon },
  { label: "Which squad role should we target next?", Icon: UsersThreeIcon },
  { label: "Summarize our auction strategy", Icon: ChartDonutIcon }
] as const;

const CHARACTER_COUNTER_THRESHOLD = Math.floor(
  MAX_USER_MESSAGE_CHARACTERS * 0.8
);

type BiddrAgentConnection = ReturnType<typeof useBiddrAgent>["agent"];

function hasVisiblePart(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      (part.type === "text" && part.text.length > 0) || isToolUIPart(part)
  );
}

function ResponseProgress({
  label,
  stopDisabled,
  onStop
}: {
  label: string;
  stopDisabled: boolean;
  onStop: () => void;
}) {
  return (
    <div className="chat-response-progress" aria-label={`Biddr is ${label.toLowerCase()}`}>
      <span className="chat-typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>{label}</span>
      <button type="button" onClick={onStop} disabled={stopDisabled}>
        <SquareIcon size={9} weight="fill" aria-hidden="true" />
        Stop
      </button>
    </div>
  );
}

export function CopilotChat({
  agent,
  connectionStatus
}: {
  agent: BiddrAgentConnection;
  connectionStatus: AgentConnectionStatus;
}) {
  const [input, setInput] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const historyMenuRef = useRef<HTMLDetailsElement>(null);
  const {
    addToolApprovalResponse,
    clearHistory,
    messages,
    sendMessage,
    stop,
    status,
    isStreaming,
    isRecovering
  } = useAgentChat({
    agent,
    autoContinueAfterToolResult: true,
    resume: true
  });
  const busy = status === "submitted" || isStreaming || isRecovering;
  const connected = connectionStatus === "connected";
  const inputTooLong = input.length > MAX_USER_MESSAGE_CHARACTERS;
  const canSend =
    connected && !busy && !inputTooLong && input.trim().length > 0;
  const canClearHistory = connected && !busy && messages.length > 0;

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, isStreaming]);

  useEffect(() => {
    const composer = composerRef.current;
    if (!composer) return;

    composer.style.height = "auto";
    composer.style.height = `${Math.min(
      Math.max(composer.scrollHeight, 46),
      146
    )}px`;
  }, [input]);

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (
      !connected ||
      busy ||
      trimmed.length === 0 ||
      trimmed.length > MAX_USER_MESSAGE_CHARACTERS
    ) {
      return;
    }

    void sendMessage({
      role: "user",
      parts: [{ type: "text", text: trimmed }]
    });
    setInput("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendText(input);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const visibleMessages = messages.filter(hasVisiblePart);
  const composerStatus = !connected
    ? connectionStatus === "unavailable"
      ? "Agent offline"
      : connectionStatus === "reconnecting"
        ? "Reconnecting…"
        : "Connecting…"
    : isRecovering
      ? "Recovering response…"
      : isStreaming
        ? "Biddr is responding…"
        : status === "submitted"
          ? "Biddr is thinking…"
          : status === "error"
            ? "Ready to try again"
            : "Ready";
  const composerState = !connected ? "offline" : busy ? "busy" : "ready";
  const showCharacterCounter = input.length >= CHARACTER_COUNTER_THRESHOLD;
  const responseProgressLabel = isRecovering
    ? "Recovering"
    : isStreaming
      ? "Responding"
      : "Thinking";
  const lastVisibleMessage = visibleMessages.at(-1);

  const clearChat = () => {
    if (!canClearHistory) return;
    clearHistory();
    setConfirmingClear(false);
    historyMenuRef.current?.removeAttribute("open");
  };

  return (
    <>
      <div
        className="chat-preview"
        ref={transcriptRef}
        aria-label="Copilot conversation"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {visibleMessages.length === 0 && !busy ? (
          <div className="empty-chat">
            <span className="empty-chat-icon" aria-hidden="true">
              <ChatCircleDotsIcon size={25} weight="duotone" />
            </span>
            <h3>Make the next call</h3>
            <p>Get guidance grounded in your live auction state.</p>
            <div className="starter-prompts" aria-label="Suggested questions">
              {STARTER_PROMPTS.map(({ label, Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => sendText(label)}
                  disabled={!connected || busy}
                >
                  <span className="starter-prompt-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="chat-messages">
            {visibleMessages.map((message, messageIndex) => {
              const routineToolParts = message.parts
                .filter(isToolUIPart)
                .filter((part) => !isProminentToolActivity(part));
              let renderedRoutineTools = false;

              return (
              <li className={`chat-message chat-message-${message.role}`} key={message.id}>
                <div className="chat-message-identity">
                  {message.role === "assistant" ? (
                    <span className="chat-message-avatar" aria-hidden="true">
                      <SparkleIcon size={12} weight="fill" />
                    </span>
                  ) : null}
                  <span className="chat-message-author">
                    {message.role === "user" ? "You" : "Biddr"}
                  </span>
                </div>
                <div className="chat-message-parts">
                  {message.parts.map((part, index) => {
                    if (part.type === "text" && part.text.length > 0) {
                      return (
                        <p className="chat-message-text" key={`text-${index}`}>
                          {part.text}
                        </p>
                      );
                    }

                    if (isToolUIPart(part)) {
                      if (!isProminentToolActivity(part)) {
                        if (renderedRoutineTools) return null;
                        renderedRoutineTools = true;

                        return (
                          <ToolActivityGroup
                            parts={routineToolParts}
                            key="routine-tool-activity"
                          />
                        );
                      }

                      return (
                        <ToolActivity
                          part={part}
                          approvalDisabled={!connected || busy}
                          actionDisabled={!connected || busy}
                          onApprovalResponse={addToolApprovalResponse}
                          onPrepareBid={(amountLakh) =>
                            sendText(
                              `Prepare a simulated bid of ${amountLakh} lakh for the current player.`
                            )
                          }
                          key={part.toolCallId}
                        />
                      );
                    }

                    return null;
                  })}
                  {busy &&
                  message.role === "assistant" &&
                  messageIndex === visibleMessages.length - 1 ? (
                    <ResponseProgress
                      label={responseProgressLabel}
                      stopDisabled={!connected}
                      onStop={() => void stop()}
                    />
                  ) : null}
                </div>
              </li>
              );
            })}
            {busy && lastVisibleMessage?.role !== "assistant" ? (
              <li className="chat-message chat-message-assistant chat-message-pending">
                <div className="chat-message-identity">
                  <span className="chat-message-avatar" aria-hidden="true">
                    <SparkleIcon size={12} weight="fill" />
                  </span>
                  <span className="chat-message-author">Biddr</span>
                </div>
                <div className="chat-message-parts">
                  <ResponseProgress
                    label={responseProgressLabel}
                    stopDisabled={!connected}
                    onStop={() => void stop()}
                  />
                </div>
              </li>
            ) : null}
          </ol>
        )}

        {status === "error" ? (
          <p className="chat-error" role="alert">
            The model response could not finish. Your conversation and auction
            state are saved; check your connection and send the question again.
          </p>
        ) : null}

        <details className="guardrail-note">
          <summary>
            <ShieldCheckIcon size={15} aria-hidden="true" />
            <span>Engine-verified numbers</span>
          </summary>
          <p>Tested auction code sets every bid ceiling; AI explains the decision.</p>
        </details>
      </div>

      <div className="chat-history-actions">
        <details className="chat-menu" ref={historyMenuRef}>
          <summary aria-label="Chat options" title="Chat options">
            <DotsThreeVerticalIcon size={20} weight="bold" aria-hidden="true" />
          </summary>
          <div className="chat-menu-popover">
            {confirmingClear ? (
              <div role="group" aria-label="Confirm clear chat">
                <span>Clear this conversation only?</span>
                <div>
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={clearChat}
                  >
                    Confirm clear chat
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="chat-menu-item"
                type="button"
                disabled={!canClearHistory}
                onClick={() => setConfirmingClear(true)}
              >
                Clear chat
              </button>
            )}
          </div>
        </details>
      </div>

      <form className="composer" aria-label="Send a message to Biddr" onSubmit={handleSubmit}>
        <label className="composer-label" htmlFor="copilot-message">
          Ask the copilot
        </label>
        <div className="composer-shell" data-state={composerState}>
          <div className="composer-row">
            <textarea
              ref={composerRef}
              id="copilot-message"
              name="message"
              rows={1}
              maxLength={MAX_USER_MESSAGE_CHARACTERS}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Ask about the current player or your strategy…"
              aria-describedby="composer-hint"
              disabled={!connected || busy}
            />
            <button
              className="send-button"
              type="submit"
              aria-label="Send"
              title="Send message"
              disabled={!canSend}
            >
              <ArrowUpIcon size={19} weight="bold" aria-hidden="true" />
            </button>
          </div>
          <div className="composer-footer" id="composer-hint">
            <span className="composer-status" role="status" aria-live="polite">
              <span className="composer-status-dot" aria-hidden="true" />
              {composerStatus}
            </span>
            <span className="composer-shortcut">Enter to send · Shift+Enter for new line</span>
            {showCharacterCounter ? (
              <span className="composer-counter">
                {input.length} / {MAX_USER_MESSAGE_CHARACTERS}
              </span>
            ) : null}
          </div>
        </div>
      </form>
    </>
  );
}
