// What the assistant can and cannot do, in plain words: one list that the system prompt tells the model
// (server/assistant.ts) and the panel shows the person (ui/assistant.ts), so the two never disagree. It follows the
// assistant's tools (server/mcp.ts) and the edit mode, and starts with what matters on the page open (an episode, the
// board, a place, a character): when a tool is added or removed there, change this too.

export interface AbilitiesOf { writable: boolean; agentEdits: "proposals" | "direct"; shareCards?: boolean; cards?: boolean; page?: string }
export interface Abilities { can: string[]; cannot: string[] }

/** The page's own lines, said first. */
const HERE: Record<string, (w: boolean) => { can: string[]; cannot: string[] }> = {
  episode: w => ({ can: w ? ["Work on this episode: its lines and translations, staging, choices, spots and quiz."] : ["Read this episode and its check, and say what to change."], cannot: [] }),
  board: w => ({
    can: ["Say what needs work in this season: empty days, weeks without a theme, episodes with problems or still to review.", ...(w ? ["Set a week's theme (in the season and that week's episodes), change the season's titles and launch day, propose a new episode for a day, and move an episode to another day."] : [])],
    cannot: [],
  }),
  place: w => ({
    can: ["Read this place: its marks (where people stand and move to), its props, and the episodes set here, and which of them use a mark or prop.", ...(w ? ["Change this place's names, marks and props. An edit that breaks an episode set here is refused."] : [])],
    cannot: ["Arrange the set pieces by eye: you do that here, on its stage."],
  }),
  places: w => ({ can: ["Read the places, their marks and props, and say which suits a scene.", ...(w ? ["Add a place, empty or as a copy of another."] : [])], cannot: [] }),
  character: w => ({
    can: ["Read this character and the episodes they speak in, and describe how they speak.", ...(w ? ["Change their name, role, bio, level and colour."] : [])],
    cannot: ["Shape their look: you do that here, with the builder."],
  }),
  cast: w => ({ can: ["Read the cast and say who suits a scene.", ...(w ? ["Add a character (their look starts as the stand-in's)."] : [])], cannot: [] }),
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
      "Change a season (its titles, launch day and week themes), the series, a place (its marks and props) or a character (name, role, bio), and add a season, a place or a character. An edit that breaks an episode is refused.",
      "Leave review comments on an episode or one of its steps.",
      ...(proposing ? [] : ["Set where an episode stands (draft, reviewed, approved)."]),
    ] : []),
    "Open an episode at a step in the editor, to show you what it means.",
  ];
  const cannot = [
    ...(!o.writable ? ["Change anything: backstage is read-only, so it can read, check and advise only."] : proposing ? ["Save anything itself: you decide on each proposal, then save."] : []),
    ...here.cannot,
    "Change the kit: it cannot draw new art or add props, gestures or sounds.",
    "See the stage, pictures or hear sounds: it reads the documents only.",
    ...(o.cards && !o.shareCards ? ["See the words on the word cards, only their ids (the Agents tab can share them)."] : []),
    ...(o.writable && proposing ? ["Say whether an episode is reviewed or approved: a person does."] : []),
    "Browse the web, or read files outside this content root.",
    "Remember other conversations: each starts from what is on screen and in the files.",
  ];
  return { can, cannot };
}
