// What the lesson plugin adds to a story document (sahne-story src/types.ts holds the core): the grammar spot step, the
// story's level, ref, lessons, target words, glosses and quiz, and a line's note and mistake for the learner.

import type { Gate, LangText, Step, StoryDoc, StoryStaging } from "sahne-story";

/** A grammar spot: Kerim explains a lesson on an example line of the story, with an overlay (`show`). */
export interface SpotStep extends Gate {
  spot: StoryStaging & { lesson: string; ex: string; en?: string; fa?: string; tr?: string; show?: string };
}

/** A quiz item after the story: a question in every language, three options in the main one, the answer and the line that answers it. */
export interface QuizItem { q: LangText; options: string[]; a: 0 | 1 | 2; why: string; kind: "comp" | "word" }

/** A story's lesson fields. */
export interface LessonFields {
  level?: "A1" | "A2" | "B1";
  /** The course unit the story's week teaches (`A1_3`). */
  ref?: string;
  /** Grammar lesson ids. */
  lessons?: string[];
  /** Target words, as card ids. */
  words?: string[];
  /** Glosses: a word of the main language → its meaning in each translation. */
  gl?: Record<string, LangText>;
  quiz?: QuizItem[];
}

/** A story read with its lesson fields. */
export type LessonStory = StoryDoc & LessonFields;

/** A line's lesson fields: a note for the learner in the translations, and a mistake the next lines fix. */
export interface LessonLine { note?: Record<string, string>; mistake?: { fix: string } }

export const isSpot = (s: Step | object): s is SpotStep => "spot" in s;
/** A story's lesson fields (a story is read loosely: `StoryDoc` has none of them). */
export const lessonOf = (s: StoryDoc): LessonStory => s as LessonStory;

export const LEVELS = ["A1", "A2", "B1"] as const;
/** The unit a week teaches: weeks 1-6 their own, weeks 7-8 all of A1 (Kumru's STORIES_A1.md *Weeks*). */
export const unitOfWeek = (week: number) => Math.min(week, 6);
/** Where a ref sits in the course: A1_1–A1_6 are units 1–6, A2 7–12, B1 13–18; 0 for none. An A2 or B1 card is never an A1 week's. */
export const unitOfRef = (ref?: string) => { const m = /^(A1|A2|B1)_(\d)$/.exec(ref ?? ""); return m ? (LEVELS as readonly string[]).indexOf(m[1]) * 6 + Number(m[2]) : 0; };
