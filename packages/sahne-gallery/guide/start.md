# Your first scene

A scene in Sahne is a **script**: a list of cues. The first cue sets the place, the time of day and who stands where. Every cue after it is a line, a beat of staging, or something the learner does. You don't animate anything yourself. The **director** turns each cue into a performance: it picks the gaze, the gestures, the timing, the camera shot and the sounds. The **stage** then draws that performance with cut-paper puppets, in WebGL2.

This page walks through one short scene. In the [gallery](https://sahne.shab.boo), each script block below plays live; on GitHub it shows as JSON.

## 1. Mount a stage

A stage needs a kit (the art: people, set pieces, props, sounds) and, for speech, a language plugin. The plugin times the mouths from the spelling.

```ts
import { mountStage } from "sahne";
import kit from "sahne-kit/full";
import tr from "sahne-tr";

const stage = mountStage(document.querySelector("#stage")!, { kit, lang: tr });
```

The stage fills its element, so give the element a size (say `aspect-ratio: 16 / 9`). Sound stays off until the page turns it on from a tap: `stage.setSound(true)`.

## 2. Load a script with its place and cast

The place is a **place document**: its set pieces, its marks (where people can stand), its light and its sounds. The cast are **avatar documents**: a few hundred bytes of JSON each, built from the kit's parts. The formats are in [DESIGN.md §5](../../sahne/DESIGN.md#5-formats).

```ts
stage.load(script, {
  cast: { nima: NIMA, ismail: ISMAIL },     // avatar documents
  places: { bench_shore: SHORE },           // place documents, by id
});
stage.show(0);                              // the opening, still
for (let i = 1; i < script.cues.length; i++) await stage.play(i).done;
```

`play(i)` returns a `Run`, which you can pause, seek or finish (the learner taps *Devam*).

## 3. The script

Two friends meet on the waterfront at golden hour. Each `line` names who speaks. `to`, `do` (a gesture), `emo` (a face) and `react` are optional staging, and the director fills in the rest. The `beat` brings dusk on over three seconds.

```sahne
{ "v": 1, "cues": [
  { "scene": { "place": "bench_shore", "time": "golden", "at": { "nima": "left", "ismail": "right" }, "cam": "wide" } },
  { "line": { "who": "nima", "text": "Merhaba İsmail Bey!", "to": "ismail", "do": "wave", "emo": "happy" } },
  { "line": { "who": "ismail", "text": "Merhaba! Ne güzel bir akşam.", "do": "welcome", "emo": "happy", "react": { "nima": { "do": "nod" } } } },
  { "beat": { "env": ["time:dusk:3000"], "wait": 1200 } },
  { "line": { "who": "nima", "text": "Çay içelim mi?", "emo": "curious", "do": "explain" } },
  { "line": { "who": "ismail", "text": "Tabii, hadi!", "do": "nod", "emo": "happy" } }
] }
```

In the gallery, a script block plays with the gallery's own documents: the test places (`bench_shore`, `bench_street`, `bench_roof` and the others under [Places](https://sahne.shab.boo/#/places)), the sample places, and two sample people, `nima` and `ismail`.

## 4. Where to go next

- **Every cue kind and staging field**, one click each: the [cue lab](https://sahne.shab.boo/#/systems/script).
- **The script format** in full: [DESIGN.md §5.6](../../sahne/DESIGN.md#56-script).
- **A whole story** with choices, acts and tap-to-translate: the [story format](../../sahne-story/README.md) and the [sample story](https://sahne.shab.boo/#/stories/s1e00).
- **Building people**: the [avatar builder](https://sahne.shab.boo/#/systems/avatar) and the kit's [style guide](../../sahne-kit/STYLE.md).
- **Places**: the [place format](../../sahne/DESIGN.md#55-place-document) and the [set pieces](../../sahne-kit/SET.md).
