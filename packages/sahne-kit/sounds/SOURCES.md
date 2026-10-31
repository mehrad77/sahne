# Recorded sounds: sources

Every recording in the kit is CC0 (public domain dedication) and was approved by the owner before it was downloaded (`packages/sahne/DESIGN.md` §8.3). The source files are Freesound's high-quality previews (MP3, 128–190 kbps); they live in `library/`, which is local only (git-ignored), and can be fetched again from the links below.

`build.ts` cuts the kit's files from them: `node packages/sahne-kit/sounds/build.ts` rebuilds the `.m4a` files, `--check` checks them. A sound with a recording keeps its synthesized patch as the fallback (and for the tests and the gallery's pictures).

## In the kit

| Kit sound | File | Source (library file) | Cut |
|---|---|---|---|
| `gull` | `gull.m4a` | `gull-istanbul-sisli-felix.blume-167374.mp3` | 28.45–30.95 s: two gulls calling over Şişli; high-passed at 450 Hz to thin the city below |
| `ferry_horn` | `ferry_horn.m4a` | `horn-istanbul-cruiser-felix.blume-162350.mp3` | 15.45–21.0 s: the third blast of a ship's horn in Istanbul and its echo |
| `traffic` | `traffic.m4a` | `traffic-istanbul-side-street-fielastro-250507.mp3` | 95–103 s, a seamless loop: a side street in Istanbul with a vehicle going by, chosen for having no voice in it |
| `crowd` | `crowd.m4a` | `crowd-murmuring-blaastaal-766658.mp3` | 49–57 s, a seamless loop: dense murmur with no single voice standing out, low-passed at 3.5 kHz so no word can be made out |

## Library

All downloaded on 2026-10-09 from freesound.org, licence CC0 1.0.

| Library file | Title | Author | Link |
|---|---|---|---|
| `gull-istanbul-sisli-felix.blume-167374.mp3` | Seagulls screaming in Istanbul (Turkey), 2:00 | felix.blume (Felix Blume) | https://freesound.org/people/felix.blume/sounds/167374/ |
| `gull-princes-island-felix.blume-167129.mp3` | Seagulls on the top of Princes Island (Turkey), 1:32 | felix.blume (Felix Blume) | https://freesound.org/people/felix.blume/sounds/167129/ |
| `gull-beach-squashy555-353416.mp3` | Seagull on beach, 0:33 | squashy555 | https://freesound.org/people/squashy555/sounds/353416/ |
| `horn-istanbul-cruiser-felix.blume-162350.mp3` | Boat Horn (a cruiser in Istanbul, 3 times), 0:31 | felix.blume (Felix Blume) | https://freesound.org/people/felix.blume/sounds/162350/ |
| `horn-staten-island-ferry-nathanvladimirovich-261847.mp3` | Staten Island Ferry Horn (Close), 0:03 | nathanvladimirovich | https://freesound.org/people/nathanvladimirovich/sounds/261847/ |
| `horn-boat-devy32-441223.mp3` | Boat Horn, 0:24 | devy32 | https://freesound.org/people/devy32/sounds/441223/ |
| `traffic-istanbul-side-street-fielastro-250507.mp3` | Istanbul_City_Ambience - LIM1 P1, 15:30 | fielastro | https://freesound.org/people/fielastro/sounds/250507/ |
| `traffic-city-street-moxobna-36734.mp3` | citystreet3 (binaural), 3:18 | moxobna | https://freesound.org/people/moxobna/sounds/36734/ |
| `crowd-murmuring-blaastaal-766658.mp3` | murmuring, 2:34 | blaastaal | https://freesound.org/people/blaastaal/sounds/766658/ |

A preview's link is `https://cdn.freesound.org/previews/<first digits>/<id>_<user id>-hq.mp3`, as on the sound's page.
