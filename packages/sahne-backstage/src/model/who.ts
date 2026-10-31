// Who made an edit, in a person's words (pure): the editor's assistant (`assistant`), a run of the assistant
// (`run:<id>`, every step of it), or an agent by its MCP client's name.

/** The editor's own assistant, in a chat or in a run. */
export const isAssistant = (by: string): boolean => by === "assistant" || by.startsWith("run:");

/** "The assistant", "The assistant's run r3", or the agent's name; `lower` for the middle of a sentence. */
export function who(by: string, lower = false): string {
  const s = by === "assistant" ? "The assistant" : by.startsWith("run:") ? `The assistant's run ${by.slice(4)}` : by;
  return lower && isAssistant(by) ? s[0].toLowerCase() + s.slice(1) : s;
}
