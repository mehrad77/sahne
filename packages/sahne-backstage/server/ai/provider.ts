// What the assistant's models (models.ts) share (Node only): the shape of a tool and a picture, the error a model or the
// web turns into for the editor, the network every call goes through (stubbed by the tests: `setFetch`, and a stubbed
// network is never retried), and a tool's schema as Claude's API takes it.

export interface Picture { name: string; mediaType: string; data: string }
export interface ToolDef { name: string; description: string; schema: Record<string, unknown> }

export class ProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Fetch = typeof fetch;
let fetcher: Fetch = (...a) => fetch(...a), stubbed = false;
/** Tests stub the network. */
export const setFetch = (f: Fetch) => { fetcher = f; stubbed = true; };
export const net: Fetch = (...a) => fetcher(...a);
/** How often a failed model call is tried again: twice, none on a stubbed network. */
export const retries = () => (stubbed ? 0 : 2);

/** A JSON Schema as a provider takes it: no `$schema`. */
export function schemaFor(s: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _drop, ...rest } = s;
  return { type: "object", properties: {}, ...(draft2020(rest) as Record<string, unknown>) };
}

/**
 * A schema in JSON Schema 2020-12, as Anthropic's API requires: a tuple written the draft-07 way (`items` as a list, with
 * `additionalItems`), which zod's converter writes for a z.tuple, becomes `prefixItems` (and `items: false` for none more).
 */
function draft2020(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(draft2020);
  if (!v || typeof v !== "object") return v;
  const o = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, draft2020(x)])) as Record<string, unknown>;
  if (Array.isArray(o.items)) {
    const { items, additionalItems, ...more } = o;
    return { ...more, prefixItems: items, ...(additionalItems === undefined ? {} : { items: additionalItems }) };
  }
  return o;
}

/** About four characters a token: for a server that reports no usage, so the token caps still bind. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
