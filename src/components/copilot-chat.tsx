import {
  ChatCircleDotsIcon,
  ShieldCheckIcon
} from "@phosphor-icons/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { isToolUIPart, type UIMessage } from "ai";
import type {
  AgentConnectionStatus,
  useBiddrAgent
} from "../client/use-biddr-agent";
import { ToolActivity } from "./tool-activity";

const STARTER_PROMPTS = [
  "Should we bid on the current player?",
  "Which role should we prioritize next?",
  "Explain our purse and reserve strategy."
] as const;

type BiddrAgentConnection = ReturnType<typeof useBiddrAgent>["agent"];

function hasVisiblePart(message: UIMessage): boolean {
  return message.parts.some(
    (part) =>
      (part.type === "text" && part.text.length > 0) || isToolUIPart(part)
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
  const transcriptRef = useRef<HTMLDivElement>(null);
  const {
    addToolApprovalResponse,
    messages,
    sendMessage,
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
  const canSend = connected && !busy && input.trim().length > 0;

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, isStreaming]);

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (!connected || busy || trimmed.length === 0) return;

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

  return (
    <>
      <div
        className="chat-preview"
        ref={transcriptRef}
        aria-label="Copilot conversation"
        aria-live="polite"
      >
        {visibleMessages.length === 0 ? (
          <div className="empty-chat">
            <ChatCircleDotsIcon size={30} aria-hidden="true" />
            <h3>Plan the next move</h3>
            <p>
              Ask Biddr to analyze the current player, squad gaps, or remaining
              purse. Every numerical recommendation comes from the auction
              engine.
            </p>
            <div className="starter-prompts" aria-label="Suggested questions">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendText(prompt)}
                  disabled={!connected || busy}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="chat-messages">
            {visibleMessages.map((message) => (
              <li className={`chat-message chat-message-${message.role}`} key={message.id}>
                <span className="chat-message-author">
                  {message.role === "user" ? "You" : "Biddr"}
                </span>
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
                      return (
                        <ToolActivity
                          part={part}
                          approvalDisabled={!connected || busy}
                          onApprovalResponse={addToolApprovalResponse}
                          key={part.toolCallId}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              </li>
            ))}
          </ol>
        )}

        {status === "error" ? (
          <p className="chat-error" role="alert">
            Biddr could not complete that response. Your conversation is still
            saved; try sending the question again.
          </p>
        ) : null}

        {busy ? (
          <p className="chat-progress" role="status">
            {isRecovering
              ? "Recovering Biddr’s response…"
              : isStreaming
                ? "Biddr is responding…"
                : "Biddr is thinking…"}
          </p>
        ) : null}

        <section className="guardrail-note" aria-label="Recommendation policy">
          <ShieldCheckIcon size={19} aria-hidden="true" />
          <div>
            <strong>Numbers stay deterministic</strong>
            <p>The AI explains decisions; tested code sets every bid ceiling.</p>
          </div>
        </section>
      </div>

      <form className="composer" aria-label="Send a message to Biddr" onSubmit={handleSubmit}>
        <label htmlFor="copilot-message">Ask the copilot</label>
        <div className="composer-row">
          <textarea
            id="copilot-message"
            name="message"
            rows={2}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Should we bid on the current player?"
            aria-describedby="composer-hint"
            disabled={!connected || busy}
          />
          <button className="send-button" type="submit" disabled={!canSend}>
            Send
          </button>
        </div>
        <small id="composer-hint">
          Enter sends · Shift+Enter adds a new line
        </small>
      </form>
    </>
  );
}
