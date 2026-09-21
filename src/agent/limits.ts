export const MAX_TOOL_STEPS = 6;
export const MAX_OUTPUT_TOKENS = 768;
export const MAX_MODEL_CONTEXT_MESSAGES = 24;

type ChatMessageLike = {
  role: string;
};

export function selectRecentChatMessages<T extends ChatMessageLike>(
  messages: readonly T[],
  maximum = MAX_MODEL_CONTEXT_MESSAGES
): T[] {
  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new RangeError("Maximum context messages must be a positive integer.");
  }

  const recent = messages.slice(-maximum);
  const firstUserIndex = recent.findIndex((message) => message.role === "user");

  return firstUserIndex > 0 ? recent.slice(firstUserIndex) : recent;
}

