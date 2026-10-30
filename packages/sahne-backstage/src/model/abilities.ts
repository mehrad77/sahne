// What the assistant can and cannot do, in plain words: one list that the system prompt tells the model
// (server/assistant.ts) and the panel shows the person (ui/assistant.ts), so the two never disagree. It follows the
// assistant's tools (server/mcp.ts) and the edit mode: when a tool is added or removed there, change this too.

export interface AbilitiesOf { writable: boolean; agentEdits: "proposals" | "direct"; shareCards?: boolean; cards?: boolean }
export interface Abilities { can: string[]; cannot: string[] }

export function abilities(o: AbilitiesOf): Abilities {
  const proposing = o.agentEdits === "proposals";
  const can = [
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
    "Change places, characters, the series or a season: do that on the Places and Cast pages, and on the Board (Season and Series settings; a week's theme there is its arc).",
    "Change the kit: it cannot draw new art or add props, gestures or sounds.",
    "See the stage, pictures or hear sounds: it reads the documents only.",
    ...(o.cards && !o.shareCards ? ["See the words on the word cards, only their ids (the Agents tab can share them)."] : []),
    ...(o.writable && proposing ? ["Say whether an episode is reviewed or approved: a person does."] : []),
    "Browse the web, or read files outside this content root.",
    "Remember other conversations: each starts from what is on screen and in the files.",
  ];
  return { can, cannot };
}
