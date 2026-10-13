export function generatedTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  return firstLine
    .replace(/^\s*(?:title|tytuł)\s*:\s*/i, "")
    .replace(/^\s*[#"'`]+|["'`]+\s*$/g, "")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70)
    .trim();
}

/** Give every new conversation a name even when title generation is unavailable. */
export function conversationTitle(
  message: string,
  attachmentNames: readonly string[],
) {
  return (
    generatedTitle(message) ||
    generatedTitle(attachmentNames[0] ?? "") ||
    "New chat"
  );
}
