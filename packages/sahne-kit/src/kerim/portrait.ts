// Kerim's portrait for the narrator's round window (Kumru's STORIES_STAGE.md §8), exported as
// `sahne-kit/kerim/portrait` for the gallery and sahne-backstage. Kerim stays one drawing with the app's
// mascot: the head crop (K_HEAD_VB, K_BUST, K_HEAD) is imported from art.ts (`sahne-kit/kerim/art`) and
// passed in (Kumru and its icon tool read the same file). Nothing of the drawing is copied here. DOM only.

const STYLE_ID = "sahne-kerim-css";
// The animations follow the app's (sahne-kit/src/kerim/kerim.css): a blink, and
// while Kerim talks the lower beak opens and the head nods. The pivots are the art's own units, so they
// hold for the crop. The head crop fits the round window as drawn (centred head, bust at the bottom),
// so the svg is not moved or scaled. Motion only when allowed, and never under the overlay's still mode.
const CSS = `
.sahne-kerim { display: block; width: 100%; height: 100%; }
.sahne-kerim svg { display: block; width: 100%; height: 100%; overflow: visible; }
.sahne-kerim .k-head, .sahne-kerim .k-beak-lo { transform-box: view-box; }
.sahne-kerim .k-head { transform-origin: 57px 48px; }
.sahne-kerim .k-beak-lo { transform-origin: 66.6px 41.5px; }
.sahne-kerim .k-lid { transform-box: fill-box; transform-origin: 50% 0; transform: scaleY(0); }
.sahne-kerim.talk .k-beak-lo { transform: rotate(22deg); }
.sahne-kerim.flip svg { transform: scaleX(-1); }
@media (prefers-reduced-motion: no-preference) {
  .sahne-kerim .k-lid { animation: sahne-k-blink 4.8s infinite; }
  .sahne-kerim.talk .k-beak-lo { animation: sahne-k-beak .2s ease-in-out infinite alternate; }
  .sahne-kerim.talk .k-head { animation: sahne-k-nod .42s ease-in-out infinite alternate; }
  .sahne-still .sahne-kerim * { animation: none !important; }
}
@keyframes sahne-k-blink { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }
@keyframes sahne-k-beak { from { transform: none; } to { transform: rotate(22deg); } }
@keyframes sahne-k-nod { from { transform: rotate(-2deg); } to { transform: rotate(3deg) translateY(.5px); } }
`;

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/** Kerim's head and neck, filling its box (sized by the overlay's window). The new gallery passes the art (sahne-kit/kerim/art); the older pages have it as a define. */
export function kerimPortrait(art: { vb: string; bust: string; head: string }): HTMLElement {
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID; s.textContent = CSS;
    document.head.append(s);
  }
  const el = document.createElement("span");
  el.className = "sahne-kerim";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Kerim");
  // trusted markup: the app's own art constants, inlined at build time
  el.innerHTML = `<svg viewBox="${art.vb}" aria-hidden="true">${art.bust}${art.head}</svg>`;
  return el;
}

/** How long Kerim moves the beak for a line, as the app's companion does (talkMs in app/ui/kerim/kerim.ts). */
export const talkMs = (text: string) => Math.max(900, Math.min(4200, 500 + text.length * 55));

/** Make Kerim talk for `ms` (beak and a nod), or stop at once with 0. */
export function kerimTalk(el: HTMLElement, ms: number) {
  clearTimeout(timers.get(el));
  el.classList.toggle("talk", ms > 0);
  if (ms > 0) timers.set(el, setTimeout(() => el.classList.remove("talk"), ms));
}

/** An inset `onTalk` handler for a portrait: talks for the line's length, stops when it goes. */
export const kerimOnTalk = (el: HTMLElement) => (talking: boolean, text: string) => kerimTalk(el, talking ? talkMs(text) : 0);
