// The repo's READMEs as blocks the Docs page draws, pure: headings, paragraphs, lists (nested, with tables and code in
// their items), fenced code, tables and quotes, and in the words `code`, **bold**, *emphasis* and [links](…). Enough of
// Markdown for what the repo writes, not all of it. A paragraph that opens with a bold phrase (**The board** (…): …)
// is a "lead": the READMEs name their parts that way, so it gets an anchor and a place in the contents like a heading.
// Links are resolved against the document's path in the repo: to another guide the editor shows, to its page (#/docs);
// to anything else, to the repo on GitHub. Node-tested (test/docs.test.ts).

export type Inline = { t: "text"; text: string } | { t: "code"; text: string } | { t: "b" | "i"; kids: Inline[] } | { t: "a"; href: string; kids: Inline[] };
export type Block =
  | { t: "h"; level: number; id: string; text: string; kids: Inline[] }
  | { t: "p"; kids: Inline[]; lead?: { id: string; text: string } }
  | { t: "ul" | "ol"; items: Block[][] }
  | { t: "code"; lang: string; text: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "quote"; kids: Block[] };

/** A heading's anchor, as GitHub makes it: lower case, punctuation dropped, spaces as dashes. */
export const slug = (s: string) => s.toLowerCase().replace(/[`*_[\]()]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");

/** The words of a run of inlines. */
export const plain = (xs: Inline[]): string => xs.map(x => (x.t === "text" || x.t === "code" ? x.text : plain(x.kids))).join("");

/** A line's words: code first (nothing inside it is read), then links, bold and emphasis. */
export function inline(s: string): Inline[] {
  const out: Inline[] = [];
  let i = 0, text = "";
  const flush = () => { if (text) { out.push({ t: "text", text }); text = ""; } };
  while (i < s.length) {
    const c = s[i];
    if (c === "`") {
      const j = s.indexOf("`", i + 1);
      if (j > i) { flush(); out.push({ t: "code", text: s.slice(i + 1, j) }); i = j + 1; continue; }
    }
    if (c === "[") {
      const m = /^\[((?:[^\]`]|`[^`]*`)+)\]\(([^)\s]+)\)/.exec(s.slice(i));
      if (m) { flush(); out.push({ t: "a", href: m[2], kids: inline(m[1]) }); i += m[0].length; continue; }
    }
    if (c === "*" && s[i + 1] === "*") {
      const j = s.indexOf("**", i + 2);
      if (j > i + 2) { flush(); out.push({ t: "b", kids: inline(s.slice(i + 2, j)) }); i = j + 2; continue; }
    }
    if ((c === "*" || c === "_") && s[i + 1] !== " " && s[i + 1] !== c && (c === "*" || !/\w/.test(s[i - 1] ?? ""))) {
      const j = s.indexOf(c, i + 1);
      if (j > i + 1 && s[j - 1] !== " " && (c === "*" || !/\w/.test(s[j + 1] ?? ""))) { flush(); out.push({ t: "i", kids: inline(s.slice(i + 1, j)) }); i = j + 1; continue; }
    }
    text += c; i++;
  }
  flush();
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => inline(c.trim().replace(/\\\|/g, "|")));
const LIST = /^([-*]|\d+\.)\s+/;
const indentOf = (l: string) => /^ */.exec(l)![0].length;

/** A document as blocks. Headings' anchors repeat with -1, -2 as GitHub's do; leads have their own, and only at the top level. */
export function parse(md: string): Block[] { return blocksOf(md, new Map(), new Map(), true); }

function blocksOf(md: string, seen: Map<string, number>, leads: Map<string, number>, top: boolean): Block[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n"), out: Block[] = [];
  const anchor = (text: string, ids = seen) => { const s = slug(text), n = ids.get(s) ?? 0; ids.set(s, n + 1); return n ? `${s}-${n}` : s; };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^(`{3,})\s*(\S*)/.exec(l.trim()))) {
      const fence = m[1], body: string[] = [], pad = indentOf(l);
      for (i++; i < lines.length && !lines[i].trim().startsWith(fence); i++) body.push(lines[i].slice(Math.min(pad, indentOf(lines[i]))));
      i++;
      out.push({ t: "code", lang: m[2], text: body.join("\n") });
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(l))) { out.push({ t: "h", level: m[1].length, id: anchor(m[2]), text: plain(inline(m[2])), kids: inline(m[2]) }); i++; continue; }
    if (l.trim().startsWith("|") && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const head = cells(l), rows: Inline[][][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(cells(lines[i]));
      out.push({ t: "table", head, rows });
      continue;
    }
    if (/^>\s?/.test(l)) {
      const body: string[] = [];
      for (; i < lines.length && /^>\s?/.test(lines[i]); i++) body.push(lines[i].replace(/^>\s?/, ""));
      out.push({ t: "quote", kids: blocksOf(body.join("\n"), seen, leads, false) });
      continue;
    }
    if (LIST.test(l)) {
      const ordered = /^\d/.test(l), items: Block[][] = [];
      while (i < lines.length && LIST.test(lines[i]) && indentOf(lines[i]) === 0) {
        const first = lines[i].replace(LIST, ""), width = lines[i].length - lines[i].replace(LIST, "").length, body = [first];
        for (i++; i < lines.length; i++) {
          const x = lines[i];
          if (x.trim() && indentOf(x) === 0) break;
          if (!x.trim()) { const next = lines.slice(i + 1).find(y => y.trim()); if (!next || indentOf(next) === 0) break; }
          body.push(x.slice(Math.min(width, indentOf(x))));
        }
        items.push(blocksOf(body.join("\n"), seen, leads, false));
      }
      out.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    // a paragraph: up to a blank line or the start of another block
    const body = [l.trim()];
    for (i++; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|`{3}|>|\|)/.test(lines[i].trim()) && !LIST.test(lines[i]); i++) body.push(lines[i].trim());
    const kids = inline(body.join(" ")), first = kids[0];
    const lead = top && first?.t === "b" && plain(first.kids).length <= 60 ? plain(first.kids).replace(/[.:]$/, "") : undefined;
    out.push({ t: "p", kids, ...(lead ? { lead: { id: anchor(lead, leads), text: lead } } : {}) });
  }
  return out;
}

/** The contents: the headings (below the title) and the leads, in order, each with its depth. */
export function contents(blocks: Block[]): { id: string; text: string; depth: number }[] {
  const out: { id: string; text: string; depth: number }[] = [];
  let level = 2;
  for (const b of blocks) {
    if (b.t === "h" && b.level > 1) { out.push({ id: b.id, text: b.text, depth: b.level - 2 }); level = b.level; }
    else if (b.t === "p" && b.lead) out.push({ id: b.lead.id, text: b.lead.text, depth: level - 1 });
  }
  return out;
}

/** Where a link goes: a guide the editor shows (its page, at the anchor), a web address as it is, or the file on GitHub. */
export function linkOf(href: string, from: string, guides: { id: string; path: string }[], repo = "https://github.com/mehrad77/sahne/blob/main/"): string {
  if (/^[a-z]+:/i.test(href)) return href;
  if (href.startsWith("#")) { const g = guides.find(x => x.path === from); return g ? `#/docs/${g.id}/${href.slice(1)}` : href; }
  const [file, hash] = href.split("#");
  const parts = from.split("/").slice(0, -1);
  for (const p of file.split("/")) { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); }
  const path = parts.join("/"), g = guides.find(x => x.path === path);
  if (g) return `#/docs/${g.id}${hash ? `/${hash}` : ""}`;
  return `${repo}${path}${hash ? `#${hash}` : ""}`;
}

/** The blocks under an anchor: from its heading (or lead) to the next one at its depth or above. */
export function sectionOf(blocks: Block[], id: string): Block[] {
  const at = blocks.findIndex(b => (b.t === "h" && b.id === id) || (b.t === "p" && b.lead?.id === id));
  if (at < 0) return [];
  const head = blocks[at], level = head.t === "h" ? head.level : 99;
  const out = [head];
  for (const b of blocks.slice(at + 1)) {
    if (b.t === "h" && b.level <= (head.t === "h" ? level : 6)) break;
    if (head.t === "p" && b.t === "p" && b.lead) break;
    out.push(b);
  }
  return out;
}

/** The words of blocks, for search. */
export function textOf(blocks: Block[]): string {
  return blocks.map(b => b.t === "h" ? b.text : b.t === "p" ? plain(b.kids) : b.t === "code" ? b.text : b.t === "table" ? [...b.head, ...b.rows.flat()].map(plain).join(" ") : b.t === "quote" ? textOf(b.kids) : b.items.map(textOf).join(" ")).join(" ");
}
