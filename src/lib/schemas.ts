import { z } from "zod";

/**
 * Two layers of schemas:
 *
 * 1. Content schemas: what Gemini will be asked to return. Only the learning
 *    content, no ids and no metadata. We never trust an LLM to invent unique
 *    ids or to echo grade/language back correctly, so we don't ask it to.
 * 2. Game schemas: content plus metadata (chosen by the teacher) plus item ids
 *    (assigned by the app). This is what templates, preview and samples use.
 *
 * Both layers share the same item shapes and rules, so a piece of content that
 * passes layer 1 always becomes a valid game in layer 2.
 */

// ---------- shared primitives ----------

export const SUBJECTS = ["math", "english", "science"] as const;
export const LANGUAGES = ["en", "de"] as const;
export const GAME_TYPES = ["quiz", "matching", "true-false"] as const;

export const subjectSchema = z.enum(SUBJECTS);
export const languageSchema = z.enum(LANGUAGES);
export const gradeSchema = z.int().min(1).max(4);
export const gameTypeSchema = z.enum(GAME_TYPES);

/** Short, trimmed, non-empty text. The caps keep text readable on a projector. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1, "Must not be empty")
    .max(max, `Keep it under ${max} characters`);

const idSchema = z.string().min(1).max(64);

/** Case- and whitespace-insensitive key used for duplicate checks. */
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function findDuplicateIndexes(values: string[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  values.forEach((value, index) => {
    const key = normalize(value);
    if (seen.has(key)) duplicates.push(index);
    seen.add(key);
  });
  return duplicates;
}

// ---------- quiz ----------

const quizItemShape = {
  question: text(120),
  options: z
    .array(text(60))
    .min(2, "A question needs at least 2 options")
    .max(4, "A question can have at most 4 options"),
  // Max 3 because there are at most 4 options. The refine below checks it against the real count.
  correctIndex: z.int().min(0).max(3),
};

function checkQuizItem(
  item: { options: string[]; correctIndex: number },
  ctx: z.RefinementCtx,
) {
  if (item.correctIndex >= item.options.length) {
    ctx.addIssue({
      code: "custom",
      path: ["correctIndex"],
      message: "The correct answer must be one of the options",
    });
  }
  for (const index of findDuplicateIndexes(item.options)) {
    ctx.addIssue({
      code: "custom",
      path: ["options", index],
      message: "Options must all be different",
    });
  }
}

const quizItemContentSchema = z.object(quizItemShape).superRefine(checkQuizItem);
export const quizItemSchema = z
  .object({ id: idSchema, ...quizItemShape })
  .superRefine(checkQuizItem);

const quizItems = <T extends z.ZodType>(item: T) =>
  z
    .array(item)
    .min(1, "Add at least 1 question")
    .max(15, "At most 15 questions");

// ---------- matching ----------

const matchingPairShape = {
  left: text(40),
  right: text(40),
};

/**
 * Both columns must be unique. If two left cards were "big", a child could
 * match either one to "small" and we couldn't say which match is right.
 */
function checkPairs(pairs: { left: string; right: string }[], ctx: z.RefinementCtx) {
  for (const index of findDuplicateIndexes(pairs.map((p) => p.left))) {
    ctx.addIssue({
      code: "custom",
      path: [index, "left"],
      message: "Each left card must be different",
    });
  }
  for (const index of findDuplicateIndexes(pairs.map((p) => p.right))) {
    ctx.addIssue({
      code: "custom",
      path: [index, "right"],
      message: "Each right card must be different",
    });
  }
}

export const matchingPairSchema = z.object({ id: idSchema, ...matchingPairShape });

const matchingPairs = <T extends z.ZodType<{ left: string; right: string }>>(pair: T) =>
  z
    .array(pair)
    .min(3, "A matching game needs at least 3 pairs")
    .max(8, "At most 8 pairs fit on the screen")
    .superRefine(checkPairs);

// ---------- true / false ----------

const trueFalseItemShape = {
  statement: text(120),
  answer: z.boolean(),
  explanation: text(160).optional(),
};

export const trueFalseItemSchema = z.object({ id: idSchema, ...trueFalseItemShape });

// ---------- layer 1: content (Gemini output) ----------

export const quizContentSchema = z.object({
  items: quizItems(quizItemContentSchema),
});

export const matchingContentSchema = z.object({
  pairs: matchingPairs(z.object(matchingPairShape)),
});

export const trueFalseContentSchema = z.object({
  items: quizItems(z.object(trueFalseItemShape)),
});

/** Lookup used later by the generation route: game type -> schema Gemini must match. */
export const contentSchemaByType = {
  quiz: quizContentSchema,
  matching: matchingContentSchema,
  "true-false": trueFalseContentSchema,
} as const;

// ---------- layer 2: full games ----------

export const gameMetaSchema = z.object({
  id: idSchema,
  title: text(80),
  subject: subjectSchema,
  topic: text(80),
  grade: gradeSchema,
  language: languageSchema,
});

function checkUniqueIds(list: { id: string }[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  list.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: "Duplicate id" });
    }
    seen.add(entry.id);
  });
}

export const quizGameSchema = gameMetaSchema.extend({
  type: z.literal("quiz"),
  items: quizItems(quizItemSchema).superRefine(checkUniqueIds),
});

export const matchingGameSchema = gameMetaSchema.extend({
  type: z.literal("matching"),
  pairs: matchingPairs(matchingPairSchema).superRefine(checkUniqueIds),
});

export const trueFalseGameSchema = gameMetaSchema.extend({
  type: z.literal("true-false"),
  items: quizItems(trueFalseItemSchema).superRefine(checkUniqueIds),
});

export const gameSchema = z.discriminatedUnion("type", [
  quizGameSchema,
  matchingGameSchema,
  trueFalseGameSchema,
]);

// ---------- types ----------

export type Subject = z.infer<typeof subjectSchema>;
export type Language = z.infer<typeof languageSchema>;
export type GameType = z.infer<typeof gameTypeSchema>;
export type GameMeta = z.infer<typeof gameMetaSchema>;

export type QuizContent = z.infer<typeof quizContentSchema>;
export type MatchingContent = z.infer<typeof matchingContentSchema>;
export type TrueFalseContent = z.infer<typeof trueFalseContentSchema>;

export type QuizItem = z.infer<typeof quizItemSchema>;
export type MatchingPair = z.infer<typeof matchingPairSchema>;
export type TrueFalseItem = z.infer<typeof trueFalseItemSchema>;

export type QuizGame = z.infer<typeof quizGameSchema>;
export type MatchingGame = z.infer<typeof matchingGameSchema>;
export type TrueFalseGame = z.infer<typeof trueFalseGameSchema>;
export type Game = z.infer<typeof gameSchema>;

type ContentByType = {
  quiz: QuizContent;
  matching: MatchingContent;
  "true-false": TrueFalseContent;
};

// ---------- content -> game ----------

/**
 * Turns validated content into a full game: adds the teacher's metadata and
 * assigns ids. Ids are positional ("q1", "q2", ...) so they are stable and
 * predictable. They only need to be unique inside one game, and they don't
 * change when the teacher later deletes an item.
 *
 * The result is parsed once more, so the return value is guaranteed valid.
 */
export function toGame<T extends GameType>(
  type: T,
  meta: GameMeta,
  content: ContentByType[T],
): Extract<Game, { type: T }> {
  const withIds = (list: readonly object[], prefix: string) =>
    list.map((entry, i) => ({ id: `${prefix}${i + 1}`, ...entry }));

  const raw =
    "pairs" in content
      ? { ...meta, type, pairs: withIds(content.pairs, "p") }
      : { ...meta, type, items: withIds(content.items, "q") };

  return gameSchema.parse(raw) as Extract<Game, { type: T }>;
}
