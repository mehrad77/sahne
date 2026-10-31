// The content root in the new language shape (src/upgrade.ts): every story, character, series and season document
// rewritten with its suffixed texts as maps by language (`title` + `titleEn` + `titleFa` → `title: { tr, en, fa }`),
// keeping everything else as written: each number's spelling, the key order, the final newline (json.ts). A document
// already in the new shape is left alone, so a second run changes nothing.
//
//   node packages/sahne-story/convert/languages.ts            rewrite $SAHNE_CONTENT (or the samples)
//   node packages/sahne-story/convert/languages.ts --check    exits 1 if any file is still in the old shape

import { existsSync, readdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { format, readFile, writeAtomic } from "../json.ts";
import { CHARACTERS, SERIES, repoPath, seasonFile, seasonIds, storyFile, storyIds } from "../paths.ts";
import { upgrade, type UpgradeKind } from "../src/upgrade.ts";

const { values: o } = parseArgs({ options: { check: { type: "boolean", default: false } } });

const files: [UpgradeKind, URL][] = [
  ...(existsSync(SERIES) ? [["series", SERIES] as [UpgradeKind, URL]] : []),
  ...seasonIds().map(id => ["season", seasonFile(id)] as [UpgradeKind, URL]),
  ...storyIds().map(id => ["story", storyFile(id)] as [UpgradeKind, URL]),
  ...(existsSync(CHARACTERS) ? readdirSync(CHARACTERS).filter(f => f.endsWith(".json")).sort().map(f => ["character", new URL(f, CHARACTERS)] as [UpgradeKind, URL]) : []),
];

const old: string[] = [];
for (const [kind, u] of files) {
  const f = readFile(u);
  const next = upgrade(kind, f.doc);
  if (next === f.doc) continue;
  old.push(repoPath(u));
  // read with each number as it was spelled, and upgraded in place: the key order and the numbers stay
  if (!o.check) writeAtomic(u, format(next, f.newline));
}

if (o.check) {
  if (old.length) {
    console.error(`${old.length} files are in the old language shape:\n${old.map(f => `  ${f}`).join("\n")}\nrun: node packages/sahne-story/convert/languages.ts`);
    process.exit(1);
  }
  console.log(`languages: ${files.length} files, all in the new shape`);
} else console.log(old.length ? `converted ${old.length} of ${files.length} files` : `languages: ${files.length} files, all in the new shape already`);
