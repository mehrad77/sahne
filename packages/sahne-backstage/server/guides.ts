// The guides (Node only): the READMEs the editor shows (#/docs) and agents read (`read_guide`), by id, each with its path
// in the repo for its links. A guide is read whole, or one section of it: the heading that names it and what follows, up
// to the next heading as high.

import { readFileSync } from "node:fs";

const HERE = new URL("../", import.meta.url);
export const DOCS: Record<string, { title: string; file: URL; path: string }> = {
  backstage: { title: "Backstage", file: new URL("README.md", HERE), path: "packages/sahne-backstage/README.md" },
  format: { title: "The story format", file: new URL("../sahne-story/README.md", HERE), path: "packages/sahne-story/README.md" },
};

/** A guide's headings, as a table of contents. */
export const headingsOf = (md: string) => md.split("\n").filter(l => /^#{1,4}\s/.test(l)).map(l => l.replace(/\s+#*$/, ""));

/** One section of a guide: the first heading whose words hold `section` (any case), with what follows it; null for none. */
export function sectionOf(md: string, section: string): string | null {
  const lines = md.split("\n"), want = section.toLowerCase().trim();
  const at = lines.findIndex(l => /^#{1,6}\s/.test(l) && l.toLowerCase().includes(want));
  if (at < 0) return null;
  const level = /^(#+)/.exec(lines[at])![1].length;
  const end = lines.findIndex((l, i) => i > at && /^(#+)\s/.test(l) && /^(#+)/.exec(l)![1].length <= level);
  return lines.slice(at, end < 0 ? undefined : end).join("\n");
}

export const guideText = (id: string) => readFileSync(DOCS[id].file, "utf8");
