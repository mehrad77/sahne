// The guides as the Docs page reads them (src/model/markdown.ts): blocks, the words in them, anchors as GitHub makes
// them, the leads the READMEs name their parts with, a part of a guide, and where a link goes. On a small document,
// and on the repo's own two guides.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contents, inline, linkOf, parse, plain, sectionOf, slug } from "../src/model/markdown.ts";

const MD = `# Title

Some **bold**, *soft*, \`a*b*c\` and [a link](../sahne-story/README.md#languages).

## A part (\`x.ts\`)

**The board** (\`board.ts\`): what it does.
- one
  - nested, with a table:

    | Key | What |
    |---|---|
    | Enter | a new \\| line |
- two

\`\`\`bash
node cli.ts
\`\`\`

**The episode studio**: the script.

## A part (\`x.ts\`)
`;

test("words: code first, then links, bold and emphasis", () => {
  assert.deepEqual(inline("a `b*c*` **d** *e* [f](g)"), [
    { t: "text", text: "a " }, { t: "code", text: "b*c*" }, { t: "text", text: " " }, { t: "b", kids: [{ t: "text", text: "d" }] }, { t: "text", text: " " },
    { t: "i", kids: [{ t: "text", text: "e" }] }, { t: "text", text: " " }, { t: "a", href: "g", kids: [{ t: "text", text: "f" }] },
  ]);
  assert.equal(plain(inline("snake_case_name stays")), "snake_case_name stays");
});

test("blocks: headings with GitHub's anchors, leads, nested lists with tables, code", () => {
  const b = parse(MD);
  assert.deepEqual(b.map(x => x.t), ["h", "p", "h", "p", "ul", "code", "p", "h"]);
  assert.equal(slug("How saving works (`server/content.ts`)"), "how-saving-works-servercontentts");
  assert.deepEqual(contents(b), [
    { id: "a-part-xts", text: "A part (x.ts)", depth: 0 }, { id: "the-board", text: "The board", depth: 1 },
    { id: "the-episode-studio", text: "The episode studio", depth: 1 }, { id: "a-part-xts-1", text: "A part (x.ts)", depth: 0 },
  ]);
  const list = b[4] as Extract<ReturnType<typeof parse>[number], { t: "ul" }>;
  assert.equal(list.items.length, 2);
  const inner = list.items[0][1] as typeof list;
  assert.equal(inner.t, "ul");
  const table = inner.items[0].find(x => x.t === "table");
  assert.ok(table && table.t === "table" && plain(table.rows[0][1]) === "a new | line", "a table in a nested item, with an escaped bar");
  assert.deepEqual(b[5], { t: "code", lang: "bash", text: "node cli.ts" });
});

test("a part: from its heading or lead to the next of its rank", () => {
  const b = parse(MD);
  assert.deepEqual(sectionOf(b, "the-board").map(x => x.t), ["p", "ul", "code"]);
  assert.deepEqual(sectionOf(b, "a-part-xts").map(x => x.t), ["h", "p", "ul", "code", "p"]);
  assert.deepEqual(sectionOf(b, "nothing"), []);
});

test("links: to a guide's page, to a web address, or to the file on GitHub", () => {
  const guides = [{ id: "backstage", path: "packages/sahne-backstage/README.md" }, { id: "format", path: "packages/sahne-story/README.md" }];
  const from = guides[0].path;
  assert.equal(linkOf("../sahne-story/README.md#languages", from, guides), "#/docs/format/languages");
  assert.equal(linkOf("#the-studio", from, guides), "#/docs/backstage/the-studio");
  assert.equal(linkOf("../sahne/DESIGN.md", from, guides), "https://github.com/mehrad77/sahne/blob/main/packages/sahne/DESIGN.md");
  assert.equal(linkOf("https://sahne.shab.boo", from, guides), "https://sahne.shab.boo");
});

test("the repo's guides: every part the side panel opens is there", () => {
  const b = parse(readFileSync(new URL("../README.md", import.meta.url), "utf8"));
  for (const id of ["the-board", "the-episode-studio", "a-new-episode", "a-characters-page", "a-places-page", "the-kit-as-galleries", "the-pages", "the-studio",
    "review-notes-serverreviewts", "mcp-server-and-agent-edits-servermcpts-serverproposalsts-servereventsts", "the-assistant-providers-and-the-budget-serverassistantts-serverai-serversettingsts"])
    assert.ok(sectionOf(b, id).length, `backstage's README has ${id}`);
  const f = parse(readFileSync(new URL("../../sahne-story/README.md", import.meta.url), "utf8"));
  assert.ok(sectionOf(f, "languages").length && sectionOf(f, "series-seasons-episodes").length);
});
