// What an MCP tool answers (Node only): text for the agent, pictures it can look at, and the data as JSON in the last block.
// Refusals are the agent's answer (`fail`), never a crash.

export interface TextPart { type: "text"; text: string }
export interface ImagePart { type: "image"; data: string; mimeType: "image/png" }
export type Result = { content: (TextPart | ImagePart)[]; isError?: boolean };

/** A refusal: its message is the agent's answer. */
export class Refusal extends Error {}

/** An answer: a line for the agent, then any pictures (PNG bytes), then the data as JSON in the last block. */
export const ok = (text: string, data?: unknown, images: readonly Buffer[] = []): Result => ({
  content: [
    { type: "text", text },
    ...images.map((b): ImagePart => ({ type: "image", data: b.toString("base64"), mimeType: "image/png" })),
    ...(data === undefined ? [] : [{ type: "text" as const, text: JSON.stringify(data, null, 1) }]),
  ],
});
export const fail = (text: string): Result => ({ isError: true, content: [{ type: "text", text }] });
