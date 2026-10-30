// What the assistant can and cannot do, in plain words: one list that the system prompt tells the model
// (server/assistant.ts) and the panel shows the person (ui/assistant.ts), so the two never disagree. It follows the
// assistant's tools (server/mcp.ts) and the edit mode, and starts with what matters on the page open (an episode, the
// board, a place, a character): when a tool is added or removed there, change this too.

export interface AbilitiesOf { writable: boolean; agentEdits: "proposals" | "direct"; shareCards?: boolean; cards?: boolean; page?: string }
export interface Abilities { can: string[]; cannot: string[] }

/** The page's own lines, said first; `instead` replaces the general line about places, characters and seasons. */
const HERE: Record<string, (w: boolean) => { can: string[]; cannot: string[]; instead?: boolean }> = {
  episode: w => ({ can: w ? ["Work on this episode: its lines and translations, staging, choices, spots and quiz."] : ["Read this episode and its check, and say what to change."], cannot: [] }),
  board: w => ({
    can: ["Say what needs work in this season: empty days, weeks without a theme, episodes with problems or still to review.", ...(w ? ["Propose a new episode for a day, and move an episode to another day."] : [])],
    cannot: ["Change the season itself (its titles, launch day or a week's theme): do that here, in Season settings and in each week's theme.", "Change places or characters: do that on the Places and Cast pages."], instead: true,
  }),
  place: () => ({
    can: ["Read this place: its marks (where people stand and move to), its props, and the episodes set here."],
    cannot: ["Change this place: you edit it here, on its stage. It can edit the episodes that use it.", "Change characters, the series or a season: on the Cast page and the Board."], instead: true,
  }),
  places: () => ({ can: ["Read the places, their marks and props, and say which suits a scene."], cannot: ["Make or change a place: you do that here.", "Change characters, the series or a season: on the Cast page and the Board."], instead: true }),
  character: () => ({
    can: ["Read this character and the episodes they speak in, and describe how they speak."],
    cannot: ["Change this character: you edit them here. It can change their lines in episodes.", "Change places, the series or a season: on the Places page and the Board."], instead: true,
  }),
  cast: () => ({ can: ["Read the cast and say who suits a scene."], cannot: ["Add or change a character: you do that here.", "Change places, the series or a season: on the Places page and the Board."], instead: true }),
  review: () => ({ can: ["Read the review notes and the checks, and say what to review first."], cannot: [] }),
};
HERE.season = HERE.board;
HERE.new = HERE.board;

export function abilities(o: AbilitiesOf): Abilities {
  const proposing = o.agentEdits === "proposals";
  const here = HERE[o.page ?? ""]?.(o.writable) ?? { can: [], cannot: [] };
  const can = [
    ...here.can,
    "Read the series, its seasons and every episode, and look up the cast, the places (with their marks and props), gestures, feelings and sounds.",
    "Run the story check on an episode and explain what it finds.",
    ...(o.writable ? [
      `Edit an episode: its lines and their translations, the staging, and its steps (add, delete, move). ${proposing ? "Each edit is a proposal you accept or reject." : "Each edit is saved at once, after the same check as your Save."}`,
      `Start a new episode from a brief, in a week its season has an arc for${proposing ? ", as a proposal: you open it to accept or reject it, and until then it can keep editing it" : ""}.`,
      "Move an episode to another date in the season's calendar.",
      "Leave review comments on an episode or one of its steps.",
      ...(proposing ? [] : ["Set where an episode stands (draft, reviewed, approved)."]),
    ] : []),
    "Open an episode at a step in the editor, to show you what it means.",
  ];
  const cannot = [
    ...(!o.writable ? ["Change anything: backstage is read-only, so it can read, check and advise only."] : proposing ? ["Save anything itself: you decide on each proposal, then save."] : []),
    ...here.cannot,
    ...(here.instead ? [] : ["Change places, characters, the series or a season: do that on the Places and Cast pages, and on the Board (Season and Series settings; a week's theme there is its arc)."]),
    "Change the kit: it cannot draw new art or add props, gestures or sounds.",
    "See the stage, pictures or hear sounds: it reads the documents only.",
    ...(o.cards && !o.shareCards ? ["See the words on the word cards, only their ids (the Agents tab can share them)."] : []),
    ...(o.writable && proposing ? ["Say whether an episode is reviewed or approved: a person does."] : []),
    "Browse the web, or read files outside this content root.",
    "Remember other conversations: each starts from what is on screen and in the files.",
  ];
  return { can, cannot };
}
