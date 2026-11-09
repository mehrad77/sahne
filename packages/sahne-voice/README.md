<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-voice-header-dark.svg"><img src="../../assets/brand/sahne-voice-header.svg" alt="sahne VOICE" height="64"></picture></p>
<!-- /sahne:brand -->

# sahne-voice

The voice plugin of Sahne: each character speaks in their own voice, the same in every episode, instead of the device's one voice for everyone. A developer casts the voices, and a speech model on their own machine records every line ahead of time. The app only plays the clips.

## How it works

1. **The pool.** The candidates are short read-speech samples from Google's [FLEURS](https://huggingface.co/datasets/google/fleurs) (CC BY 4.0: paid readers who agreed to it). Several languages are in it, so a character can speak Turkish with their own accent: a Persian sample gives Farzad a Persian accent. FLEURS has no speaker ids, so `build/pool.py` keeps only the voices Chatterbox's voice encoder tells apart (one speaker scores 0.85–0.95, two 0.6–0.75; the cut is 0.82). Children's candidates are young women's voices raised four semitones, since FLEURS has no children.
2. **The brief.** `voices/cast.json` gives each speaking character a brief: gender (`neutral` for the learner's stand-in), age, and the language of their accent. It is the developer's, written once.
3. **The audition.** `build/voices.ts audition` picks five candidates for each brief: the accent's own voices and two Turkish ones to compare, nearest the age's pitch. Each candidate reads two of the character's own lines.
4. **The casting.** In backstage's Voices page (`#/voices`), the developer listens and picks a candidate. They set the tempo: the clips are slowed or quickened without changing their pitch, and the page shows the syllables per second. They set the feeling (calm, natural, lively), then confirm. A pick copies the candidate's sample to `voices/refs/<who>.wav`, with its credit in `voices/refs/CREDITS.json`.
5. **Generating.** `build/voices.ts generate` reads every line of the confirmed voices with [Chatterbox Multilingual](https://github.com/resemble-ai/chatterbox) (Resemble AI, MIT), cloning the chosen sample.
   - Each line is said as the language plugin's `spoken()` gives it: numerals in words, no quote marks.
   - A surprised or laughing line gets a little more feeling.
   - Each clip is trimmed, levelled to −18 LUFS, set to the voice's tempo, and saved as 24 kHz mono AAC (`.m4a`, about 8 KB a line).
   - Whisper hears each clip back. A clip is kept only if the language plugin's `matchLine` accepts what was heard and its length is near the plugin's own timing of the line.
   - A clip that fails is made again with another seed, up to four takes. The best take is kept and marked `doubt`, and the Voices page lists it for listening.
6. **Playing.** The app makes `clipVoice({ base, lang, fallback })`, a `VoiceProvider` for the stage (`sahne/DESIGN.md` §8.4), before the story starts.
   - It plays a line's clip into the voice bus. Its word marks are the language plugin's timing of the line, stretched to the clip.
   - A line with no clip goes to the fallback, the device's voice (`browserVoice()`). That covers a story not recorded yet, and a line that carries the learner's own name or hometown: the clips say the series' default, Nima and Tahran.

Every clip carries Resemble's inaudible Perth watermark.

## The content root

| Path | What | Shipped |
|---|---|---|
| `voices/cast.json` | the briefs and the chosen voices (`VoiceCast`) | no, but tracked |
| `voices/refs/<who>.wav`, `CREDITS.json` | each chosen voice's sample and where it comes from | no, but tracked |
| `voices/clips/<story>/manifest.json`, `*.m4a` | the clips: who → the line as the stage speaks it → `{ f, ms, sig, doubt? }` | **yes** |
| `voices/.pool/` | the candidates (`pool.json`, `<id>.wav`) | no: git-ignore it |
| `voices/.audition/` | the auditions (`audition.json`, `<who>/*.m4a`) | no: git-ignore it |

A clip's `sig` hashes the model, the sample, the settings and the spoken text, so a change to any of them makes it stale.

## Commands

From the repo root, with `SAHNE_CONTENT` set to the content root. `SAHNE_VOICE_PYTHON` must point to a Python that has `chatterbox-tts`, `mlx-whisper` (on Apple silicon) and `setuptools<81`; the watermarker still imports `pkg_resources`. Make that Python once:

```bash
uv venv -p 3.11 ~/.cache/sahne-voice && uv pip install -p ~/.cache/sahne-voice/bin/python chatterbox-tts mlx-whisper "setuptools<81"
```

```bash
$SAHNE_VOICE_PYTHON packages/sahne-voice/build/pool.py "$SAHNE_CONTENT/voices/.pool" tr_tr:dev:MALE:8 tr_tr:train:FEMALE:12 fa_ir:dev:MALE:5 children:3
node packages/sahne-voice/build/voices.ts audition [--who a,b] [--n 5] [--force]
node packages/sahne-voice/build/voices.ts choose --who farzad --ref fa_m02 --tempo 0.9 [--exaggeration 0.5] [--cfg 0.3] [--confirm]
node packages/sahne-voice/build/voices.ts generate [--story s1e01,s1e02] [--who farzad]
node packages/sahne-voice/build/voices.ts status
node packages/sahne-voice/build/voices.ts --check
```

- `pool.py` streams FLEURS. Each `lang:split:GENDER:n` asks for up to n distinct voices.
- `--check` fails when a confirmed voice has a missing or stale clip. An app's gate runs it.
- Backstage runs `audition` and `generate` for the Voices page when it was started with `SAHNE_VOICE_PYTHON` set.

On an M-series Mac, Chatterbox makes a line in about 5–10 s on the GPU (MPS), and the Whisper check adds a second or two. A season of about 1,150 lines takes a few hours, once. After that, only changed lines are made again.

## Pace

Chatterbox reads Turkish at about 3.5–4 syllables a second. Sahne's A1 timing (`sahne-tr`'s `speech()`) is about 2.6–2.9, so the clips are slowed by each voice's tempo, 0.9 by default. A lower `cfg` (0.3) also makes the delivery calmer and slower than Chatterbox's default 0.5.
