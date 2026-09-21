import { describe, expect, it } from "vitest";
import {
  CHAT_RECOVERY_CONFIG,
  CHAT_STREAM_STALL_TIMEOUT_MS,
  MAX_PERSISTED_CHAT_MESSAGES
} from "../../src/agent/chat-config";

describe("persistent chat configuration", () => {
  it("bounds SQLite message retention independently of model context", () => {
    expect(MAX_PERSISTED_CHAT_MESSAGES).toBe(100);
  });

  it("bounds stalled and repeatedly interrupted streams", () => {
    expect(CHAT_STREAM_STALL_TIMEOUT_MS).toBe(60_000);
    expect(CHAT_RECOVERY_CONFIG).toMatchObject({
      maxAttempts: 4,
      noProgressTimeoutMs: 120_000,
      maxRecoveryWork: 80,
      maxOomRetries: 1
    });
  });

  it("uses a terminal recovery message that preserves state expectations", () => {
    expect(CHAT_RECOVERY_CONFIG.terminalMessage).toContain(
      "Your auction state is safe"
    );
  });
});

