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

## Contributing art

A drawing from your own story, a person's or an agent's, can become official Sahne art. You draw it as data in your content root (`kit/pieces/x_<id>.json`, [DRAWING.md](packages/sahne-kit/DRAWING.md), with backstage's MCP tools or `server/call.ts`), and when you want to offer it, one command checks it and opens the pull request:

```bash
node packages/sahne-kit/drawing/promote.ts <content-root>/kit/pieces/x_cafe_chalkboard.json \
  --id chalkboard --family bakery --by "Ada L." --contact github:ada --consent --pr
```

- **You need no checkout.** Run it from your app's folder and it works in a temporary clone, pushes to your fork and opens the pull request with `gh`. Without `gh` it leaves a `.patch` and the pull request text in `promote-out/` and says what to do. `--dry` only checks and draws the review sheet.
- **Consent is yours.** `--consent` says that **you release the drawing under CC BY 4.0** ([LICENSE-ART](LICENSE-ART)) and that **it is your own work: not traced, not copied** from a logo, a landmark, a brand or another artist. An agent asks its person for this, and for their name and a contact; it never gives the consent itself. Without it, promotion refuses.
- **You are credited**, for as long as the art is in the kit: your name and contact are in the drawing's `credit`, in `CREDITS.json`, in the Credits section of [SET.md](packages/sahne-kit/SET.md) and on the item's page in the gallery, and your commit carries a `Co-Authored-By` for you.
- **What a reviewer sees** is in the pull request ([the template](.github/PULL_REQUEST_TEMPLATE/art.md)): the review sheet and its family at one scale, what it is, where it was used, your credit and consent, and the checklist from [STYLE.md](packages/sahne-kit/STYLE.md): paper, light from the upper left, puppet scale, words as text, nothing traced. CI draws the sheets for every pull request that touches `src/set/drawn/`.
- **When an owner approves**, the art is official: its id is permanent, your credit stays, and your story's old `x_` id keeps working as an alias. A rejected pull request changes nothing, and your story keeps its own drawing.

## Licences

By contributing, you agree to license your code under the MIT License ([LICENSE](LICENSE)) and your kit art, sounds and music under CC BY 4.0 ([LICENSE-ART](LICENSE-ART)). Sound recordings must be CC0, with their source in `packages/sahne-kit/sounds/SOURCES.md`.
