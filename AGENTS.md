# AGENTS.md — Sahne

Sahne is a paper-theatre stage engine and its kits ([README.md](README.md)). This file holds the rules every change follows, for agents and people alike. It describes what is. Ideas and plans go in issues.

## Layout

```text
packages/
  sahne/          the engine                                    → packages/sahne/README.md, DESIGN.md
  sahne-kit/      the first kit: people, set pieces, props, sounds, music, Kerim → STYLE.md, CATALOGUE.md, SET.md
  sahne-tr/       the Turkish plugin                            → packages/sahne-tr/README.md
  sahne-en/       the English plugin                            → packages/sahne-en/README.md
  sahne-de/       the German plugin                             → packages/sahne-de/README.md
  sahne-story/    the story format, its checks, paths.ts, samples/ → packages/sahne-story/README.md
  sahne-backstage/ the studio an app runs on its content root (:5181), and its MCP server → packages/sahne-backstage/README.md
  sahne-gallery/  the dev gallery and the checks (:5180)        → packages/sahne-gallery/README.md
.github/workflows/ci.yml       pnpm sahne check on every push and pull request, and the scan
.github/workflows/deploy.yml   the gallery as the live demo, https://sahne.shab.boo (Cloudflare), deployed after ci passes on main; off until DEPLOY_ENABLED is set
.github/workflows/release.yml  a GitHub release and npm publishing on a v* tag; off until RELEASE_ENABLED / PUBLISH_ENABLED are set
assets/                        the README's poster and scene pictures (assets/README.md says how they were made)
.claude/skills/                visual-check, new-kit-part, new-place: the repo's own workflows for agents
```

## Before you work on X, read Y

| Working on | Read first |
|---|---|
| The engine | [packages/sahne/README.md](packages/sahne/README.md) and [DESIGN.md](packages/sahne/DESIGN.md) |
| Kit art (people, set, props) | [STYLE.md](packages/sahne-kit/STYLE.md), [CATALOGUE.md](packages/sahne-kit/CATALOGUE.md), [SET.md](packages/sahne-kit/SET.md), `src/curation.ts` |
| Stories, places, the content root | [packages/sahne-story/README.md](packages/sahne-story/README.md) |
| The editor (backstage), its MCP server and assistant | [packages/sahne-backstage/README.md](packages/sahne-backstage/README.md), then the story README's Series and Languages sections |
| A series in another language, or a language's lints | [packages/sahne-story/README.md](packages/sahne-story/README.md) (Languages, the story language) |
| The gallery, screenshots, golden frames | [packages/sahne-gallery/README.md](packages/sahne-gallery/README.md) |
| Package conventions, Kerim | [packages/README.md](packages/README.md) |

## Workspace

- This is one pnpm workspace over `packages/*`. Run `pnpm install` once at the root.
- `pnpm check` (the same as `pnpm sahne check`, the gallery's `check` script) is the gate: types, sizes, bundle determinism, the story and extras checks, every package's Node tests and the golden frames. Run it after every change.
- `pnpm sahne <script>` runs a gallery script (`pnpm sahne dev`, `pnpm sahne golden:update`).
- Start the gallery with `preview_start sahne-gallery` (`.claude/launch.json`), or `pnpm dev`.
- Start the editor with `preview_start sahne-backstage` (the samples, read-only), or `node packages/sahne-backstage/server/cli.ts --content <root> --write`. Agents reach it over MCP: `/mcp` on a running one (`claude mcp add --transport http sahne-backstage http://localhost:5181/mcp`), or on stdio with `node packages/sahne-backstage/server/cli.ts mcp --content <root> --write --backstage http://localhost:5181/` (without `--backstage`, proposals reach no editor). With no MCP set up, `node packages/sahne-backstage/server/call.ts <tool> '<json>' --content <root> --session kit` calls any of the same tools and saves their pictures as PNGs to Read: TS kit work (a generator you are editing) also renders through it, `kit_render` with `items` for a whole family on one sheet.
- **The content root.** Every story, character and place is read through `packages/sahne-story/paths.ts`: from `$SAHNE_CONTENT` (an absolute folder) or, without it, from `packages/sahne-story/samples/`. Never build such a path yourself. Never point a path outside the repo: `packages/sahne-gallery/test/boundary.test.ts` fails on one.
- The tests in `packages/sahne-story/test/kumru/` check Kumru's own content. They run only with `SAHNE_CONTENT` set to Kumru's `data/`. On the samples they are skipped, which is expected.

## Shell and tools

- The shell is **zsh on macOS**. Quote globs (`rg -g '*.ts'`, `--include='*.ts'`). zsh does not word-split `$VAR`, so put file lists in arrays. After a `cd`, use absolute paths.
- `sed` is BSD: use `sed -i '' …`, and note it has no `\b`. Prefer `perl -pi -e` or a python3 replace.
- **Never `npx tsc`**: it installs an unrelated package. Type-check with `pnpm check`, or with `pnpm --dir packages/sahne-gallery exec tsc -p ../tsconfig.json`.
- Playwright is a dev dependency of `sahne-gallery`. Scripts import it as `@playwright/test`. After a fresh install, run `pnpm --dir packages/sahne-gallery exec playwright install chromium` once.
- Plain `python3` has no Pillow. For ad-hoc image scripts, use `uv run --with pillow python …`.

## Visual checks

- **Verify in the browser yourself.** Never ask a person to check by hand.
- **A hidden browser pane freezes animation and timers, and has no size.** Stage checks there look frozen, and screenshots come back empty. Reading text and running scripts still work.
- **For screenshots, use the headless script** while the gallery runs: `node packages/sahne-gallery/shots.mjs --out <dir> --mid` (add `--story <id>` and `--cues 0,5,13`). The GPU is on.
- **Look at mid-cue frames** (`--mid`, at 15, 40 and 70 % of a cue). Held props, gestures and flight go wrong while a cue plays, not at its end.
- Navigating the pane to the same URL, or to a new hash on it, does not reload the page. Use `location.reload()`.
- A change of look is a golden-frame change. Update the baselines on purpose (`pnpm sahne golden:update`, see the gallery README) and say so in the PR.

## Rules for every change

- **Every generator has `--check`.** Generated files have exactly one script that writes them, and a `--check` that fails when they are stale. That covers `CATALOGUE.md` (`catalogue/build.ts`), `SET.md` and `src/set/families.gen.ts` (`set/build.ts`), `src/kerim/art.gen.ts` (`kerim/build.ts`), the sounds (`sounds/build.ts`), the extras (`sahne-story/cast/extras.ts`) and the thumbnails (`sahne-gallery/thumbs.mjs`). A new generator gets one too.
- **Ids are permanent.** Never rename a part, set piece, prop, sound, gesture or place id that a document may use. Add the new id, and map the old one through the kit's `aliases`.
- **Docs follow the code.** One fact lives in one place and is linked from elsewhere. Update the area's doc in the same commit as the change. Never renumber a section that code or other docs cite (`DESIGN.md §12`).
- **The size budgets bind** (README, `size.mjs`). A bundle over budget fails the gate.
- **No story data that is not ours.** The samples are original. Never add text we don't hold the rights to, card or lesson data, or another project's characters to this repo.
- **Secrets** never go in the repo.
- **Kerim is "she".** She is a kumru (a collared dove), Kumru's mascot and narrator. Her art (`sahne-kit/src/kerim/`) is all rights reserved ([LICENSE-ART](LICENSE-ART)).

## Commits

Use Conventional Commits (`feat(sahne): …`, `feat(kit): …`, `fix(story): …`, `docs: …`), with one change per commit.
