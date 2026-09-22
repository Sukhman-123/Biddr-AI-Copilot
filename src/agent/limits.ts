export const MAX_TOOL_STEPS = 6;
export const MAX_OUTPUT_TOKENS = 768;
export const MAX_MODEL_CONTEXT_MESSAGES = 24;
export const MAX_MODEL_CONTEXT_CHARACTERS = 12_000;
export const MAX_USER_MESSAGE_CHARACTERS = 1_200;
export const MAX_ASSISTANT_MESSAGE_CHARACTERS = 4_000;
export const MAX_MESSAGE_PARTS = 16;

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

type TextChatMessageLike = ChatMessageLike & {
  text: string;
};

export function selectBoundedChatContext<T extends TextChatMessageLike>(
  messages: readonly T[],
  maximumMessages = MAX_MODEL_CONTEXT_MESSAGES,
  maximumCharacters = MAX_MODEL_CONTEXT_CHARACTERS
): T[] {
  if (!Number.isInteger(maximumCharacters) || maximumCharacters < 1) {
    throw new RangeError(
      "Maximum context characters must be a positive integer."
    );
  }

  const recent = selectRecentChatMessages(messages, maximumMessages);
  const selected: T[] = [];
  let characterCount = 0;

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (!message) continue;

    if (characterCount + message.text.length > maximumCharacters) break;
    selected.push(message);
    characterCount += message.text.length;
  }

  const chronological = selected.reverse();
  const firstUserIndex = chronological.findIndex(
    (message) => message.role === "user"
  );

  return firstUserIndex > 0 ? chronological.slice(firstUserIndex) : chronological;
}
