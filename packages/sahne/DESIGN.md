# Sahne: the paper-theatre stage

*Sahne* is Turkish for "stage". It is a reusable engine for illustrated, interactive dialogue scenes on the web: characters made of cut paper, in lit places with depth, a camera, sound, and things the learner can touch. [Kumru](https://github.com/mehrad77/kumru) uses it first, for the stories, the tutor talk and the avatar builder. Other apps can use it too.

Status: **design v1, 2026-10-09; current as of 2026-10-10.** The engine build (B0–B5) is done (section 15). This replaces the SVG-rig proposal of 2026-10-08 (the Kumru repo's `docs/stories/STORIES_STAGE.md`, which now covers only how the stories use this engine). Items marked *proposed* can change during the build; items marked **Open** are undecided.

**Map** (read a section, not the file; the code side is in [README.md](README.md#where-things-are)):

| Section | Topic | Code |
|---|---|---|
| 4 | Packages, modules, delivery | `src/stage.ts`, `package.json` exports |
| 5 | Formats: avatar, kit parts, skeletons, place, script | `src/core/types.ts`, `src/script/`, `src/avatar/` |
| 6 | Paper backend: renderer, puppets, faces, light, camera, overlays | `src/render/paper/`, `src/face/`, `src/ui/overlay.ts` |
| 7 | Animation | `src/director/`, `src/anim/`, `src/rig/` |
| 8 | Audio | `src/audio/`, `sahne-kit/sounds/` |
| 9 | Interaction | `src/interact/`, `src/listen/` |
| 10 | Avatars and the builder | `src/avatar/builder.ts`, `src/ui/builder*.ts` |
| 12 | Performance budget (the size check) | `sahne-gallery/size.mjs` |
| 15 | Milestones: the engine build (B0–B5) only | |

## 1. Decisions (2026-10-09)

| # | Question | Decision |
|---|---|---|
| 1 | Look | **Paper theatre in 2.5D.** Flat illustrated cutouts stand in a real 3D space, with lighting, depth and a moving camera. Characters turn by flipping like a sheet of paper, so each part needs only a front and a back view |
| 2 | Later 3D | Every format is independent of the renderer, so a **procedural 3D toon** backend can join or replace the paper one later (section 11). Nothing is built for it now |
| 3 | Who draws | **Claude draws all of it, in code.** No artist, no editor files (Rive, Spine, Live2D), no 3D models, no traced photos. Recorded CC0 sounds are the only outside material |
| 4 | Modularity | **One kit for everyone.** The cast and the learners' characters are built from the same parts, and learners mix and match freely. Places are built from a set kit the same way |
| 5 | Package | `packages/sahne` is its own workspace package. It knows no language and no app. Language rules come in through plugins |
| 6 | Old avatars | **Dropped.** Learners design a new character the first time the new builder opens. There is no migration |
| 7 | Sound | Synthesized effects and ambience, synthesized music motifs, and recorded CC0 sounds. **Neural voices** per character come later; the voice interface is designed for them now |
| 8 | Mechanics | The engine supports all of them: the reply card, acting in the scene, saying a line aloud, exploring the scene, and unlockable avatar items. **Each story week picks** the ones it uses |
| 9 | Schedule | No launch date constrains this work (the owner, 2026-10-09) |

## 2. Goals

- **Meaning reads at phone size.** Who speaks, to whom, about which thing, and how they feel are clear on a 390 px screen with the translation off and the sound muted.
- **Warm, crafted motion.** Anticipation, arcs, overlap and settling, as an animator would do it, and faces that act.
- **Modular art.** Any body with any face, hair, clothes and accessories, with no drawing made for one combination only.
- **Low-end phones and offline.** It works on a 2–3 GB Android phone, and nothing needs a connection once installed.
- **Accessible.** Nothing needs sound, nothing needs motion, and everything shown has a text equivalent.
- **Testable.** The world state is a pure function of the script. Randomness is seeded, so a frame can be reproduced exactly.
- **Authored by an agent.** Every format is text, every part is code or JSON, and a gallery shows every part, pose and sound for review.

**Not goals:** physics simulation, a free camera, scenes made by users, photorealism.

## 3. The look

- **Cut paper.** Every piece is a flat shape with a thin, lighter paper edge and a soft contact shadow on whatever is behind it. Fills are flat colours, each with one shade tone and one highlight tone that the kit derives from the base colour, so the light falls the same way across all the art (from the upper left). A faint procedural paper grain sits on every surface. No outlines.
- **Proportions.** Big heads, so faces read: adults about 1:3 head to body, elders the same with a slight stoop, children about 1:2.4, toddlers about 1:2.
- **Faces carry the acting.** Large eyes with lids and moving pupils, brows with an inner and an outer point, a mouth that changes shape smoothly, small noses, cheeks that flush. The face is drawn fresh whenever it changes (section 6.4).
- **Depth.** A place is a stack of paper flats at real depths: sky, far skyline, the room, set pieces, actors, props, a near edge. The camera's perspective gives true parallax. Distant layers soften slightly (depth of field).
- **Light.** Each scene has a time of day: day, golden hour, dusk or night, plus overcast (and rain, planned). Light changes colour and strength, windows and lamps glow at night, and there is a rim light against a low sun. The art is never redrawn for the time of day.
- **Theme.** The stage is a lit world, not UI, so it does not follow the app's light or dark theme. In the dark theme it is dimmed about 8%, and the UI around it changes.
- **Text in the scene** (signs, labels, phone screens) is painted into the paper, in the app's fonts, so whatever stands in front covers it; an invisible HTML copy laid over it in perspective keeps it readable by screen readers (section 6.8). Sound words and speech are HTML bubbles.
- **Style guide.** `packages/sahne-kit/STYLE.md` holds the palette, tones, edge and shadow sizes, line of action and proportions. The gallery is the visual reference.

## 4. Architecture

```
app (Kumru)                            sahne (engine)                                  sahne-kit (art)
 story steps ──adapter──▶ Script ─▶ fold() world state ─▶ Director ─▶ Timeline ─▶ Backend: paper | still | (toon3d later)
 avatar docs ───────────────────────▶ compose(avatar, kit) ─▶ Puppet ◀────────────── parts, palettes, poses, faces
 place docs  ───────────────────────▶ build(place, kit)    ─▶ Set    ◀────────────── set pieces, props, lights
 sound cues  ───────────────────────▶ Audio: synth | samples | voice ◀────────────── patches, motifs, CC0 samples
 UI ◀── events: inspect, act results ◀── Interaction: hit tests, requests
```

### 4.1 Packages

| Package | What it holds | Depends on |
|---|---|---|
| `packages/sahne` | The engine: formats (typed in TypeScript), world state, director, timeline, rig, backends, audio, interaction, the avatar model and a default builder UI | nothing |
| `packages/sahne-kit` | The art: the body kit, parts, palettes, faces, poses and gestures, props, set pieces, sound patches, motifs, CC0 samples. A different app can ship a different kit in another style | `sahne` (types only) |
| `packages/sahne-tr` | The Turkish plugin: mouth timing from spelling, token matching for word ↔ object links, normalising and matching speech for *say it aloud* (`normalise`, `matchLine`), and what the teaching lints read (*bu/şu/o*, numbers, clock times) | `sahne` (types only) |
| `packages/sahne-story` | The story format's adapter (`adaptStory`: a story document becomes a script and its reply cards, the Kumru repo's `docs/stories/STORIES_STAGE.md` §3) and the story lints (`lintStory`, `suggest`, §4). Story-specific, so it lives beside the engine, not in it | `sahne` (types), `sahne-tr` |
| `packages/sahne-backstage` | The editor an app runs on its content root: series, seasons and episodes played, fixed and staged in the browser, saved with the story check; a Node server beside a Preact page. Never ships | all but the gallery |
| `packages/sahne-gallery` | The dev site: every part, view, emotion, gesture, set, light and sound; the builder; a script player; a story played through the adapter; a performance readout | all of them |

All six are TypeScript with erasable syntax only, so Node 24 runs the tests directly (as the reader's tests do) and esbuild bundles them. The root pnpm workspace includes `packages/*` ([packages/README.md](../README.md)).

### 4.2 Modules of the engine

| Module | Holds | DOM? |
|---|---|---|
| `core` | Types (the formats, in `types.ts`), seeded random, maths, the kit and language-plugin contracts | no |
| `script` | The script's cues and the world state after a cue | no |
| `director` | Fills in default staging: gaze, framing, reactions, entrances; turns a cue into a timeline; `fold(script, i)` | no |
| `rig` | Skeletons, poses, two-bone IK, springs, the face model, lip-sync tracks | no |
| `anim` | The clock, tweens and springs, pose layers, the timeline player (`seek`, `finish`) | no |
| `render/paper` | The WebGL2 paper backend (section 6) | yes |
| `render/still` | SVG output: portraits, story tiles, still frames for *Still* motion, and the fallback without WebGL2 | builds strings |
| `audio` | The synthesizer and the sequencer (`dsp.ts`, `motif.ts`) and the speech clock (`clock.ts`), all pure; the Web Audio engine with its buses (`engine.ts`) and the voice providers (`voice.ts`). Kit recordings load through `AudioEngine.recording`; a voice provider of recorded lines loads its own clips | the engine and voices |
| `interact` | Hit testing and alpha masks (`hit.ts`), the act state machine and `inspect` payloads (`act.ts`, pure), and the layer a page attaches to a stage (`index.ts`): pointer, rings, the accessible list | the layer only |
| `avatar` | The avatar document, compatibility rules, `compose`, the headless builder model | no |
| `ui` | The overlay (bubbles, sound words, the narrator's window), the builder screen (`mountBuilder`); later the stage chrome | yes |
| `listen` | *Say it aloud* (section 9): the Web Speech wrapper. Imported as `sahne/listen`, never from the index, so an app that never listens does not ship it | yes |

The pure modules run in Node tests. Only the backends, audio and interaction touch the browser.

### 4.3 Delivery

- The packages ship TypeScript source (`"sideEffects": false`, so an app's bundler keeps only what it uses). Kumru's Vite build splits them into hashed lazy chunks behind `host.lib`: `avatar` (portraits with the kit), `builder` and the story `player`, and one chunk per set family; the recordings go to `sounds/<hash8>/`.
- The service worker precaches the portraits (they are on every screen) but fetches the builder, the player, the set families and the recordings on first use and keeps them across versions (Kumru's lazy cache), so a learner who never opens Stories never downloads the stage, and a story opened once plays offline.
- Kumru's page build checks what each part costs (its `scripts/vite/page.ts`, `BUDGET_KB`, the app's rows in §12) and fails when Sahne code reaches the entry chunk.
- Bundles are deterministic (`sahne-gallery/determinism.mjs`), so an app's content-hashed build stays stable.

### 4.4 API sketch *(proposed)*

```ts
const stage = mountStage(el, { kit, lang: tr, motion: "full", sound: false, volumes: { music: 0.4 }, voice: browserVoice() });
stage.load(script, { cast: { nima: learnerAvatar, ismail: ismailAvatar }, places, voices: { ismail: { rate: 1.05, pitch: 0.8 } }, narratorSound: "coo",
  wardrobe: { farzad: { winter: farzadInCoat } } });   // the clothes a `costume` key names, composed on the actor's own body
stage.show(i);                     // draw the world after cue i, with no performance
const run = stage.play(i);         // perform cue i
run.finish();                      // jump to its end pose (the learner tapped Devam)
const ix = interact(stage, { explore: week.explore });   // before load: the atlas gets its alpha masks
ix.on("inspect", ({ target, terms }) => openGloss(terms));
const act = stage.play(i);         // an act cue: an ActRun, waiting for the learner
const r = await act.result;        // { target, misses, hinted, shown, tries, via }; act.done after its performance
act.answer("obj:ekmek"); act.skip(); ix.request({ kind: "tap", targets: [...], expect }); ix.focus();
stage.setSound(true); stage.setCaptions(true); stage.audio.motif("kerim");   // sound from a tap; the app's opening theme
stage.setMotion("calm"); stage.destroy();

portrait(avatar, kit, { framing: "head", size: 64 });   // an SVG string, cached by the document's hash
const builder = createBuilder(kit, avatar, { unlocked, offer });  // headless: options per slot, set, randomise, undo; `more(field)`
const ui = mountBuilder(el, { kit, doc, lang: "tr", unlocked, offer: starter, more: true, unlockLabel, onChange, onDone, onCancel });
ui.setLang("en"); ui.setUnlocked(ids); ui.setTheme("dark"); ui.doc; ui.destroy();   // mode: "author" offers every part, the cast's too
```

## 5. Formats

Every format is JSON, typed in TypeScript: avatar, place, kit and light types in `src/core/types.ts`, the script's cues in `src/script/types.ts`. The engine has no JSON schemas of its own: the schemas for the story, character and place documents, and the validator that uses them, are in `sahne-story` (`schema/`, `check/schema.ts`). Ids are permanent, as card ids are: a retired part, set piece or sound keeps its id and maps to a replacement through the kit's `aliases`.

### 5.1 Space

Units are metres, with *y* up and *z* towards the camera. The floor is *y* = 0. A mark is `{x, z}` with an optional `facing`. An adult stands about 1.7 m tall, of which the head is about 0.55 m.

### 5.2 Avatar document

It describes one character: a learner's or a cast member's. It is the same document for every backend.

```json
{"v": 1, "kit": "sahne-kit@1",
 "body": {"build": "adult", "height": 0.5, "shape": "average"},
 "skin": "skin_07",
 "face": {"shape": "oval", "eyes": "almond", "brows": "soft", "nose": "button", "mouth": "wide", "ears": "round", "marks": ["freckles"]},
 "hair": {"style": "hair_bob", "color": "hair_04"},
 "facialHair": null,
 "outfit": {"top": {"id": "top_tee", "colors": ["fab_12"]}, "bottom": {"id": "bottom_jeans", "colors": ["fab_03"]},
            "outer": null, "shoes": {"id": "shoes_sneakers", "colors": ["fab_20", "fab_01"]}},
 "wear": {"head": null, "eyes": "glasses_round", "ears": null, "neck": null, "wrist": "watch"},
 "carry": null}
```

- **Body:** `build` is `adult`, `elder`, `child` or `toddler`. `height` runs 0–1 inside the build's range. `shape` is `slim`, `average`, `broad` or `round`.
- **Colours** are palette ids, never free hex, so every combination stays in the style. The first kit has 19 skin tones, 19 hair colours, 8 eye colours and 38 fabrics (`sahne-kit/src/palette.ts`; `sahne-kit/CATALOGUE.md` lists them), and some parts take a pattern (stripes, checks, dots, a print).
- **Slots and rules.** Each part declares its slot and what it does to the others: `hides` (a headscarf hides the hair), `clips` (a cap keeps only the hair below its line), `replaces` (a dress replaces the top and bottom), `over` (a coat goes over the top). The builder offers only parts that fit, and `compose` enforces the same rules.
- **Any part with any body.** There is no gender gate. Modest options are always there: headscarf styles, long sleeves, long skirts and dresses.
- **Size:** at most 2 KB (`AVATAR_MAX_BYTES`; a host may only make it stricter). Kumru stores it as the `char` field; its Worker checks its shape, size, kit family and that it wears no cast part (Kumru's `shared/char.ts`), and `normalize` stays the boundary when it is drawn.
- **Unknown ids** (an older kit, a retired part) draw as the slot's default and never fail.

A cast member's document adds `motion` (`tempo`, `energy`, 2–3 `signature` gestures), `voice` (section 8.4), and at most two `custom` parts, which are kit parts reserved for that character (Maria Teyze's bun, İsmail's moustache and apron).

- **The body is fixed; clothes change.** A `Look` (`src/core/types.ts`) names only clothing fields: every `outfit` and `wear` slot (glasses, aids and head coverings are clothes), `carry` and `hold`. `applyLook(doc, look)` (`src/avatar/look.ts`) puts it on a document: only the named slots change, a bare string is a part id, `null` takes a slot off, and anything else (hair, body, skin) is ignored. The result goes through `normalize` like any document. `CLOTHING_FIELDS` lists the fields. The stage itself never reads looks: an app dresses its cast ahead and hands the stage a wardrobe (section 5.6, `costume`).

### 5.3 Kit parts

A part is a **generator**. Given the body's measurements and the chosen colours, it returns its pieces for the front and back views.

```ts
export const top_tee = part({
  slot: "top", colors: 1, tags: ["casual"],
  draw: ({ body, color, tone }) => ({
    front: { chest: [shape(teeFront(body), color)], arm_l: [sleeve(body.upperArm, color)], arm_r: [sleeve(body.upperArm, color)] },
    back:  { chest: [shape(teeBack(body), color)],  arm_l: [sleeve(body.upperArm, color)], arm_r: [sleeve(body.upperArm, color)] },
  }),
});
```

- A **piece** is attached to a bone and a layer, and is made of shapes: an SVG path `d`, a fill (a palette token plus `shade` or `highlight`), and an optional opacity.
- **Clothes are drawn from the body's measurements** (chest, waist and hip widths, limb lengths and widths), so one generator fits every build and shape. This is what keeps mix-and-match affordable to draw.
- Hair, scarves, apron strings and earrings can declare **springs**: small bones that lag and settle.
- The same pieces render to SVG (the still backend) and to a texture atlas through `Path2D` (the paper backend).

### 5.4 Skeletons

- **Humanoid** bones: `root`, `hips`, `spine`, `chest`, `neck`, `head` (with a `face` plane), `hair_*`, and for each side `shoulder`, `arm`, `forearm`, `hand`, `thigh`, `shin`, `foot`. Props attach at `grip_l`, `grip_r`, `hip` and `back`.
- Bone lengths and widths come from the build and the shape.
- **Animals** have their own skeletons: a `bird` (Kerim, gulls) and a `cat` (Pisi). An animal is a **kit puppet** (`KitPuppet` in `core/kit.ts`): the kit builds it in code, with its own bones, art, `pose()` and gestures, and a cast entry names it as `{ "puppet": "bird" }` instead of an avatar document (`Kit.puppets`). It has no hands and no face texture: its eyes and beak are art its pose switches (`PoseOut.alt`). The bird rig is built (`rig/bird.ts`: `birdBones` from the art's pivots, `birdPose` for perching, hopping, flying and hovering, moods from the kit's emotions, and gestures mapped onto wings, head and body); Kerim's puppet is `sahne-kit/kerim`. The **cat rig** (`rig/cat.ts`: `catBones`, `catPose`) has a root at the feet, a body, a head, a tail and four legs (`leg_nf`, `leg_nb` near, `leg_ff`, `leg_fb` far); its postures are drawings switched by `alt.body` (`stand`, `sit`, `loaf`, `sleep`), each putting the head and tail where its drawing has them, and a mood (from the kit's emotion) names one. Walking it stands and strides in a four-beat gait (two steps to a cycle, a paw lifted as it swings forward, the back bobbing); at rest its tail sways and it blinks; gestures turn the head (a `reach` to the target aims it), open the mouth (`shape: "open"`), shut the eyes or take a posture (`shape2`). The animal puppets are `sahne-kit/puppets`: Pisi (`{ "puppet": "cat" }`, black) and the gulls (`{ "puppet": "gull" }`, on the bird rig with their own art, moods and gestures).
- Bone names are shared by every backend. Pose data is not (section 11).

### 5.5 Place document

```json
{"v": 1, "id": "bakkal", "name": {"tr": "İsmail'in bakkalı", "en": "İsmail's corner shop", "fa": "بقالیِ اسماعیل"},
 "size": {"w": 8, "d": 4},
 "pieces": [{"kit": "wall", "x": 0, "z": -2.2, "w": 1100, "h": 430, "openings": [{"x": -350, "y": 0, "w": 105, "h": 220}]},
            {"kit": "door_shop", "id": "door", "x": -3.5, "z": -2.19},
            {"kit": "shelf", "x": 2.35, "z": -2.06, "w": 230, "h": 235},
            {"kit": "counter", "x": 0.5, "z": -0.35, "w": 230, "h": 86},
            {"kit": "lamp", "x": 0.4, "y": 2.3, "z": -0.95}],
 "marks": {"door": {"x": -3.45, "z": -1.15, "door": "door", "out": {"x": -3.45, "z": -2.95}},
           "counter": {"x": 0.64, "z": -0.8, "facing": "l"}, "ledge": {"x": 2.35, "y": 2.42, "z": -2.05}},
 "props": {"ekmek": {"kit": "bread", "at": {"x": 0.18, "y": 0.9, "z": -0.43}, "n": 3, "terms": ["a1-w-ekmek"]},
           "sut": {"kit": "milk", "at": {"x": -2.38, "y": 0.97, "z": -2.035}, "n": 3, "terms": ["a1-w-sut"]}},
 "times": ["day", "golden", "dusk", "night"], "camera": {"wide": {"x": -0.4, "w": 8.2, "z": -2.1}},
 "ambience": ["street_far", "fridge_hum"], "motif": "street", "surface": "tile", "perch": "ledge"}
```

The type is `PlaceDoc` in `src/core/types.ts`. The example is cut from the bakkal (`sahne-story/samples/places/bakkal.json`; an app's place documents live in its content root, `sahne-story/paths.ts`), with a `perch` added. Positions are metres; a piece's other keys are its generator's parameters, in centimetres. There is no `lights` field: practical lights come from the pieces themselves (the `lamp` carries a warm point light and a glow, and `street` and `window` have lit windows), and the time of day sets the rest. A shot is lit by at most four point lights: those nearest what the camera looks at.

- A place is built from **set pieces**: parametric generators in the kit's set entry (`sahne-kit/set`, files in `sahne-kit/src/set/`). They come in **families** (`base`, `airport`, `metro`, `props`, …), each its own chunk: a host loads the families its story's places use (`loadSet(places)`, then `withSet(kit, loaded)` before `mountStage`); `sahne-kit/full` is the kit with every family, for the gallery, the tests and the lints. Every piece and prop, with the params it reads, its variants and the places using it, is in the generated `packages/sahne-kit/SET.md`. One generator draws every look of a thing through its params (a `chair` is a school chair, a folding one or a waiting row); its named looks are **variants** (`PieceDef.variants`), and a piece or prop picks one with `variant` (`{"kit": "chair", "variant": "folding", "n": 12}`), its own params overriding the variant's (`withVariant`). Each generator also describes itself in `PieceDef.meta` (`PieceMeta`): a line on what it draws, every param it reads with its type, values and default (`ParamSpec`), the place states it answers to and its usual card words. The engine never reads it; `SET.md` and the gallery's piece inspector are built from it, and the kit's tests hold every variant to it.
  - Families drawn for Kumru's A1 places: `street` (façades, shopfronts, lamp posts, trees), `interior` (doors that swing, the stairwell, balconies, the roof), `furniture`, `outdoor` (crowds, the sky, skylines, landmarks, the sea), `vehicles` and `metro` (the taxi's and the bus's cabin, the ferry, the tram, the platform), `food`, `paper` and `misc` (props). A vehicle's cabin has openings the view outside shows through: layers that scroll past on a running place (`life: "run"`).
- A place file is small: about 2–5 KB. The art is in the kit.
- **`site`** names the site a place is one space of: the metro's `metro_m11` and `metro_osmanbey` both have `site: "metro"`. A place that is a whole site has none. **`outdoor`** says the far band is sky, skyline or water. Each piece draws its random art from its own seed (`pieceSeed`): its `seed` if it has one (one building seen from several places), else the site (or place) with the piece's `id`, or with its kit and position. Adding, removing or reordering a piece never redraws the others, and a piece repeated in two places of one site looks the same.
- **States** (`states`) are variations of one place: the class empty or full, the shutter down, bunting up. States in one `group` exclude each other (the class is `empty` or `full`); one without a group is a toggle (`flags`). `default` states are on when a scene starts here. A piece, mark or prop with `in: [states]` shows only while one of them is on (`placeState`, `inState` in `src/script/world.ts`). A scene's `state` turns states on beside the defaults; `env: "state:<s>"` turns one on (and the rest of its group off), `state:-<s>` off, both as a cut or, with `:fade`, a 0.4 s fade, or, with `:roll`, a 1.4 s one in which a flat with `reveal: "down"` (a roller shutter, `FlatSpec.reveal`) is not faded but drawn from its top edge down, and rolls up again when its state goes off. The same place keeps its states across scenes; a new place starts in its defaults. What another state shows leaves the explore list and the hit tests.
- **Sites.** Places with the same `site` are spaces of one site (the metro's car and its platform). A scene moving between them plays no new motif and carries every prop as a kept one, so what is held stays in the hand and a count comes along; what waits for the site is dropped when the story leaves it (`enterPlace`).
- **Wide shot.** `camera.wide` sets the width the wide shot fits at depth `z`, and `y0`…`y1` the height (default 0.15 to 2.45 m, people standing); a stairwell or a roof with a water tank raises `y1` (`wideBox` in `render/paper/camera.ts`).
- **Marks** are `{x, y?, z, facing?, air?, pace?, seat?, in?}` in metres. `facing` turns whoever stands there a little to screen left (`l`) or right (`r`), or shows their back (`back`: the driver and the front passenger seen from the windscreen); on a seat, `side_l` or `side_r` seats them side on, facing screen left or right (a bus seat seen from the aisle, §6.3). `air` is a spot in the air: a bird that flies there keeps flying (hovers); `pace` makes it a spot beside something moving, where she flies along instead (§6.9). `seat` makes it a seat, its top that many metres above the mark's floor (a chair 0.45, a car's bench 0.55): whoever a scene puts there, or who walks there, sits down (§6.3) and stays seated through every cue until they move, when they get up first. A person who walks onto a seat, or onto a mark with a `facing`, turns that way as the walk ends (front, when a seat does not say); on any other mark they keep the way they came. A place's `life: "run"` keeps its life going (§6.9), and its `stops` lists a vehicle's stations and timetable, so a story can hold it at a station (§6.9). The place's `perch` (and a scene's) is the mark where the narrator's bird sits, when the cast has one. A door mark adds `door` (the id of the door piece, which swings open for an entrance or an exit, or slides: a leaf with `slide`, the bus's door) and `out` (the street side, where an `enter` starts and an `exit` ends, at the door mark's height: a flat's door on a stair landing).
- **Solid lines.** A generator may say where its piece is solid on the floor (`PieceDef.solid`: lines in cm from its origin, from its params alone, never by drawing): a wall (less its openings down to the floor), a school corridor's back wall (less the doorways it cuts for door pieces), a glass partition, a railing, a park's or a church's edge, a building's front (less its street door's bay), a garden wall, a counter; a desk or a table along its front and its sides, back by half its depth, the back half open for a chair and its sitter. A gate's leaves and a door's are lines with `door`: solid, except to the leg of an entrance or an exit through a door mark that names the piece. `placeSolids(place, kit)` places them in metres, with the piece's `id` and `in`; a piece with `solid: false` has none (a far or decorative piece people may pass). Walks go round them (§7).
- **`terms`** are the app's own ids for what a thing is called (Kumru's card ids). The engine only passes them back in `inspect` events.
- **Sound** (section 8): `ambience` lists the kit loops heard while a scene is here, `motif` is the music when the story moves here from another place, and `surface` is what footsteps sound on (`stone`, `wood`, `tile`, `carpet`).
- **Props** take parameters: `n`, `label` (text drawn on it, which may carry a personal token), `time` for clocks and watches, and `screen` for phones (a call, messages, a photo). The kit's props are listed in `sahne-kit/SET.md`. A sign's `label` and a phone's `screen` (a string, or `{title, lines}`) are drawn as text on the prop (section 6.8); a clock's `time` is art, its hands.
- **`keep`** on a prop says it is the same thing in every place that lists it with `keep` (a story's suitcases, from the airport to the flat). When the story moves to a new place, a kept prop gives its count, showing and parameters to that place's prop of the same id (not its position); one in the hand of someone in the new scene stays in that hand; one the new place does not list waits in the world's `away` until a place lists it again; a part split off it and left behind rejoins its count (`enterPlace` in `src/script/world.ts`). A place's other props start as its file says.

### 5.6 Script

A script is what the engine plays: a list of cues. Each app turns its own content into a script; the story format's adapter is `packages/sahne-story` (the Kumru repo's `docs/stories/STORIES_STAGE.md` §3). The script's vocabularies are also values (`CUE_KINDS`, `STAGING_FIELDS`, `CAM_KINDS`, `MOVE_HOWS`, `VOICES`, `OBJ_OPS`, `ACT_KINDS`, `ENV_VERBS`, and in the kit types `EMIT_KINDS`, `MOTION_KINDS`), checked against their types, so tools can list them: the gallery's coverage test fails while one has no demo.

| Cue | Shape | What it is |
|---|---|---|
| `scene` | `{scene: place, time?, weather?, state?, at: {actor: mark}, perch?, cam?, stop?}` | Sets or changes the place and puts actors on marks. Actors not listed are off stage. In the same place the props and states stay and whoever leaves takes what they hold; a new place starts its own props afresh and brings the kept ones, and starts in its default states plus `state` (§5.5); another place of the same site carries every prop and plays no motif |
| `line` | `{line: {who, text, …staging}}` | Someone speaks. `text` is in the scene's language and drives the mouth, bubbles and links |
| `beat` | `{beat: {who?, wait?, …staging}}` | Staging with no speech: a move, a look, a clock tick, a silence. `who` performs `do` and `emo`; `wait` holds the stage (ms). An arc beat of "one staging moment" is a `beat` |
| `act` | `{act: {kind, targets, expect?, prompt?}}` | The learner does something on stage (section 9) |
| `overlay` | `{overlay: {kind, …}}` | A teaching overlay (case arcs, owner tags, deixis rings) with Kerim acting it out |

**Staging fields** (on `line` and `beat`; all optional, with the director's defaults):

| Field | Values | Meaning |
|---|---|---|
| `to` | actor, `all`, `viewer` | The addressee: gaze, framing |
| `emo` | an emotion | Face and posture. It lasts 2 cues, then fades to the character's resting mood |
| `do` | a gesture | One gesture, with `at` as its target; `n` for counting; `loop` while the cue is on screen |
| `at` | `obj:<prop>`, `ch:<actor>`, `ch:<actor>.<body part>`, `mark:<mark>`, `viewer` | The target of the gesture and the gaze |
| `move` | `{who, to, how, from?, via?}` or a list | `how` is `walk`, `run`, `hop`, `enter`, `exit` or `fly`. On foot, each leg goes round the place's solid lines (§7, §5.5): a wall, a railing, a closed gate. `via` lists marks to pass on the way (a stairway's landings); a walking leg that rises or falls more than 10 cm is a stair (§7). An `enter` comes through the door of the mark `from` (default: the place's first mark with a `door`). A `fly` (a bird) goes about 2.6 m/s along an arc above the straight line, one wingbeat per 0.92 s and no footsteps; from off stage it comes in from outside the frame; to an `air` mark it keeps flying there |
| `obj` | `[{id, op, to?, via?, ms?, n?, at?, set?}]` | Prop changes: `show`, `hide` (leaves a dashed outline), `give` and `take` (with `n` less than a stack's count, they split it: the rest stays, the hand holds `ekmek#1`), `add`, `own`, `place`, `set` (a parameter: the clock's time, a screen, a label; `n` is the count; `still: true` holds the prop's own motion where it starts, with no new look), `go` (it goes along `via` marks to the mark `to`, easing in and out, in `ms` or at 0.9 m/s: the timeline moves it, so taps, gaze and framing follow it and seeking is exact; a held prop does not go) |
| `link` | `{token: target}` | Words in `text` that name something on stage, for word ↔ object taps; a plugin can infer them |
| `react` | `{actor: emo \| gesture \| {emo, do, at}}` | Listeners' reactions after the line, at most two |
| `cam` | `wide`, `two`, `single`, `close`, `ots`, `obj`, `follow`, `split`, `photo` | A framing override. `ots` is over the shoulder; `photo` is a freeze-frame with a shutter |
| `via` | `phone`, `video` | The speaker is not on stage. Today the line's bubble sits at the top of the stage with the speaker's name and a phone mark, no tail, and no one turns to look; a phone inset or a split frame with `cam: split` is planned |
| `voice` | `normal`, `whisper`, `silent`, `mouthing` | `silent` is a line with no words (the "…" card); `mouthing` moves the lips without a voice |
| `sfx` | `{id, word?, at?, params?}` or a list | A kit sound, with its sound word drawn as a bubble ("tık tık") where it comes from (`at`; an entrance's sound comes from the door). `word` overrides the kit's; `params` go to the patch. The bubble shows while sound is off or captions are on (section 8.5) |
| `env` | `time:<t>` (`time:<t>:<ms>`: over `ms`, a slow nightfall), `state:<s>` (`state:-<s>`, `:fade`, `:roll`), `weather:<w>`, `thunder`, `lights_on`, `lights_off`, `fireworks`, `stop:<station>`, `depart`; one or a list | A one-off change to the place |
| `frame` | `past`, `past_inset` | A remembered event: the whole stage in an old-photo look, or a small picture of another scene |
| `on` | a word of `text` | The word the gesture's stroke meets ("yok" for a shrug). Default: the last mention of the word linked to the target, else the first word |
| `tempo` | number, 1 = the character's own | This cue's speed: "İsmail, quickly" is 1.4 |
| `costume` | `{actor: key}` | A change of clothes as the cue starts, after the actor's walk: `key` names an entry of `LoadOptions.wardrobe[actor]`, `""` the cast document. It happens at once, in every motion setting. A `scene` cue takes `costume` too, and dresses actors at the cut. Clothes stay on across scenes; an unknown key draws the cast document |

**The narrator on stage.** When the cast has a kit puppet for the narrator (Kerim's bird), each scene puts her on its `perch`, else the place's; with neither she is only the window. Her lines still go to the window, and her beak moves with them. Listeners don't turn to her, nor does anyone address her unless a line's `to` says so (alone with her, a line or beat goes to no one), her line's `to` defaults to `viewer`, and the director's own shot leaves her out unless the line asks for `follow`, `single` or `close`.

Some of these fields and cues are typed but not built yet; [README.md](README.md#status) lists them.

**Vocabularies are owned by the kit** and listed in its manifest: emotions, gestures, sounds, motifs, set pieces and props. A script is validated against the kit it names.

Emotions in the first kit *(proposed, 14)*: `neutral happy laugh sad surprised curious confused sorry annoyed shy tired nervous proud moved`. `nervous` is Nima's freeze; `moved` is touched to tears.

Gestures in the first kit *(proposed, 40)*: the 31 of the 2026-10-08 draft (`point point_far hold_up touch look`, `wave welcome hand_heart nod cik shake_head shrug bow_head`, `me you count beckon stop think explain`, `give take eat drink write read phone type knit sit stand`), plus `clap hug photo shush shiver cheer knock sleep fly`, and `thumb_up` (the thumb's hand shape).

## 6. The paper backend

### 6.1 Renderer

- **WebGL2, one context per stage.** Frames are drawn only while something changes; at rest the GPU is idle.
- Textures use premultiplied alpha and mipmaps. One shader (`render/paper/shaders.ts`) draws everything, by mode:
  - paper: texture × light × grain, plus the edge; limbs as strips;
  - shadow: a soft drop shadow, and a blob on the floor;
  - sky: a gradient by time of day;
  - glow: additive, for lamps and windows;
  - the face texture;
  - *planned:* particles, instanced (section 6.7).
- Pieces are sorted back to front by depth, and inside a puppet by layer, so a frame is a single sorted draw call.
- **Without WebGL2** (rare in 2026), the still backend draws key poses as SVG, and everything stays readable.

### 6.2 Atlases

- When a scene loads, its parts are rasterised into one atlas, a texture array of 2048 (or 1024) layers packed in shelves: the cast's pieces, and the set and prop looks of the place on stage and of the next place the script goes to. They are drawn with `Path2D` on an `OffscreenCanvas` where available, with the paper edge and the shade tones baked in. A flat larger than a 2048 layer (less its padding) at its resolution cannot be drawn and its place does not load; `cellSize` and `fitsAtlas` give the same answer outside the stage, and the place lint's `budget` rule uses them.
- **One place at a time.** Texture memory follows the cast and two places, not the whole story. After the cut into a new place the stage draws a new atlas (the cast, that place and the one after it) in idle time, about 8 ms a task, each piece read back by a pixel so the canvas really draws it then, and swaps it in when the cue on stage is over or paused: the GPU upload, a few ms on a laptop, comes where a hitch does not show, the old atlas is freed first, and the place left behind goes with it. The place a cut goes to is always in the atlas already; one that is not (a jump, a learner clicking through faster than the idle drawing) is drawn at the cut, never shown missing. A prop look is in the atlas while a place whose performances show it is. A cue played off the script (`stage.act`, `perform`) that reaches a place or a prop's look nothing loaded has it made and drawn first, at once. A lost context, `setAvatar` and the studio's backdrop rebuild the same window at once.
- **Glow resolution.** A flat's glow (`emissive`) is drawn at the flat's resolution unless it says less (`glowPpcm`): glow is soft light, and a sparse glow spread over a wide flat (the windows of a city lighting up by turns, each turn a flat as wide as the street) costs most of its cells in dark. The kit's lit windows use half.
- The resolution comes from the closest framing the scene can use, capped at device pixel ratio 2.
- Atlases are kept by hash for the session. A later version may store them in IndexedDB.
- **Costumes.** Each wardrobe entry (5.6 `costume`) is composed with the actor's own body, skin, face, hair and facial hair copied in, so it shares the actor's bones and face texture; only its clothes are rasterised, as cells of the same actor atlas, in idle time after the scene is up. `setAvatar` drops an actor's costumes.

### 6.3 Puppets

- Each piece is a quad on its bone.
- **Arms and legs are strips skinned to two bones** (8 segments each), so elbows and knees bend smoothly. Sleeves and trouser legs are wider strips on the same bones.
- **Hands** switch between shapes: open, relaxed, point, fist, hold, pinch, wave, thumb, and one to five fingers for counting.
- **Turning is a paper flip.**
  - The puppet's plane rotates about its vertical axis, and at 90° the front pieces give way to the back pieces.
  - A small turn of up to about ±30° shows the paper in perspective and stands in for a three-quarter view.
  - Facing someone in conversation is a turn of up to ±35°.
- **Walking** is a paper walk: a bob, alternating leg lifts and a lean into the direction, at the character's tempo. Walking into depth flips to the back view. Standing and walking need no profile drawings.
- **Seated side on** (owner, 2026-10-17): on a seat mark facing `side_l` or `side_r` (a bus seat seen from the aisle) a person is drawn in profile, from the moment they are mostly down until they get up. The kit draws the side view (`Kit.side`) from the composed character, not part by part: a profile head with the nose and chin in its outline and an ear, the hair and the headwear by family (short, long, tied, curly, bald; a covering, a cap, a beanie, a hat), the clothes in the worn parts' colours (sleeves long or short, a coat over the top, trousers, shorts, a skirt or a dress, long ones to the ankle, shoes), on the bones of `seatedSide` (rig/skeleton.ts: the same names, the thighs level, the shins to the floor, the hands on the lap; the far limbs `_l` drawn first and shaded). The face is a profile too (`face.drawSide` in its own box, `face.regionSide`): the near eye, its brow, a cheek, the mouth at the edge, a moustache or a beard; it blinks, looks and talks. The pieces come in draw order, with no layers, and are rasterised lazily like the back. The stage draws them face on to the camera, facing right, and mirrors them for `side_l`. Seated side on, a person makes no arm gestures (the face still acts); held props stay in the hand. A kit without `side` keeps its sitters facing front.
- **Children** hop. Toddlers bounce. Anyone told to `hop` hops: both feet leave the floor each step, the knees give on landing, shorter steps and slower (0.85 m/s).
- **Sitting** on a seat mark (§5.5): the hips come down onto the seat over 0.7 s (`SIT_MS`), the thighs come towards the viewer (foreshortened) and the floor pass bends the knees until the feet are on the floor (or hang, from a high stool); free hands rest on the thighs. The frame of a seated actor is lowered with her. The `sit` and `stand` gestures stay for a sitting down or getting up within a line.
- **A kit puppet** poses itself (`KitPuppet.pose`). Past side-on it mirrors rather than showing a back. A bird's shadow falls on its ledge, and none while it flies or hovers.
- **The animals are side-on** (a `bird` or a `cat` puppet): the director turns them by mirroring, never three-quarters or to their back, gives them no seat (a seat mark is only where they stand), and does not turn them to a mark's facing as they arrive. Only a bird perches as the narrator and flies; a cat walks at its own stride (0.28 m a step), and its paws make no footsteps. Its meow is the kit's `meow` sound, cued beside the gesture (`sfx`).

### 6.4 Faces

- Each actor has a **face texture** (256 × 256) that is redrawn only when the face changes: a blink, speech, a gaze shift, a new emotion. It goes up to the GPU with `texSubImage2D`. At rest nothing is redrawn.
- **Face parameters:**
  - for each eye: openness, the tilt of the upper lid, the raise of the lower lid (a smile's squint);
  - the pupil's position and size;
  - for each brow: the inner and outer height and the angle;
  - the mouth: open, wide, round and smile, plus teeth and tongue;
  - a blush, a sweat drop (nervous) and tears (moved).
- **An emotion** is a preset of face parameters plus head tilt, posture and an optional hand shape.
- **Mouth shapes** (8): `rest MBP A E I O U FV`. The mouth blends the emotion's shape with the current mouth shape, so a sad character still looks sad while speaking.
- The **same face code** draws SVG for the still backend and would draw the decal on a 3D head later.

### 6.5 Light and time of day

- **Presets:** `dawn`, `day`, `golden`, `dusk`, `night`, `overcast` (`render/paper/light.ts`). Each sets the key light's colour and strength, the ambient colour, the sky gradient, the rim light and the depth haze. Dawn is a cool sky warming at the horizon, a low sun, and the lamps and lit windows still on.
- **Weather** lies over the time of day (`WEATHER`, `withWeather`): `grey` and `rain` pull the sky towards grey, weaken the key light and the shadows and thicken the haze; rain also lights the lamps a little and adds its ambience bed (`rain`) to the place's. A scene's `weather` sets it, `env: "weather:<w>"` changes it over 1.5 s (`clear` ends it), and it carries from scene to scene like the time. The falling rain itself is a particle effect (§6.7). Each weather hides some of the sky (`cloud`: grey 0.9, rain all of it).
- **Lights coming on.** A flat's glow may wait for the evening to deepen: `glowAt` (0…1) is the time's glow at which it starts, over the next 0.12 (`glowWeight`), so a street's lamp and shops light first and its windows one by one (the kit's `street` splits its windows into five turns, `litByTurns`), and the stars wait for night. `env: "time:<t>:<ms>"` changes the time slowly (up to a minute): dusk falling over a city while its lights come on (s1e35).
- **The sky** (`night_sky` in the kit: stars, the moon in its phase, the city's glow, thin clouds lit from below) is made of flats marked `sky`: drawn behind everything, floors too, never blurred, moved with the camera so they stay put on screen however the shot pans or dollies (at infinity), and hidden by cloud. A flat wholly below the floor (a street seen from a roof) is drawn before the floor, which hides it. The camera sees 600 m deep (`FAR`), so a sky and a far shore can stand a few hundred metres back.
- **Outdoors** the kit has skylines in layers for the far bands (Feriköy's roofs, Şişli's towers, the old city, the Asian shore, the Golden Horn; or a street that scrolls past a vehicle's window), landmarks as stylised paper silhouettes drawn from description (Galata, Kız Kulesi, the Bosphorus Bridge, which can light red and white, the Ortaköy Mosque, the Republic Monument, Aya Triada, the Kadıköy pier, Haydarpaşa), partly self-lit at night as if floodlit, the sea in rows of paper waves with the sun's or moon's path on it, piers, railings, flags and bunting, the market, a park's edge and a church gate (`sahne-kit/src/set/outdoor.ts`; `SET.md` lists their params).
- **Lights on and off** (`env: "lights_off"`, `"lights_on"`): the place's lamps and their glow fade out or in over 0.6 s, on the speaker's gesture stroke when there is one (a hand on the switch), and an indoor room dims as much as they lit it (more at night). Street lamps, windows across the street and anything outside is not on the switch (`switch: false` on the flat or light, or on a piece in the place). The lights stay off from room to room of one site and are on again in another site. The city's lights coming on at dusk (s1e35) is the time changing, not this.
- **Thunder** (`env: "thunder"`): one flash of lightning, rising in 60 ms and fading over 0.4 s, at most one per cue (never faster than three flashes a second), with the kit's `thunder` sound. Reduced motion shows no flash; the sound carries it.
- **Practical lights** (lamps, lit windows, a phone screen) glow at night.
- Changing the time animates the light, for example the city lights coming on in s1e35.

### 6.6 Camera

- A perspective camera. Framings are computed from where the actors are:
  - `wide`, `two` (speaker and addressee), `single`, `close`;
  - `ots`: over the learner's shoulder when someone speaks to them, which puts the learner in the scene;
  - `obj`, a prop (with whoever performs, or the props alone when no one does: the bread on the counter); `follow`, an actor or Kerim in flight: a frame round the actor's live position, eased towards it every frame (cut in Still).
- Shots frame actors where they are, perched high up included.
- **Moves** ease in at most 450 ms, or cut. Under reduced motion they always cut.
- **Depth of field** is a mipmap bias by distance from the focus plane, which is cheap.
- **Split frames and phone insets** are extra viewports of the same scene, or of a second place.
- *Built:* the framings `wide`, `two`, `single`, `close`, `obj` and `follow`, the moves and the depth of field. `ots`, split frames and phone insets are planned ([README.md](README.md#status)).

### 6.7 Particles

*Built, the minimum* (`render/paper/particles.ts`): rain, steam and smoke, candle flames, cold breath, fireworks. Snow, leaves, dust in a sunbeam and confetti are not built.
- **How they are drawn.** A particle is a soft disc or a streak in its own shader mode (`MODE.particle`), a quad facing the camera's axis, written into the same buffer as everything else, so a frame is still one draw call. Each is sorted by depth with the flats and actors, so rain falls in front of and behind people; fireworks belong to the sky and go behind everything. At most `MAX_SPRITES` (400) a frame.
- **From the time alone.** Every particle's place is a function of the time and a seed, with no simulation state: the same moment always draws the same drops, and seeking is exact.
- **Rain** comes with the weather (§6.5): outdoors (`outdoor: true`) through the whole set; indoors only behind the back wall, so it shows through the windows and the door.
- **Steam and smoke** rise from pieces and props that declare `emitters` (`EmitSpec`, in cm like a light): a kettle, fresh bread, a chimney. A prop in someone's hand keeps them where they are on it as drawn in the hand (its held look's emitters, from this frame's pose): a hot glass of tea carried steams.
- **Flames** (`EmitSpec` kind `flame`, on a candle's wick): tongues of fire rising from the wick and narrowing, yellow to orange, leaning as the air moves, round a bright core that never leaves the wick, in a soft halo of light; they light themselves. Candles in a hand and a cake carried in lit burn the same; a cake with more than 16 candles keeps flames drawn in its art.
- **Breath** shows from every actor's mouth every few seconds while a `cold` state of the place is on, and once on a beat with `do: "breath"` (not a gesture: a puff on its word).
- **Fireworks** (`env: "fireworks[:n]"`, 1–6, default 3): bursts 0.7 s apart in the sky behind the set, red, white or gold, each rising in 0.12 s and fading out over 1.2 s, with the kit's `fireworks` sound.
- **Reduced motion:** rain, steam and breath run on the place's clock, so they hold still; fireworks run on the cue's and each is a still burst. Nothing flashes more than three times a second.

### 6.8 Overlays

Several kinds of HTML are laid over the stage, each positioned with a CSS `matrix3d` from the camera so it sits exactly on its paper plane:
- labels, signs and phone screens;
- speech and sound bubbles;
- the teaching overlays: case arcs, owner tags and deixis rings;
- the rings that show where to tap, and captions.

Because they are HTML, they are crisp, readable by screen readers, and tappable for a gloss, and the app's personalisation runs on their text.

- **Words on things** (`TextSpec` in `core/kit.ts`). A kit flat may carry `text`: boxes in its own centimetres with the string the kit wrote from the piece's or prop's parameters. The stage paints them into the atlas as a flat of their own (`textFlat`: a group's `text`, `paintText` in `art/shape.ts`), at a resolution that keeps the smallest about 28 px tall (less where their boxes together are so wide, six pinned ads side by side, that the flat would not fit the atlas), laid out in the page's `--sahne-text-hand`, `--sahne-text-print` or `--sahne-text-screen` (which must cover ğ, ı, İ and ş), wrapped at spaces and shrunk to fit its box. That flat is drawn just after its own, so a tree, a lamp post or a person nearer the camera covers the words as it covers the paper, and they take the scene's light (a screen, `lit: 0`, lights itself); a held prop's go with it in the hand. The art is painted again once the page's fonts have loaded. **`propText(stage)`** (`ui/prop-text.ts`) lays an invisible HTML copy of each box over it with the camera's exact plane-to-screen `matrix3d` (`flatMatrix`): real text in its own `lang`, after a hidden "name:", for screen readers; it lets taps through. A page attaches it like `interact(stage)`; the builder never loads it. The still backend draws no props, so no words on them.
- **Held props.** A held prop's first flat stands upright with its origin in the grip; the arm, sleeve and hand are drawn over it, so a phone or a cup is cradled. A flat marked `front` (the kit's sign held up, gripped just under its board) is drawn over the whole figure instead, as a thing shown to someone, and then the holding hand again, its fist round the stick.
- **Speech bubbles** sit above their speaker. The tail aims at the speaker's mouth and stops just outside the head, so it shows who speaks from any side without covering a face. With bubbles on (theatre mode), the framings leave headroom above the heads for them.
- **Tap-to-translate** is behind a flag (`glosses`, `setGlosses`). When it is on, every word of a line that has a gloss gets a dotted underline, and one tap opens a small popup with its translation; a tap elsewhere, the same word again, Escape, or the next cue closes it. The engine knows no language: the app's `lookup(word, line)` decides which words have a gloss and what it says (a dictionary form, a line per language, a note), and the app may open its own popup instead (`open`). The same `glossInto` helper fills the app's own log and reply card, so they behave the same.

### 6.9 The life of a place

A place moves on its own while a scene is up: clouds drift, a plane taxis past the terminal glass, the view goes by a metro window, straps sway, tunnel lights flick past. Any flat of a set piece or a prop may carry `move` (`FlatMotion` in `core/kit.ts`), one or more of:
- `scroll`: it slides by `dx`, `dy` every period and starts over. Seen through a wall's opening, a strip drawn a period longer than the opening is endless parallax; layers at different depths and speeds give the depth.
- `path`: it goes through a list of offsets in the place at an even speed, waits at the end, and starts over; `hide` hides it while it waits (a plane that has taken off). The offsets may change depth: the flat then comes nearer or goes away in true perspective, and the painter's order follows it as it moves (the road, lamp posts and oncoming cars coming at a taxi's windscreen).
- `sway`: it rocks about its origin and bobs.
- `blink`: it shows for a share of each period, from `at` of the way through it (two flats on one clock take turns: a walker's two strides, a gull's wings up and down).

A path may time each offset (`at`, 0…1 of its period: it eases between them and holds between two equal ones) and show only in parts of its period (`show`): a door that slides open, stays and shuts; a passenger who gets on, stands and gets off.

A motion may keep a **timetable** (`stops: {ms, run, ease}`): its own clock runs for `run` ms of every `ms`, easing in and out over `ease` ms, and stands for the rest, so a scroll or a path moves exactly as far each period as in `run` ms (`stopsTime`); `blink` keeps the wall clock. The M11 car runs on the engine's `TIMETABLE` (11 s legs, 7 s stops): the outside slows to a stop at a platform, and the doors, the display, the route strip and the passengers (`metro_riders`) follow the same periods (`sahne-kit/src/set/metro.ts`).

**A story stops the train.** A place that stops lists its `stops` (`{stations, ms?, run?, ease?, hold?}`; `PlaceDoc.stops`), and every flat that keeps its timetable reads the place's **stops clock** (`FlatMotion.clock: "stops"`) instead of its life clock. On its own the stops clock is the life clock. `env: stop:<station>` holds the vehicle at that station (any but the first, where it starts): if it is already on its way there it runs on and stays at the station's held moment (`hold`, 4.5 s into the stop: doors open, the new passenger aboard), else it jumps to the start of the leg to it (pulling out of the station before) and rides it in, 11 s to the platform, so it reads best right after a cut; `env: depart` runs it on from there (the doors shut and it pulls away). A scene's `stop` opens it standing at a station. A bare `env: stop` halts it where it is, between stations (a jam: it slows to a stand over 2 s, doors shut), and `depart` gets it going again over as long. The İETT bus keeps the same timetable (`cabin` bus with `stops` and `stations`, a `bus_stop` layer coming in at each stop, the traffic and the skyline on the stops clock); its door leaves also slide aside for an entrance or an exit through its door mark (`FlatSpec.slide`). The hold is in the world (`World.stops`), so it lasts through the cues that follow and ends with the place; the stage keeps the clock (`stopsClock` in `stage.ts`), and reduced motion shows the held station. Nothing else waits: the straps, the train alongside and Kerim's pacing keep the life clock. The place lint holds each piece's timetable and stations to the place's; the story lint, each `stop` to a station.

Every kind loops from its `phase`. The place has its own clock, which runs while a cue plays or a line is voiced, and otherwise with idle life (half speed in `calm`), pausing when idle life stops, so nothing jumps. A place with `life: "run"` (a vehicle: the M11 car, the taxi, the ferry) keeps its clock going for as long as it is on stage, at 30 frames a second when nothing else moves, so the view outside never freezes. Kerim at an air mark with `pace` (outside the train's window) flies along: her wings beat and she drifts a few centimetres about the mark, on the place's clock, instead of hovering; reduced motion (`still`) holds every flat where it starts, so a place must read well frozen. The position is worked out when the flat is drawn (`anim/move.ts`), so moving flats are hit-tested, cast text and are framed like any other.

A flat may show only **`when`** the weather, the time of day or the place's states say so (`{weather?, time?, state?}`, each list given must hold), fading as they change (`whenWeight` in `src/script/world.ts`): an umbrella opens with the rain, a passer-by is home by night, a little flag comes out on the holiday. A flat with **`pick: false`** is never hit-tested, so a tap goes through it to what is behind.

**Crowds** are kit pieces (`crowd` in `sahne-kit/src/set/outdoor.ts`, drawn by `people.ts`): faceless paper people, seeded, never tapped, in five kinds: walking lanes (each walker on their own pace, the legs and the near arm in two strides that take turns, a bob), standing groups, a queue, people sitting, and a far strip of small people that scrolls. They keep clear of the marks people stand on and stay under 40 near the camera (the place lint's `crowd` rule). Birds (`birds`: pigeons pecking, gulls crossing) and cats (`cat`: sitting, walking, asleep, a loaf) are pieces and props of the same family. Extras who act are cast.

A flat may **react** to people (`FlatSpec.react`, `FlatReact`), and remember it. `flee`: whenever someone comes within `r` m of where it is, it goes `away` m along x away from them at `speed` m/s, up to `lift` cm high mid-way, and stays where it lands; as it lands it looks again, so a walker who keeps coming sends it on ahead (`flights` in `src/anim/react.ts`). The stage works this out by replaying where people walked in this place since its scene began (its performances, scripted or acted: `peopleSamples`), never from the clock, so seeking and replaying land in the same state, and a new scene in another place starts everything at home. `show` draws a flat only at `rest` or only while it is `away` (going), and `face` only while it goes that way, so a thing changes its look as it goes; `asleep` and `awake` draw it only while its head is down or only while it is turned (a sleeping dog's shut eyes, then its open ones as it looks up). `look` turns it by up to `turn` radians about a `pivot` towards anyone within its `r`, while it rests (`r` 0: only a tap turns it). A kit puppet (Kerim) does not count; reduced motion keeps everything at home. Pigeons take off from anyone within 1.3 m (a flying flat with two wingbeats each way) and land 1.4 m off; a sitting cat turns its head up to anyone within 2.5 m, and from one within 0.9 m gets up, walks 1.1 m off and sits there; a sitting, standing or lying dog turns its head up to anyone within 2.4 m, and a sleeping one sleeps on (`react: false` holds either). All the flats of one animal share its `home` (its spot in the piece), so they react as one. The reaction moves the flat where it is drawn, so taps and text follow it; `tap` makes it answer a learner's tap in explore (§9): `hop` (a flutter where it is, 0.9 s) or `look` (its head up for 1.4 s), with a kit `sound`, never part of the performance.

## 7. Animation

- **One clock.** A single `requestAnimationFrame` loop runs only while something animates. Tweens use eased curves and springs.
- **Layers per actor:** the base (stand, sit, walk), the gesture (upper body, masked), the face, the look-at, and the procedural layer (breathing, blinking, sway, springs). Gestures are keyframed poses with an easing per key, written as plain data in the kit.
- **Stairs.** A walking leg that rises or falls more than 10 cm is taken in risers of about 18 cm (`stairSteps`): the body rises early in each step and the foot is planted on the tread, the stepping knee comes up higher (most going up), and the body leans into the climb. Its height counts 1.2 times over in the walk's length, so a climb is slower than the flat; a step on the stairs is one riser. `cam: "follow"` keeps the climber in frame; a place's wide shot can be raised to show a whole stairwell (`camera.wide.y1`, §5.5). The kit's `stairwell` has 18 cm risers and 28 cm treads, and its doc comment gives where the marks go (foot, top, landing of each flight), so each of a flight's steps meets a riser.
- **Round, not through.** The director bakes a walk's way into it (`route` in `src/director/route.ts`, with the place's `placeSolids` in `DirectCtx.solids`): each leg on foot (walk, run, hop, and an entrance's or exit's legs on the stage side) that would cross a solid line goes round it, through a gap or round the line's end, on the shortest way that keeps `CLEAR` (25 cm) from every line, turning just past each end. Ties go the same way every time, and each turning point's height is taken along the leg, so a climb stays a climb and seeking stays exact. Only the door's own leg (its `out` to the door mark, or back) passes the gate's or door's leaf. A bird flies over everything. Without solids (a director given none) walks go straight. The story lint walks the same router: a detour is a `route` warning, no way at all an error; the place lint's `reach` rule checks that every mark people stand on can be walked to from the first door mark (out through that mark's own door too, to the pavement outside a shop), and warns of a mark standing in a line.
- **IK.** Two-bone IK in the puppet's plane aims `point`, `give`, `take` and `touch` at any target. A 3D target is projected into the plane first.
  - The plane loses the stage's depth, so a thing in reach is never pointed past: the hand comes from just above and outside it, the elbow up and out, and the finger ends on it (İsmail's loaf on the counter).
  - Hands raised to the face (eat, drink, think, shush, phone) are drawn in front of the head in the front view.
  - A gesture's sizes (`dy`, `headDy`, reach `off`) are an adult's and scale with the body.
  - A hand that holds a prop carries it (the forearm across the waist, the prop in the crook of the arm). Gestures are written from the arm at rest, so the carry gives way while a gesture moves that arm and comes back after it.
- **Timing to words.** A gesture's stroke meets the word that motivates it: the staging field `on`, else the last mention of the word linked to its target ("Şu **ekmek**"), else the first word. A *yok* hides its prop on the stroke (or the last word); a *var* shows it as it is named. A hand-over is timed so "Buyrun!" goes out with the hand.
- **Principles,** as in the 2026-10-08 draft:
  - anticipation before a point or a step;
  - hands travel on arcs;
  - springs settle, well damped for calm characters and livelier for lively ones;
  - the head leads and the hand settles last;
  - holds keep breathing;
  - a blink on a head turn;
  - timing set by each character's `motion` profile.
- **Lip-sync.** A mouth track comes from the voice provider's marks when it has them, and otherwise from the language plugin's estimate. For Turkish that is about 200 ms per vowel at A1 pace, plus a pause at commas and full stops, scaled by the speech rate.
- **Deterministic.** Random idle motion uses a seed per actor and cue. A run supports `seek`, `finish` and `pause`.
- **Motion settings: Full, Calm, Still.**
  - Reduced motion means Still: key poses with short cross-fades, and cuts instead of camera moves.
  - Phones with `deviceMemory` ≤ 2 or `hardwareConcurrency` ≤ 4 start in Calm.
  - Idle life stops after 20 s without input, and whenever the stage is hidden or off screen.

## 8. Audio

### 8.1 Engine

- **Four buses:** voice, effects, ambience and music. Each has its own volume, and while a voice speaks, music goes silent and ambience goes down to about half (*ducking*). Music therefore never plays under speech.
- **Unlocking.** The audio context opens on the first tap after sound is turned on, sleeps while the page is hidden, and wakes on the next tap. Where Safari supports it, `navigator.audioSession.type = "ambient"` makes the iPhone's silent switch silence effects and music, so a phone in class stays quiet. Under `ambient` the switch also silences recorded voices (§8.4), which play through the same context; whether it silences the browser's speech is unverified. An app may pass `audioSession: "playback"` instead, which plays through the switch but pauses the device's other audio (a podcast); Kumru chooses when it adopts Sahne, on a real iPhone.
- **Off by default.** Sound is off until the learner turns it on (`setSound`), and the app remembers the choice.
- **What a performance plays,** planned by the director with everything else and kept in the timeline:
  - the script's `sfx`, at their cue time, panned towards where they come from;
  - **automatic sounds** from the staging: a footstep each time a foot lands (on the place's `surface`), a door opening and shutting, and the paper flip when a character turns past side-on;
  - the narrator's own sound before she speaks (Kerim's coo), not again on her next line in a row;
  - a place's `motif` when the story moves there from another place (the first scene has the app's opening theme instead).
- **Ambience.** A place's `ambience` loops quietly while a scene is there, crossfading at a change of place.
- **Skips.** *Devam* mid-performance stops the voice and drops the sounds not yet played: nothing is played late.
- **In Still motion,** the picture is the end pose, but the voice and the script's sounds still play from the start; the automatic sounds are left out.

### 8.2 Synthesized sounds

- **Rendered in code.** A patch is a small graph written in the kit: voices with a source (oscillators, noise, Karplus–Strong plucks, FM, or decaying partials), an envelope, state-variable filters and LFOs (`audio/dsp.ts`).
  - The engine renders a patch into samples itself, instead of building Web Audio nodes, so the same patch and seed give the same sound in every browser and in Node, and the tests check it.
  - Each sound is rendered once per take, in idle moments after a script loads, and then played as a buffer. Ambience is rendered as a seamless loop.
- **Takes.** A sound may have several takes, played in turn, so repeated sounds vary (footsteps). Parameters such as a footstep's `surface` (stone, wood, tile, carpet) come from the cue or the place.
- **The first kit's sounds:** the clock's tick, a knock, the shop's doorbell, a door opening and shutting, footsteps, a kettle, a tea glass on its saucer, a spoon in a glass, a gull, the tram bell, the metro's door beeps, a ferry horn, a phone ringing, a message, a camera shutter, a page turning, the **paper flip**, **Kerim's coo** and a UI tap; ambience loops of rain, wind, waves, a far crowd, traffic, a street heard from indoors and a fridge's hum. For Kumru's A1 places: applause, a beak tapping, the kombi's beeper, bus doors, church bells, children and neighbours singing, coins, a glass door, fireworks, keys, knitting, a marker, a market call, a meow, a dog's bark, queue chimes and a ticket printer, an oven door, a pen, a plane, a quiz bell, scissors, a shop chime, thunder, a toolbox, a metro train arriving, a trolley, a gust and wings; ambience loops of a bus, a taxi, a ferry's engine, school corridors, an empty room, football on the radio, a metro car running and a library's whispers. Voices are textures (formant-filtered tones and noise), never words. `packages/sahne-kit/STYLE.md` has the sound rules.
- **The gallery's sound sheet** (`#/kit/sound`) draws every sound, take and motif as a spectrogram over its waveform, with a play button.

### 8.3 Music and recordings

- **Music motifs** come from a tiny step sequencer (`audio/motif.ts`): tracks of notes written as text, one token per step (`D4 . F#4:2 - G4!`, `~` for a quarter tone flat, lower-case words for drum strokes), played by the kit's instruments: code that turns a note into synth voices.
- **The instruments:**
  - a plucked string close to a *bağlama*;
  - a soft pad and a bell;
  - a breathy flute close to a *ney*;
  - a frame drum.
- **The motifs:** Kerim's theme, one per family of places (home, school, street, sea), and a short stinger at the end of a story. Music plays at scene changes, at the start and at the end, and never under speech.
- **Recorded CC0 sounds** are for what synthesis does poorly. The first four (2026-10-09) are the gull, the ferry horn, traffic and a crowd, three of them recorded in Istanbul; the *ezan* far away may follow if the owner wants it.
  - A kit sound names its recording (`recording: {file, loop?}`); the app serves the kit's sound folder and passes its URL (`sounds`). The recording plays wherever it loads, and the sound's patch stays as the fallback, and for the tests and the gallery's pictures.
  - Each file is mono AAC at 64 kbps, at most 80 KB, cut by `packages/sahne-kit/sounds/build.ts` from a source kept in `sounds/library/` (local only), and listed in `sounds/SOURCES.md` with its source, author, licence and date.
  - A loop's file carries a quarter second of the loop on both sides of its loop points, so the seam holds even where a decoder shifts the samples by its padding.
  - Recordings load in the background when a script that uses them is loaded, and are precached. The total budget is about 1.2 MB (the first four are 214 KB).
  - Each download is approved by the owner first.

### 8.4 Voices

- A `VoiceProvider` speaks a line and reports when it starts, each word it reaches, and when it ends: `speak(text, {lang, who, spec, rate, whisper, volume, out, onStart, onWord, onEnd})`. `who` is the speaker's actor id; `out` is the voice bus's input (`AudioEngine.voiceOut`, null before sound is first on), for a provider that plays recordings through Web Audio, whose bus already applies the voice volume (`volume` is for a provider outside Web Audio).
- `speak()` may return `null`: the line is not voiced here (no clip and no fallback voice). The stage then keeps its own timing for that line, exactly as with no voice at all, and no callback comes.
- **The voice keeps the time.** A performance is planned on the language plugin's estimate of each word. While a line is voiced, the stage's clock follows the voice instead (`audio/clock.ts`):
  - it waits at the line's start until the voice starts;
  - it moves at the voice's pace and catches up at each word mark;
  - if the voice is behind, it waits at the next word, or at the line's end.

  So mouths, gestures and everything after the line stay on the words. A voice that gives no word marks only moves the end. A voice that never starts lets go of the clock after 2.5 s.
- **Now:** the browser's speech (`browserVoice()`), with each character's `rate` and `pitch` and the cue's tempo, and word marks where the browser gives them. A whisper is quieter; `mouthing` and `silent` lines are not voiced.
- **Next: neural voices** (the `sahne-voice` package, not in this repo yet). Each line's audio is generated at build time, inside a provider's free tier, uploaded to a public bucket and found by its speaker, text and rate; a provider of recordings plays it into `out` and reports word marks scaled from the language plugin's estimate. Marks only steer the clock: mouth shapes always come from the estimate. A character's `voice.neural` names its voice.

### 8.5 Captions

- Every sound in the kit has a **sound word** in each language the kit supports: *tık tık*, *çın çın*, *düüüt*, *şırıl şırıl*. A script's `sfx.word` overrides it.
- The word appears as a bubble where the sound comes from **while sound is off**, and also when the learner turns captions on (`setCaptions`). Turkish sound words are language content too, so they are glossable.
- Automatic sounds and ambience have no bubbles.

## 9. Interaction

| Mechanic | What happens | Where it lives |
|---|---|---|
| **Say** (reply card) | The learner picks or confirms their line, and the stand-in performs it | Card: the app. Performance: the engine |
| **Act in the scene** | `tap` a thing or person, `drag` a prop to someone, `go` to a mark, or `choose` on stage between two things | Engine (`interact`, `stage.play` of an `act` cue) |
| **Say it aloud** | The reply card listens through the browser's speech recognition, and the plugin's normalising decides whether it matches. A tap always works. Hidden offline and where the browser has no recognition | `sahne/listen` (optional module) and the language plugin |
| **Explore** | Tapping any person or prop raises `inspect` with its `terms`. The app shows the word. An animal answers a tap too (`FlatReact.tap`, §6.9): a pigeon flutters up where it is (`wing_flap`, "pır pır"), the cat looks up and miaows (`meow`), a dog looks up and barks (`bark`, "hav hav"), waking first if it sleeps; this plays on the wall clock (`Stage.tapFlat`, from the hit's `poke`) and leaves the story as it was | Engine event, app gloss |
| **Unlockable items** | Kit parts can carry an `unlock` id. The app passes the unlocked set, and the builder shows locked items with how to earn them | Kit, builder, app rules |

**Rules:**
- **No right-or-wrong buzzers.** Characters react, as with choices.
- **An act never blocks.** After two misses, the target is hinted with a gaze or a glow. After three, it is shown and the story goes on.
- **Every act has an accessible alternative:** a list of buttons for keyboards and screen readers.
- **Hit tests** cast a ray against piece quads and check a low-resolution alpha mask taken from the atlas, so taps on transparent corners pass through.
- **Floor points.** `Stage.floorAt(x, y, height?)` casts the same ray against the level plane (`rayFloor`): the floor point under a CSS pixel, where an editor drops a mark (sahne-backstage). Marks themselves are not pickable.
- **Each story week chooses its mechanics.** The engine never assumes one is on.

**How it is built (B5).** The interaction layer is attached to a stage, not part of it, so the builder and the lists never load it: `interact(stage, { explore, list, focus, words })`, before `load`.
- **An act cue** is `{act: {kind, targets, expect?, prompt?, who?, by?, obj?, cam?, result?}}`: `who` is the learner's actor, `by` whoever asked, `obj` the prop a drag moves. `stage.play(i)` of an act with no `result` returns an `ActRun`: the camera frames the stage (`wide` unless `cam`), and the stage waits. `run.result` resolves with `{target, misses, hinted, shown, tries, via}` when the learner answers; the answer is then written into the cue (`result`), the cues after it are directed again, and the answer is performed: a tap or a choice is pointed at, a drag goes into the person's hands (out of a hand: a give; from where it lies: a take) or onto a mark (`obj` `place`), a go walks there. `run.done` resolves when that performance ends. So `fold` stays a pure function of the script, answers included, and an app can store them to replay a story. Without the layer, an act cue performs its `expect`.
- **Tries.** A try on one of the act's targets that is not `expect` is a miss, counted and nothing more; a tap on anything else is ignored (and is an `inspect` when explore is on). The second miss is the hint: whoever asked (or everyone else on stage) looks at the answer, and it glows. The third shows it: a stronger glow and a point, and after about a second the act completes with it (`shown`). A choice without `expect` takes any of its targets. `run.skip()` completes with the answer shown; `run.answer(t)` tries for the app.
- **Events:** `inspect` `{target, kind, id, part?, of?, terms, name, via, x, y}` for a person (`ch:ismail.hand`), a prop (`obj:ekmek#1`, `of: "ekmek"`) or a set piece with `terms`; `act` `{phase: ask | miss | hint | show | done, cue, act, target, misses, result?}`. Terms come from the place's props, the pieces and `LoadOptions.terms` for the cast; names from `LoadOptions.names` (by actor id or by target, `obj:sut`, `mark:customer`).
- **Hit tests.** Each frame records its quads in drawing order (`stage.picks`, while a layer is attached); `stage.bounds(target)` turns them into a target's box on screen (the gallery's camera check frames each place with it); a ray from the camera is tested topmost first, and a quad with art is checked against its layer's alpha mask, pooled 4× smaller from the atlas (each cell its most opaque pixel) in a task per layer after the upload (about 10 ms for a 2048 layer), with lazy pieces added as they are drawn. Glass and transparent corners pass through (alpha under 55%). A finger gets slack: a tap on the set looks around it, nearest first, within 26 px for touch (8 for a mouse); a drop takes the nearest person whatever is drawn over them, so the milk lands on İsmail over the bread on his counter.
- **Drag.** The prop follows the finger in its own depth plane, drawn over everything, with the person or mark under it ringed; dropped nowhere it goes back, uncounted.
- **Rings** are HTML over the stage (section 6.8), placed from the last frame: dashed spots for a go's marks (they are buttons too) and a choice's two things, the hint's slow glow, the shown answer, a short ring for a tap that landed. No colour means right or wrong. In Still they do not move.
- **The accessible list** is the act's targets as buttons (a drag's read "süt → İsmail"), or with explore on, everyone and everything on stage. It is hidden until the keyboard reaches it (`list: "auto"`) or always shown; `ix.focus()` moves focus into it, and an act that starts while focus is on the stage takes it there. After an answer from the list, focus goes back where it was, else to the stage. The prompt, the hint and the shown answer are announced politely.

**Say it aloud** (built 2026-10-10):
- `canListen()` is false without `SpeechRecognition` (or `webkitSpeechRecognition`), outside a secure context, offline (Chrome's recogniser is a server), and after the learner refused the microphone. The card hides its microphone then; `cannotListen()` says why.
- `listenFor(expected, plugin, {signal, onInterim})` listens once in the plugin's `locale` (`tr-TR`) with interim results and five alternatives, stops early when the words so far already are a line, gives up after 6 s of silence or 12 s in all, and resolves `{matched, best, heard, score}` or an `error` (`no-speech`, `denied`, `network`, `aborted` …). It never rejects.
- **The matching is the plugin's** (`matchLine`, built per language on `lineMatcher`; `sahne-tr` is the first): both sides become spoken words (Turkish lower case, numerals in words, no punctuation or fillers like *ıı* and *hmm*), then a word-level edit distance weighted by letters. It forgives a recogniser's joins and splits (*varmı*, *hoşgeldiniz*), a dot or cedilla (*mi* for *mı*), an extra word before the line, and the learner's name (any one or two words). The allowance scales with length: none in a word of three letters, one letter in a short phrase, about one in six beyond. A different word never passes: *İki ekmek ver* is not *İki ekmek, lütfen*. Every n-best alternative is tried; on a choice, the closest option within its allowance is the pick.
- **The matcher is shared.** `lineMatcher({normalise, near, fillers, spellings, soft})` (`src/core/linematch.ts`, exported from `sahne`) is the language-blind part: the word-level edit distance, the joins and splits, names and the allowance. A plugin supplies `normalise(said): string[]` (its tokenising, lower case and numerals in words), `near` (letters that are nearly the same, each to the letter it folds to: Turkish `ı→i ş→s ç→c ğ→g ö→o ü→u`, German `ä→a ö→o ü→u ß→ss`, English none), `soft` (letters barely said, Turkish `"ğ"`), `fillers` (a RegExp tested on one word) and `spellings` (a heard word to its usual form, possibly several words). It returns `{sayWords, normalise, letters, allowance, matchLine}`.
- Size: 1.4 KB gzip for `sahne/listen`; the matcher adds about 2 KB to the plugin.

## 10. Avatars and the builder

- **New avatars.** The avatar document (5.2) replaces today's eight-index `char`. Old avatars are dropped. The first time the new builder exists, the app asks every learner to design a new character, and until they do, lists show a neutral paper silhouette.
- **The builder:**
  - A headless model holds the state, the options per slot (filtered by compatibility and unlocks), randomising and undo.
  - The default UI has five sections: Body, Face, Hair, Clothes, Extras.
  - The preview is live, on the paper backend: idle life, a tap plays a gesture, an emotion strip shows the face acting, and a turn button flips the character to show the back.
  - **The default screen** is `mountBuilder(host, options)` (`ui/builder.ts`, its stylesheet in `builder-css.ts`, its pure decisions in `builder-plan.ts`). It is generic: no app names, no network, no storage.
    - **Layout.** The preview on top below 720 px of the builder's own width (a container query), beside the panel above it. Under the preview: the emotion strip, the learner's own face in each emotion. Over it: undo, redo, the dice and *start over*, and the turn button. Below: the five tabs, the panel, then *Cancel* and *Done* when the host passes `onCancel` and `onDone`.
    - **Options** are thumbnails of the character wearing them (`portrait(builder.preview(field, value))`), framed for the field (head for the face, hair and what sits on the head, bust for tops, jackets and the neck, whole for the rest). They are drawn in slices of 10 ms, the ones in view first, so no task runs long. Colours are paper discs named for screen readers; a part with several colours picks which one first. Patterns are thumbnails; a one-sided part gets a side choice; face marks are toggles; height is a slider that previews while it moves and commits once.
    - **The preview follows the work:** the framing goes with the tab (whole for Body and Clothes, head for Face and Hair, bust for Extras) and then with the field being changed. Without WebGL2, with a lost context or with `preview: "still"`, the still portrait stands in and is redrawn on every change, emotion and turn included. Reduced motion (or `motion: "still"`) shows end poses and no gestures.
    - **What is offered** is the host's to decide. A learner (`mode: "learner"`, the default) sees the kit's learner parts narrowed by the host's `offer(field, value, kind)`, a starter set, so a first visit is a few choices per field, not 125 parts. The kit's starter set is curated with everything else (`starter` in `sahne-kit/src/curation.ts`) and handed over as `starterOffer`: a few parts per slot, modest, faith and access items always among them, 13 fabrics spread across the colour families, and every skin, hair and eye colour so identity is never narrowed. What is not offered is absent, not locked; the randomiser picks only from it; `more: true` adds a *More* button that opens the rest of a field. An author designing the cast (`mode: "author"`) sees every part, the cast's own and the hidden ones marked, with a trusted document; a list of 16 or more gets tag filters.
    - **Throwing work away:** *Cancel* and *start over* ask the host first through `confirm(action, doc)` when the character has changed (Kumru answers with its confirm sheet); *start over* can be undone either way.
    - **Locked** options show a lock and how to earn them (`unlockLabel(token)`, or a generic "not unlocked yet"), cannot be picked, and say so in the field when tapped.
    - **Accessibility:** tabs with arrow keys, every option list a radio group (marks a group of checkboxes) with one tab stop and arrow keys, Ctrl+Z and Ctrl+Shift+Z, a polite live region for undo, the dice and locks, 44 px targets, a visible focus ring, readable in light and dark (`theme`, or the system), no horizontal scroll at 360 px.
    - **Theming:** the `--sb-*` custom properties on `.sahne-bld` (paper, ink, accent, focus). The stage stays a lit world and is only dimmed in the dark theme.
    - **Words:** the kit's labels for sections, fields and options; the screen's own (buttons, emotions, notes) in English and Turkish, which a host can replace (`words`).
- **Portraits** for lists, profiles and story tiles come from the still backend as SVG, framed at head, bust or full. They are cached by the document's hash and drawn at 28–120 px. A list of 50 friends never starts 50 renderers.
- **Range of the first kit** *(proposed)*:
  - 12 skin tones;
  - hair textures: straight, wavy, curly, coily, braids and locs;
  - facial hair, glasses and sunglasses, a hearing aid;
  - headscarf styles;
  - tops, bottoms, dresses, outer layers and shoes in several cuts;
  - jewellery, bags and a few signature items to unlock.
  - **Open:** mobility aids (a wheelchair changes walking and sitting, so it comes after the first kit).
- **Kumru changes,** in the same commit as the code:
  - Kumru's `docs/SPECS_SCHEMA.md` documents the new `char`;
  - onboarding uses the new builder;
  - the old `AV_*` and `CH_ART` art is removed (the cast art, `SCENES` and the old stage, story reader and talk screen are already gone: Kumru's restructure deleted them and left `app/features/stories` as a placeholder; `AV_*`, `CH_FALLBACK` and the default portrait remain in Kumru's `app/ui/avatar/` (`parts.ts`, `meArt.ts`, `portrait.ts`) until Kumru adopts Sahne).
  - Kerim's `pup()` stays the app mascot. Her art lives in the kit (`packages/sahne-kit/src/kerim/art.ts`), which the app imports; her stage puppet is generated from the same paths (`packages/sahne-kit/kerim/build.ts` → `src/kerim/art.gen.ts`, with her CSS, `sahne-kit/kerim.css`), so the mascot remains the single source.

## 11. The path to procedural 3D toon

Designed now, built only if the owner decides to move:

- **The contract between scripts and backends is semantic:** ids for gestures, emotions, mouth shapes, targets and framings, never bone angles or pixels. Scripts, avatar documents and place documents do not change.
- **Space is already 3D.** Marks, props, lights and cameras are in metres.
- **Skeletons share bone names.** Each backend has its own pose library for the same gesture ids.
- **Faces stay 2D** on both backends: the face texture becomes a decal on a 3D head.
- **Migration is gradual.** A kit part gets a `toon3d` generator beside its `paper` one, and a scene may mix the two (a 3D set with paper actors) during a migration.
- **Bytes.** A 3D backend would probably bring a WebGL scene library (about 130 KB gzip for three.js today). It would be loaded only by that backend.

## 12. Performance budget

Mid-range means a Galaxy A15/A25-class phone; low-end means Android Go with 2–3 GB.

| Item | Budget |
|---|---|
| Engine and Turkish plugin | ≤ 150 KB gzip (raised from 60 KB by the owner, 2026-10-10; 92.6 KB with B5's interaction and listening) |
| Kit code (parts, poses, patches, motifs) | ≤ 150 KB gzip (raised from 80 KB by the owner, 2026-10-10; batch 1 is 110 KB; 123 KB with the airport and metro sets, 106 KB once the set left it on 2026-10-13) |
| A set family (`sahne-kit/set`), loaded when a story's places use it | ≤ 40 KB gzip each, measured without the kit code it shares; a family that outgrows it splits. The whole set is reported, not held |
| Kerim's puppet (`sahne-kit/kerim`: her art, moods and gestures), loaded only by pages that cast her | ≤ 8 KB gzip |
| The animal puppets (`sahne-kit/puppets`: Pisi and the gulls), loaded only by pages that cast them | ≤ 8 KB gzip (4.6 KB) |
| What an app loads for its lists: `normalize` and `portrait` | ≤ 20 KB gzip (15 KB) |
| What an app loads for its builder: `mountBuilder` with its stage | ≤ 100 KB gzip (80.3 KB; raised from 80 on 2026-10-13) |
| All A1 places (28) | ≤ 100 KB gzip |
| CC0 recordings | ≤ 1.2 MB in all, ≤ 80 KB each |
| A portrait at list size (96 px), p90 of random characters | head ≤ 9 KB, bust ≤ 12 KB, whole figure ≤ 22 KB (kit batch 1: medians 7.6, 10.2 and 18.7 KB) |
| Texture memory per scene | ≤ 70 MB (raised from 48 MB by the owner, 2026-10-12): the cast and two places at most (6.2); s1e01 45 MB at each of its three places, two 2048 layers and the faces, against 67 MB when the stage held the whole story |
| Building a scene's atlases | ≤ 150 ms mid-range, ≤ 400 ms low-end, once per scene |
| Frame rate | 60 fps mid-range, ≥ 30 fps low-end; ≤ 4 ms of CPU per frame mid-range |
| Advancing a cue | no long task over 50 ms |
| At rest | no frames drawn; a running place (`life: "run"`) at 30 frames a second |
| Actors on stage | up to 12 with full rigs (s1e48); silent extras beyond that are drawn as simplified puppets with no face redraws (*planned*) |
| Crowd people | at most 24 per crowd piece and 40 near the camera per place (a walker is 3–6 flats); far strips are one flat each |

What Kumru actually loads, with the kit counted (checked by every Kumru build, its `scripts/vite/page.ts`): the entry ≤ 85 KB gzip with no Sahne code but Kerim's art; the portraits' bundle ≤ 150 (143.6 on 2026-10-25); the builder ≤ 240 beyond what the entry carries (216.9); the story player ≤ 265; each set family ≤ 40.

The code budgets are measured by `node packages/sahne-gallery/size.mjs` (part of the gallery's `pnpm check`): each package bundled and minified on its own, then gzipped.

## 13. Accessibility

- **The stage has a caption track.** Each cue's staging is described in a sentence through templates the app supplies in its language ("İsmail points at the bread", "The milk is gone"). It is announced politely and shown when the learner turns captions on.
- **Nothing needs sound.** Lines are text, and sounds have sound words.
- **Nothing needs motion.** Still mode shows end poses.
- **Nothing needs a pointer.** Acts and explore have button lists.
- **Text** in the scene is real text, so zoom and screen readers work.
- **No flashing** more than three times a second (WCAG 2.3.1). Pause, stop and hide are covered by the motion settings (WCAG 2.2.2, 2.3.3).

## 14. Testing and review

- **Node tests** cover the pure modules: `fold`, the director's defaults, the timeline, IK, springs, the schemas, `compose` and its slot rules, and the Turkish mouth timing.
- **Golden frames** (`packages/sahne-gallery/golden.mjs`, baselines in `golden/<platform>/`: `darwin` for a Mac, `linux` for CI, as the two draw a few percent of pixels differently). Headless Chromium with software GL shoots fixed scenes of the gallery: five cues of s1e01 at their end pose and the bakkal's contact sheet. Each is compared pixel by pixel with its baseline: a pixel differs when a colour channel is off by more than 24, a scene fails above 0.4 % differing pixels, and a failure writes `golden/failed/` (the shot and a red diff). `pnpm sahne golden:update` rewrites this machine's baselines (`--only <name>` for some); the Linux ones are the CI artifact's shots (a missing baseline uploads its shot), or, when the artifact cannot be uploaded, shot in an x86_64 `node:24` container with `fonts-comic-neue` installed, as CI installs it (the signs' handwriting font; without it Linux falls back to whatever `cursive` maps to). Fonts and Chromium builds differ between machines, hence the tolerance; baselines are regenerated only on a deliberate look change. *Planned:* every part × view, emotion, gesture, light preset and place, as the run time allows (now about 15 s).
- **Determinism.** `determinism.mjs` bundles every package twice, in separate processes, minified or not with source maps, and fails unless the outputs are byte-identical.
- **The art loop.**
  - The agent renders contact sheets in the Browser pane and checks them against `STYLE.md`: a distinct silhouette at 48 px, colours apart from others in the same scenes, faces readable at phone framing, the edge and shadow consistent.
  - The owner approves each set of parts once, not story by story.
- **Performance.** The gallery has a readout (frame time, draw calls, texture memory, atlas build time) and a 6× CPU throttle run in Chrome.
- **`pnpm sahne check`** runs the types, every package's Node tests (the kit manifest among them: every id unique, every part renders at every build and shape without errors) the bundle sizes against the budget (`size.mjs`), the determinism of the bundles, the story check and the golden frames. It runs in the root `pnpm check` and in CI (the `sahne` job).

## 15. Milestones

The engine's build steps are done and kept below as a record (B0–B5, formerly M0–M5). What Sahne does next is planned with Kumru, its first app.

### Done: the engine build (2026-10-09 → 2026-10-10)

| # | Build step | What the owner saw |
|---|---|---|
| B0 ✓ | Scaffold: the packages, the typed formats, the gallery shell | An empty gallery |
| B1 ✓ | **The look:** the paper renderer, one set (the bakkal), Nima and İsmail as static puppets, light presets, the camera | The two characters in the bakkal at day, golden hour and night |
| B2 ✓ | Rig and acting: bones, IK, gestures, faces, emotions, lip-sync, the director, the timeline | The bakkal test scene (Kumru's `STORIES_STAGE.md` §10), played with both choices |
| B3 ✓ | Audio: the engine, the first patches and motifs, captions, the browser voice | The same scene with sound |
| B4 ✓ | Avatars: the kit's first batch (125 parts of a 433-part plan, curated in `sahne-kit/src/curation.ts`), the builder (engine and screen, a starter set, author mode), SVG portraits, Kerim redrawn; the app's part moved to Kumru | The builder and the catalogue in the gallery |
| B5 ✓ | Interaction (act, explore, hit tests), say it aloud, the story adapter and its lints (`packages/sahne-story`), Kumru's s1e01 written; the in-app reader moved to Kumru | s1e01 played end to end in the gallery (today the sample s1e00 too) |

## 16. Open questions

1. Whether to publish the packages to npm (they stay private in the workspace for now).
2. Mobility aids for avatars (after the first kit).
3. Whether learners may pick free colours beyond the palettes.
4. Whether music may play softly under a scene, or only at scene changes and the end.
5. Whether a recorded *ezan* belongs in the ambience of any place.

Questions about places (sub-spaces, the kit budget, weather scope, landmark fidelity, festive dressing) are open; ask in an issue.
