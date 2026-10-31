// Promotion (drawing/promote.ts, DRAWING.md *Promoting*): a story's drawing becomes official art with its credit. The official
// checks refuse what the kit must not take; promote.ts, run on a throwaway copy of the packages, moves the doc, writes the alias, the
// credits and the generated files, and --check tells fresh from stale; a story that still names its x_ id stages through the alias;
// --pr works with `gh` stubbed (no GitHub is ever reached). Never touches this checkout's src/.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { drawPieces, pieceOf, placeSolids } from "sahne";
import full from "../src/full.ts";
import { officialProblems, type OfficialContext } from "../src/check.ts";
import type { DrawingDoc } from "../src/drawing.ts";
import { FAMILIES } from "../src/set/index.ts";
import { PROP_SHELVES, SET_SHELVES } from "../../sahne-backstage/src/model/kitgroups.ts";
import { check as promoteCheck, coAuthorEmail, creditOf, prText } from "../drawing/promote.ts";

const REPO = resolve(import.meta.dirname, "../../..");

/** A good drawing under its content id: a small prop. */
const cookie = (): DrawingDoc => ({
  id: "x_butter_cookie", as: "prop", about: "A butter cookie with a sugar rim, on its own.", tags: ["food", "bakery", "pastry"], terms: [],
  params: { color: { type: "color", default: "#D9A860", about: "the biscuit" } },
  kinds: { main: { size: [8, 2], ppcm: 14, grip: [0, -1], flats: [{ shapes: [
    { d: "M-4 -1C-4 -2 -2 -2.4 0 -2.4C2 -2.4 4 -2 4 -1C4 -0.4 3 0 2 0H-2C-3 0 -4 -0.4 -4 -1Z", fill: "$color" },
    { d: "M-3 -1.6C-1.4 -2 1.4 -2 3 -1.6", stroke: { color: { tone: "$color", step: "light" }, width: 0.3 }, flat: true, opacity: 0.8 },
  ] }] } },
  repeat: { gap: 2 },
});
const promoted = (o: Partial<DrawingDoc> = {}): DrawingDoc => ({ ...cookie(), id: "butter_cookie", credit: creditOf({ by: "Ada L.", contact: "github:ada", date: "2026-10-30" }, "x_butter_cookie"), ...o });

const ctx = (o: Partial<OfficialContext> = {}): OfficialContext => ({
  kit: full, family: "bakery", families: Object.keys(FAMILIES), wired: true,
  shelfTags: { props: new Set(PROP_SHELVES.flatMap(s => s.tags ?? [])), set: new Set(SET_SHELVES.flatMap(s => s.tags ?? [])) }, ...o,
});
const errs = (d: DrawingDoc, c = ctx()) => officialProblems(d, c).filter(p => p.level === "error").map(p => p.msg);
const says = (d: DrawingDoc, re: RegExp, c = ctx()) => assert.ok(errs(d, c).some(m => re.test(m)), `${re}: ${JSON.stringify(officialProblems(d, c).map(p => p.msg))}`);

// ---- the official checks ---------------------------------------------------------------------------------------------------

test("a good drawing passes the official checks, and each refusal names what is wrong", () => {
  assert.deepEqual(errs(promoted()), []);
  says(promoted({ id: "x_butter_cookie" }), /never starts with x_|never x_/);
  says(promoted({ id: "Butter-Cookie" }), /snake_case/);
  says(promoted({ id: "pastry" }), /taken/);
  says(promoted({ id: "door_shop" }), /taken/);
  says(promoted({ id: "butter_cookie" }), /past alias/, ctx({ kit: { ...full, aliases: { ...full.aliases, x_gone: "butter_cookie" } } }));
  says(promoted({ id: "gone" }), /past alias/, ctx({ kit: { ...full, aliases: { ...full.aliases, gone: "door_shop" } } }));
  says(promoted(), /does not exist/, ctx({ family: "nonesuch" }));
  says(promoted(), /does not take drawn items yet/, ctx({ wired: false }));
  says(promoted(), /over its 40 KB budget/, ctx({ size: { gzip: 41 * 1024, budget: 40 * 1024 } }));
  assert.deepEqual(errs(promoted(), ctx({ size: { gzip: 39 * 1024, budget: 40 * 1024 } })), []);
  says(promoted({ tags: ["food", "zebra"] }), /"zebra" is on no shelf/);
  says(promoted({ tags: [] }), /tags: at least one/);
  says(promoted({ about: "a cookie" }), /about: say what it draws in a sentence/);
  says(promoted({ about: "A cookie with no full stop at the end" }), /about: say what it draws in a sentence/);
  says(promoted({ credit: undefined }), /credit: who drew it/);
});

test("the credit must be whole, with consent; an old id already answered is refused", () => {
  const c = (o: object) => promoted({ credit: { ...promoted().credit!, ...o } as never });
  says(c({ consent: false }), /consent/);
  says(c({ consent: undefined }), /consent/);
  says(c({ by: "  " }), /credit\.by/);
  says(c({ contact: "" }), /credit\.contact/);
  says(c({ licence: "MIT" }), /credit\.licence/);
  says(c({ date: "yesterday" }), /credit\.date/);
  says(c({ date: "2026-13-99" }), /credit\.date/);
  says(c({ date: "2999-01-01" }), /credit\.date/);
  says(c({ from: "butter_cookie" }), /credit\.from/);
  says(c({}), /already an alias/, ctx({ kit: { ...full, aliases: { ...full.aliases, x_butter_cookie: "pastry" } } }));
});

test("the credit's text is one plain line: no newline to forge a trailer or break a table, no ping, a real contact", () => {
  const c = (o: object) => promoted({ credit: { ...promoted().credit!, ...o } as never });
  says(c({ by: "Ada\nCo-Authored-By: Evil <e@x.org>" }), /credit\.by/);
  says(c({ by: "Ada <e@x.org>" }), /credit\.by/);
  says(c({ by: "@acme/team" }), /credit\.by/);
  says(c({ by: "x".repeat(81) }), /credit\.by/);
  says(c({ story: "s\n| x |" }), /credit\.story/);
  says(c({ contact: "https://example.org" }), /credit\.contact/);
  says(c({ contact: "github:ada\nx" }), /credit\.contact/);
  assert.deepEqual(errs(c({ contact: "ada@example.org", story: "kumru s2e04" })), []);
  assert.deepEqual(errs(c({ consent: "project", by: "Sahne kit (drawn by its agents)", contact: "github:mehrad77" })), []);
  says(c({ consent: "yes" }), /consent/);
  assert.doesNotMatch(prText(c({ by: "Ada", contact: "github:@ada" }), "bakery"), /@ada/, "an @name in the text is defused");
});

test("a set piece is drawn at 3 px/cm or less, text has a language, a stray colour and drawn words are warnings", () => {
  const set = (ppcm: number) => { const d = promoted({ as: "set", tags: ["wall"] }); d.kinds.main.ppcm = ppcm; return d; };
  assert.deepEqual(errs(set(2)), []);
  says(set(5), /ppcm 5: a set piece is drawn at 3 px\/cm or less/);
  // a set piece's tags are a set shelf's, a prop's a prop shelf's
  says(promoted({ as: "set" }), /on no shelf/);
  const words = promoted({ tags: ["food", "cafe"], params: undefined });
  words.kinds.main.flats[0].text = [{ text: "Menu", x: -3, y: -2, w: 6, h: 1.5, lang: "" }];
  says(words, /no lang/);
  assert.ok(officialProblems(promoted(), ctx()).some(p => p.level === "warn" && /outside the kit's/.test(p.msg)), "#D9A860 is not a kit colour");
  const letters = promoted();
  letters.kinds.main.flats[0].shapes.push(...Array.from({ length: 6 }, (_, i) => ({ d: `M${-3 + i * 1.1} 0V-1.2H${-2.4 + i * 1.1}V0Z`, fill: "#222222" })));
  assert.ok(officialProblems(letters, ctx()).some(p => p.level === "warn" && /words drawn as shapes/.test(p.msg)));
  assert.ok(!officialProblems(promoted(), ctx()).some(p => /words drawn as shapes/.test(p.msg)));
  const dup = promoted();
  assert.ok(errs({ ...dup, kinds: {} }).length, "no kinds");
});

// ---- ids follow aliases ---------------------------------------------------------------------------------------------------

test("a kit id after the kit's aliases: the engine's lookup, the stage's drawing and the route's solids follow it, the kit's own entry first", () => {
  const kit = { ...full, aliases: { ...full.aliases, x_old_door: "door_shop", x_old_pastry: "pastry", x_loop_a: "x_loop_b", x_loop_b: "x_loop_c", x_loop_c: "x_loop_d", x_loop_d: "x_loop_e", x_loop_e: "door_shop" } };
  assert.equal(pieceOf(kit, "set", "x_old_door"), full.set.door_shop);
  assert.equal(pieceOf(kit, "props", "x_old_pastry"), full.props.pastry);
  assert.equal(pieceOf(kit, "props", "x_old_door"), undefined, "the alias leads to door_shop, which is no prop");
  assert.equal(pieceOf(kit, "set", "x_nothing"), undefined);
  assert.equal(pieceOf(kit, "set", "x_loop_a"), undefined, "a few hops at most");
  const own = { ...kit, set: { ...kit.set, x_old_door: full.set.desk } };
  assert.equal(pieceOf(own, "set", "x_old_door"), full.set.desk, "a content drawing is used while it is there");
  const place = { id: "t", pieces: [{ kit: "x_old_door", x: 0, z: -1 }] };
  assert.equal(drawPieces(place, kit).length, 1);
  assert.equal(drawPieces(place, full).length, 0, "without the alias the piece is skipped, as before");
  assert.deepEqual(placeSolids({ ...place, size: { w: 4, d: 3 } } as never, kit), placeSolids({ ...place, pieces: [{ kit: "door_shop", x: 0, z: -1 }], size: { w: 4, d: 3 } } as never, kit));
});

test("the pull request text carries the sheet note, the credit with consent and the reviewer's checklist", () => {
  const t = prText(promoted(), "bakery");
  for (const re of [/### The sheet/, /### What it is/, /### Where it was used/, /### Credit and consent/, /\[x\] The author releases/, /### Reviewer's checklist/, /x_butter_cookie/, /Ada L\./, /words are `text`/i]) assert.match(t, re);
  assert.equal(coAuthorEmail("github:ada"), "ada@users.noreply.github.com");
  assert.equal(coAuthorEmail("github:ada", "123"), "123+ada@users.noreply.github.com");
  assert.equal(coAuthorEmail("ada@example.org"), "ada@example.org");
  assert.equal(coAuthorEmail("a phone number"), "noreply@sahne.invalid");
});

test("what promote.ts generates is current (node packages/sahne-kit/drawing/promote.ts --regenerate)", () => assert.deepEqual(promoteCheck(), []));

// ---- promote.ts on a copy ------------------------------------------------------------------------------------------------

/** A throwaway copy of the packages (modules linked), so promote.ts changes the copy and never this checkout. */
function copyRepo(): string {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "sahne-promote-test-"));
  cpSync(join(REPO, "packages"), join(dir, "packages"), { recursive: true, verbatimSymlinks: true, filter: s => !/sahne-gallery\/golden|promote-out|\/\.cache/.test(s) });
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"));
  return dir;
}
const git = (cwd: string, ...args: string[]) => spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.org" } });
const write = (path: string, doc: unknown) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, JSON.stringify(doc, null, 2)); return path; };
const promoteArgs = (src: string, o: string[] = []) => [src, "--id", "butter_cookie", "--family", "bakery", "--by", "Ada L.", "--contact", "github:ada", "--date", "2026-10-30", ...o];
const runIn = (root: string, cwd: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [join(root, "packages/sahne-kit/drawing/promote.ts"), ...args], { cwd, encoding: "utf8", env: { ...process.env, ...env } });

test("promote.ts moves the drawing in, adds the alias and the credit, and --check says fresh then stale", () => {
  const root = copyRepo(), src = write(join(root, "story/kit/pieces/x_butter_cookie.json"), cookie());
  git(root, "init", "-q");
  const r = runIn(root, root, promoteArgs(src, ["--consent", "--out", join(root, "out")]));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^image: .*butter_cookie\.png/m);
  const doc = JSON.parse(readFileSync(join(root, "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json"), "utf8"));
  assert.equal(doc.id, "butter_cookie");
  assert.deepEqual(doc.credit, { by: "Ada L.", contact: "github:ada", date: "2026-10-30", licence: "CC-BY-4.0", consent: true, from: "x_butter_cookie" });
  assert.deepEqual({ ...doc, id: "x_butter_cookie", credit: undefined }, { ...cookie(), credit: undefined }, "the drawing itself is unchanged");
  const gen = readFileSync(join(root, "packages/sahne-kit/src/set/drawn/bakery.gen.ts"), "utf8");
  assert.match(gen, /"id":"butter_cookie"/);
  assert.doesNotMatch(gen, /credit|Ada/, "the credit is not shipped in the family's chunk");
  assert.match(readFileSync(join(root, "packages/sahne-kit/src/set/drawn/aliases.gen.ts"), "utf8"), /x_butter_cookie: "butter_cookie"/);
  const credits = JSON.parse(readFileSync(join(root, "packages/sahne-kit/src/set/drawn/CREDITS.json"), "utf8"));
  assert.deepEqual(credits.filter((c: { id: string }) => c.id === "butter_cookie").map((c: { id: string; family: string; kind: string; by: string }) => [c.id, c.family, c.kind, c.by]), [["butter_cookie", "bakery", "prop", "Ada L."]]);
  assert.equal(credits.length, readdirSync(join(root, "packages/sahne-kit/src/set/drawn/bakery")).length, "a credit for every drawing in the folder");
  assert.match(readFileSync(join(root, "packages/sahne-kit/SET.md"), "utf8"), /## Credits[\s\S]*\| `butter_cookie` \| bakery \| Ada L\. \| github:ada \| – \| 2026-10-30 \| `x_butter_cookie` \|/);
  assert.match(readFileSync(join(root, "packages/sahne-kit/SET.md"), "utf8"), /\| `butter_cookie` \| prop \| A butter cookie/);
  assert.match(readFileSync(join(root, "packages/sahne-kit/src/set/families.gen.ts"), "utf8"), /butter_cookie: "bakery"/);
  assert.ok(existsSync(join(root, "out/butter_cookie-neighbours.png")) && existsSync(join(root, "out/butter_cookie.pr.md")));
  assert.equal(runIn(root, root, ["--check"]).status, 0, "fresh");
  // CI draws the sheets of the items a pull request changed, by id
  const sheets = runIn(root, root, ["--sheet", "butter_cookie", "--out", join(root, "ci")]);
  assert.equal(sheets.status, 0, sheets.stdout + sheets.stderr);
  assert.ok(existsSync(join(root, "ci/butter_cookie.png")) && existsSync(join(root, "ci/butter_cookie-neighbours.png")));
  assert.equal(runIn(root, root, ["--sheet", "nonesuch"]).status, 1);

  // a story that still names its x_ id stages through the alias: the family loads, the place lints, the piece draws
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import full from "./packages/sahne-kit/src/full.ts";
    import { familiesOf, loadSet, withSet } from "./packages/sahne-kit/src/set/index.ts";
    import { pieceOf, rng, withVariant } from "./packages/sahne/src/index.ts";
    const place = { props: { cookie: { kit: "x_butter_cookie" } } };
    const loaded = await loadSet(familiesOf([place]).concat([]));
    const kit = withSet((await import("./packages/sahne-kit/src/index.ts")).default, loaded);
    const def = pieceOf(kit, "props", "x_butter_cookie");
    console.log(JSON.stringify({ families: familiesOf([place]), same: def === kit.props.butter_cookie, flats: def.draw(withVariant(def, { n: 2 }), rng("a"), kit).flats.length, full: pieceOf(full, "props", "x_butter_cookie") === full.props.butter_cookie }));
  `], { cwd: root, encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout), { families: ["bakery"], same: true, flats: 1, full: true });

  // a hand edit of a generated file is stale until it is regenerated
  const credits2 = join(root, "packages/sahne-kit/src/set/drawn/CREDITS.json");
  writeFileSync(credits2, "[]\n");
  const stale = runIn(root, root, ["--check"]);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /CREDITS\.json is stale/);
  assert.equal(runIn(root, root, ["--regenerate"]).status, 0);
  assert.equal(runIn(root, root, ["--check"]).status, 0);

  // the folder holds a doc the family does not take, or one without consent: the check says so
  const bad = JSON.parse(readFileSync(join(root, "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json"), "utf8"));
  bad.credit.consent = false;
  writeFileSync(join(root, "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json"), JSON.stringify(bad));
  assert.match(runIn(root, root, ["--check"]).stderr, /credit\.consent/);
});

test("promote.ts refuses, and writes nothing: no consent, a taken id, an x_ id, an unshelved tag, a family that cannot take it, over budget", () => {
  const root = copyRepo(), src = write(join(root, "story/kit/pieces/x_butter_cookie.json"), cookie());
  git(root, "init", "-q");
  const run = (args: string[], doc?: object) => runIn(root, root, [doc ? write(join(root, "story/kit/pieces/x_other.json"), doc) : src, ...args.slice(0)], {});
  const base = (o: string[] = []) => ["--id", "butter_cookie", "--family", "bakery", "--by", "Ada L.", "--contact", "github:ada", "--out", join(root, "out"), ...o];
  const no = (r: ReturnType<typeof run>, re: RegExp) => { assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout, re); };
  no(run(base()), /needs the author's consent/);
  no(run(base(["--consent"]).map(a => (a === "butter_cookie" ? "pastry" : a))), /taken/);
  no(run(base(["--consent"]).map(a => (a === "butter_cookie" ? "x_butter_cookie" : a))), /never starts with x_|never x_/);
  no(run(base(["--consent"]), { ...cookie(), id: "x_other", tags: ["food", "zebra"] }), /"zebra" is on no shelf/);
  no(run(base(["--consent"]).map(a => (a === "bakery" ? "food" : a))), /does not take drawn items yet/);
  no(run(base(["--consent"]).map(a => (a === "bakery" ? "nonesuch" : a))), /does not exist/);
  no(run(base(["--consent"]), { ...cookie(), id: "x_other", about: "cookie" }), /about: say what it draws in a sentence/);
  no(run(["--id", "butter_cookie", "--family", "bakery", "--consent", "--out", join(root, "out")]), /--by/);
  // free text that would forge a trailer, break a table or ping a team is refused before anything is written
  no(run(base(["--consent"]).map(a => (a === "Ada L." ? "Ada\nCo-Authored-By: Evil <e@x.org>" : a))), /credit\.by/);
  no(run(base(["--consent", "--story", "s\n| x |"])), /credit\.story/);
  no(run(base(["--consent"]).map(a => (a === "github:ada" ? "not a contact" : a))), /credit\.contact/);
  no(run(base(["--consent", "--date", "2026-13-99"])), /credit\.date/);
  no(run(base(["--project", "--pr"])), /never offered by pull request/);
  // over budget: the copy's budget is made a kilobyte
  const size = join(root, "packages/sahne-gallery/size.mjs");
  writeFileSync(size, readFileSync(size, "utf8").replace("shared: true, budget: 40 }", "shared: true, budget: 1 }"));
  no(run(base(["--consent"])), /over its 1 KB budget/);
  assert.ok(!existsSync(join(root, "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json")), "nothing was written");
  // --dry draws the sheet and says it would accept it, and writes nothing
  writeFileSync(size, readFileSync(size, "utf8").replace("shared: true, budget: 1 }", "shared: true, budget: 40 }"));
  const dry = run(base(["--consent", "--dry"]));
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /would be accepted into bakery/);
  assert.ok(!existsSync(join(root, "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json")));
});

// ---- --pr, with gh stubbed -----------------------------------------------------------------------------------------------

/** A fake `gh` that logs its arguments and answers as a signed-in user who can (or cannot) write to the repository. */
function stubGh(dir: string): { bin: string; log: string } {
  const bin = join(dir, "bin"), log = join(dir, "gh.log");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "gh"), `#!/bin/sh
echo "$@" >> "${log}"
[ -n "$GH_MISSING" ] && exit 1
case "$1 $2" in
  "--version "*) echo "gh version 0.0.0 (stub)";;
  "api user") echo tester;;
  "api repos/mehrad77/sahne") echo "\${GH_PUSH:-true}";;
  "repo fork") ;;
  "pr create") echo "https://github.com/mehrad77/sahne/pull/42";;
  *) echo "stub: unexpected $*" >&2; exit 2;;
esac
`);
  chmodSync(join(bin, "gh"), 0o755);
  return { bin, log };
}

/** A fake repository: the copy committed, and a bare `origin` it was cloned from. */
function fakeOrigin(): { root: string; origin: string } {
  const root = copyRepo();
  git(root, "init", "-q", "-b", "main");
  writeFileSync(join(root, ".gitignore"), "node_modules\n");
  git(root, "add", "-A"); git(root, "commit", "-q", "-m", "base");
  const origin = join(mkdtempSync(join(realpathSync(tmpdir()), "sahne-origin-")), "origin.git");
  assert.equal(git(root, "clone", "-q", "--bare", ".", origin).status, 0);
  return { root, origin };
}
const prRun = (root: string, origin: string, env: Record<string, string>, extra: string[] = []) => {
  const outside = mkdtempSync(join(realpathSync(tmpdir()), "sahne-app-")), src = write(join(outside, "kit/pieces/x_butter_cookie.json"), cookie());
  const gh = stubGh(outside);
  const r = runIn(root, outside, promoteArgs(src, ["--consent", "--pr", ...extra]), { PATH: `${gh.bin}:${process.env.PATH}`, SAHNE_REPO_URL: `file://${origin}`, GIT_AUTHOR_NAME: "T", GIT_AUTHOR_EMAIL: "t@example.org", GIT_COMMITTER_NAME: "T", GIT_COMMITTER_EMAIL: "t@example.org", ...env });
  return { r, outside, log: existsSync(gh.log) ? readFileSync(gh.log, "utf8") : "" };
};

test("--pr from an app's folder works in a clone: a branch art/<id>, a commit crediting the author, a push, a pull request", () => {
  const { root, origin } = fakeOrigin();
  const { r, outside, log } = prRun(root, origin, { GH_PUSH: "true" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Opened https:\/\/github\.com\/mehrad77\/sahne\/pull\/42 \(branch art\/butter_cookie\)/);
  assert.match(log, /pr create --repo mehrad77\/sahne --base main --head art\/butter_cookie --title feat\(kit\): butter_cookie, drawn by Ada L\. --body-file .*butter_cookie\.pr\.md/);
  assert.doesNotMatch(log, /repo fork/, "the author can write: no fork");
  const msg = git(origin, "log", "-1", "--format=%B", "art/butter_cookie").stdout;
  assert.match(msg, /^feat\(kit\): butter_cookie, drawn by Ada L\./);
  assert.match(msg, /Co-Authored-By: Ada L\. <ada@users\.noreply\.github\.com>/);
  const files = git(origin, "show", "--name-only", "--format=", "art/butter_cookie").stdout.trim().split("\n").sort();
  assert.deepEqual(files, ["packages/sahne-kit/SET.md", "packages/sahne-kit/src/set/drawn/CREDITS.json", "packages/sahne-kit/src/set/drawn/aliases.gen.ts", "packages/sahne-kit/src/set/drawn/bakery.gen.ts", "packages/sahne-kit/src/set/drawn/bakery/butter_cookie.json", "packages/sahne-kit/src/set/families.gen.ts"], "only the promotion's own files: nothing else was added");
  assert.ok(existsSync(join(outside, "promote-out/butter_cookie.pr.md")) && existsSync(join(outside, "promote-out/butter_cookie.png")) && existsSync(join(outside, "promote-out/butter_cookie.patch")));
  assert.equal(git(root, "status", "--porcelain").stdout, "", "the checkout it was run from is untouched");
});

test("--pr without write access forks and pushes there; without gh it leaves a patch and the text, and says what to do", () => {
  const { root, origin } = fakeOrigin();
  const fork = join(mkdtempSync(join(realpathSync(tmpdir()), "sahne-fork-")), "fork.git");
  assert.equal(git(root, "clone", "-q", "--bare", ".", fork).status, 0);
  const a = prRun(root, origin, { GH_PUSH: "false", SAHNE_FORK_URL: `file://${fork}` });
  assert.equal(a.r.status, 0, a.r.stdout + a.r.stderr);
  assert.match(a.log, /repo fork mehrad77\/sahne --clone=false/);
  assert.match(a.log, /--head tester:art\/butter_cookie/);
  assert.match(git(fork, "log", "-1", "--format=%s", "art/butter_cookie").stdout, /^feat\(kit\): butter_cookie, drawn by Ada L\./);
  assert.equal(git(origin, "branch", "--list", "art/*").stdout.trim(), "", "nothing was pushed to the repository itself");

  const b = prRun(root, origin, { GH_MISSING: "1" });
  assert.equal(b.r.status, 0, b.r.stdout + b.r.stderr);
  assert.match(b.r.stdout, /gh is not installed: the patch is .*butter_cookie\.patch and the pull request text/);
  assert.match(b.r.stdout, /git apply butter_cookie\.patch/);
  assert.match(readFileSync(join(b.outside, "promote-out/butter_cookie.patch"), "utf8"), /^diff --git a\/packages\/sahne-kit\/src\/set\/drawn\/CREDITS\.json/m);
  assert.doesNotMatch(b.log, /pr create/);
});

test("from an app's folder without --pr, the change is a patch of the clone, and the checkout is untouched", () => {
  const { root, origin } = fakeOrigin();
  const outside = mkdtempSync(join(realpathSync(tmpdir()), "sahne-app-")), src = write(join(outside, "kit/pieces/x_butter_cookie.json"), cookie());
  const r = runIn(root, outside, promoteArgs(src, ["--consent"]), { SAHNE_REPO_URL: `file://${origin}` });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /is ready as a patch: .*butter_cookie\.patch/);
  assert.match(readFileSync(join(outside, "promote-out/butter_cookie.patch"), "utf8"), /bakery\/butter_cookie\.json/);
  assert.equal(git(root, "status", "--porcelain").stdout, "");
});
