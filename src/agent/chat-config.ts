import type { ChatRecoveryConfig } from "@cloudflare/ai-chat";

export const MAX_PERSISTED_CHAT_MESSAGES = 100;
export const CHAT_STREAM_STALL_TIMEOUT_MS = 60_000;

export const CHAT_RECOVERY_CONFIG = {
  maxAttempts: 4,
  stableTimeoutMs: 10_000,
  noProgressTimeoutMs: 120_000,
  maxRecoveryWork: 80,
  maxOomRetries: 1,
  terminalMessage:
    "The copilot response was interrupted and could not recover. Your auction state is safe; please try again."
} as const satisfies Exclude<ChatRecoveryConfig, boolean>;

