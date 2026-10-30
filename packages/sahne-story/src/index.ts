// sahne-story: Kumru's story documents on the Sahne stage (Kumru's STORIES_STAGE.md §3, §4).
// `adaptStory` turns a story (Kumru's STORIES_SCHEMA.md) into a script with its cards;
// `lintStory` checks that the staging agrees with the text (in the series' story language, src/lang.ts); `suggest`
// proposes staging.

export { adaptStory, type AdaptOptions, type Picks, type CardOption, type Turn, type CueInfo, type Shown, type Performance, type StoryStage } from "./adapt.ts";
export { lintStory, suggest, NEAR, FAR, type Problem, type Rule, type LintOptions, type Suggestion } from "./lint.ts";
export { dressing, dress, forLearner, LEARNER_FIELDS, type Dressing } from "./looks.ts";
export { storyProps, placesOf, isAt } from "./props.ts";
export { isCard, isA1, cardProblem, type CardIndex, type CardInfo } from "./cards.ts";
export { needsOf, type Needs, type SiteNeeds, type PlaceNeeds, type NeedMark, type NeedProp, type NeedState } from "./needs.ts";
export { lintPlace, PLACE_RULES, BANDS, BASIC, SURFACES, MAX_BYTES, type PlaceRule, type PlaceProblem, type PlaceLintOptions } from "./lint-place.ts";
export { storyPlayer, type StoryPlayer, type PlayerStage, type PlayerRun, type PlayerHooks, type Footer } from "./player.ts";
export { flagsOf, warmthOf, albumBand, metIn, unlockedOf, type StoryPicks, type PicksByStory } from "./memory.ts";
export * from "./types.ts";
export * from "./texts.ts";
export { upgrade, isOldShape, type UpgradeKind } from "./upgrade.ts";
export { langFor, plainLang, motivated, motiveText, LANGS, type StoryLang, type LineWord, type LineContext, type PropView, type Resolver } from "./lang.ts";
export { trLang } from "./langs/tr.ts";
export { enLang } from "./langs/en.ts";
