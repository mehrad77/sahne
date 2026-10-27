---
name: visual-check
description: Look at what a Sahne change does on screen before calling it done. Use after any change to the engine's drawing or acting, the kit's art, a place, a story or a gallery view - shoots the gallery headlessly (mid-cue frames included), builds a contact sheet, reads it and reports what looks wrong.
---

# Visual check

Most changes in this repo change how something looks, and the tests can't judge that: only frames can. AGENTS.md's rule holds: **verify in the browser yourself; never ask a person to check by hand.**

## 1. Have the gallery running

- `preview_start sahne-gallery` (`.claude/launch.json`) or `pnpm sahne dev` in the background; it serves http://localhost:5180 and rebuilds on save.
- An edit to `packages/sahne-gallery/serve.mjs` or `data.mjs` needs a restart (stop the old `node serve.mjs` on :5180 first).
- **Don't screenshot the browser pane while it is hidden**: a hidden pane freezes animation and timers and draws nothing. Read text and run scripts there; take pictures with `shots.mjs`.

## 2. Shoot what changed

Pick the mode that shows the change (`packages/sahne-gallery/README.md`, *Screenshots*, has every option). Write into a scratch folder, never into the repo.

| Changed | Shoot |
|---|---|
| Acting, gestures, props in hand, moves, a story | `node packages/sahne-gallery/shots.mjs --out <dir> --story <id> --cues <i,j,…> --mid` |
| A place | `node packages/sahne-gallery/shots.mjs --out <dir> --places <id> --camera` |
| A gallery view, a system demo, a kit view | `node packages/sahne-gallery/shots.mjs --out <dir> --page '#/<route>' [--click "label,label"] [--wait 2500]` |
| One set family | `node packages/sahne-gallery/kit-sheet.ts --family <name> --out <dir>` |
| Phone width | add `--width 390 --height 667` |

**Always use `--mid` for anything that moves.** It adds frames at 15, 40 and 70 % of a cue; held props, gestures and flight go wrong while a cue plays, not at its end. Pick the cues that exercise the change, not just cue 0.

`shots.mjs` prints the page's console errors and warnings at the end: a `warning sahne: …` line (a prop it cannot give, an unknown mark, a gesture it lacks) is a bug to fix, not noise.

## 3. Make a contact sheet and read it

Many frames are easier to judge side by side:

```bash
uv run --with pillow python .claude/skills/visual-check/sheet.py <dir> <dir>/sheet.jpg
```

Then read `sheet.jpg` (and any single frame at full size where something looks off). Check against STYLE.md:

- people: faces read, hands land where the gesture points, held props sit in the hand, nobody faces the wrong way (a seated person at a `facing` mark), feet on the floor, no limbs through furniture;
- places: the wall fills the top of the wide shot and the floor reaches the bottom, nothing important is cut off, the light suits the time, lit windows at night;
- bubbles: aimed at the speaker's mouth, not covering a face, a phone bubble only for a speaker who is off stage;
- the light and the weather of each scene (weather carries from one scene to the next unless a scene sets it);
- the gallery views: no "This view failed", no horizontal scroll at 390 px.

## 4. Report, and update golden frames only on purpose

- Say what you looked at (which routes, cues and widths) and what you saw, with the frames that show a problem.
- A change of look is a golden-frame change: `pnpm check` fails on it. If the new look is intended, update the baselines on purpose (`pnpm sahne golden:update`; the gallery README says how to make the Linux ones) and say so in the commit or PR.
