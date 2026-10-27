# Contributing to Sahne

Thank you for helping. Bug reports, kit parts, set pieces, sounds and engine work are all welcome.

## Before you start

- Read [AGENTS.md](AGENTS.md). It holds the rules every change follows, and it is written for people as much as for agents.
- For anything bigger than a fix, open an issue first, so we can agree on the shape before you build it.
- Kit art has its own guide, [STYLE.md](packages/sahne-kit/STYLE.md). The gallery (`pnpm dev`) is the visual reference.

## Setup

```bash
corepack enable          # pnpm 11, as package.json pins it
pnpm install
pnpm --dir packages/sahne-gallery exec playwright install chromium
pnpm dev                 # the gallery on http://localhost:5180
pnpm check               # the whole gate: what CI runs
```

You need Node 24.

## Your pull request

1. Branch from `main`. Keep one change per PR, and use [Conventional Commits](https://www.conventionalcommits.org/): `feat(kit): …`, `fix(sahne): …`, `docs: …`.
2. `pnpm check` must pass. CI runs it on Linux too.
3. When the look changes, say so, link the gallery views (a view's address holds its state), and add screenshots. `node packages/sahne-gallery/shots.mjs --out <dir> --mid` takes them headless, mid-cue too. Update the golden frames deliberately: `pnpm sahne golden:update` on a Mac for `golden/darwin/`. For `golden/linux/`, take the `sahne-golden-failed` artifact of the CI run, or shoot them in an x86_64 `node:24` container with `fonts-comic-neue`.
4. Update the docs in the same PR as the code. When you add a generated file, add its generator and a `--check`.

The [README](README.md#adding-to-the-kit) says where a new kit part, set piece or sound goes.

## Licences

By contributing, you agree to license your code under the MIT License ([LICENSE](LICENSE)) and your kit art, sounds and music under CC BY 4.0 ([LICENSE-ART](LICENSE-ART)). Sound recordings must be CC0, with their source in `packages/sahne-kit/sounds/SOURCES.md`.
