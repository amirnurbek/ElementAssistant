import {
  gameSchema,
  type Game,
  type MatchingGame,
  type MatchingPair,
  type QuizGame,
  type QuizItem,
  type TrueFalseItem,
} from "@/lib/schemas";

/**
 * Pure helpers for the teacher's preview/edit step. They never validate while
 * editing: a draft is allowed to be invalid for a moment (an empty new option,
 * only 2 pairs left). Instead, `validateDraft` reports what's wrong, and the
 * Play button stays disabled until the draft is valid again.
 */

export type Entry<G extends Game> = G extends QuizGame ? QuizItem : G extends MatchingGame ? MatchingPair : TrueFalseItem;

export function entriesOf(game: Game): { id: string }[] {
  return game.type === "matching" ? game.pairs : game.items;
}

/** Merge `patch` into the item/pair with the given id. */
export function updateEntry<G extends Game>(game: G, id: string, patch: Partial<Omit<Entry<G>, "id">>): G {
  if (game.type === "matching") {
    return { ...game, pairs: game.pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
  }
  return { ...game, items: game.items.map((item: { id: string }) => (item.id === id ? { ...item, ...patch } : item)) };
}

/** Remove the item/pair with the given id. Ids of the others stay the same. */
export function removeEntry<G extends Game>(game: G, id: string): G {
  if (game.type === "matching") return { ...game, pairs: game.pairs.filter((p) => p.id !== id) };
  return { ...game, items: game.items.filter((item: { id: string }) => item.id !== id) };
}

// ---------- quiz options ----------

export const MAX_OPTIONS = 4;
export const MIN_OPTIONS = 2;

export function setOption(item: QuizItem, index: number, text: string): QuizItem {
  return { ...item, options: item.options.map((o, i) => (i === index ? text : o)) };
}

/** Adds an empty option. It's invalid until the teacher types something, which the preview shows. */
export function addOption(item: QuizItem): QuizItem {
  if (item.options.length >= MAX_OPTIONS) return item;
  return { ...item, options: [...item.options, ""] };
}

/**
 * Removes an option and keeps `correctIndex` pointing at the same answer.
 * The correct option itself can't be removed. Otherwise a different answer
 * would silently become "correct" without the teacher choosing it.
 */
export function removeOption(item: QuizItem, index: number): QuizItem {
  if (index === item.correctIndex || item.options.length <= MIN_OPTIONS) return item;
  if (index < 0 || index >= item.options.length) return item;
  return {
    ...item,
    options: item.options.filter((_, i) => i !== index),
    correctIndex: index < item.correctIndex ? item.correctIndex - 1 : item.correctIndex,
  };
}

// ---------- validation ----------

export type DraftValidation =
  | { ok: true; game: Game }
  | {
      ok: false;
      /** Problems with the whole list, e.g. "needs at least 3 pairs". */
      general: string[];
      /** Problems per item/pair, keyed by its id. */
      byEntry: Record<string, string[]>;
      /** Exact fields with a problem, as paths like "items.2.options.1". */
      fields: Set<string>;
    };

/**
 * Checks a draft against the same game schema used everywhere else, and
 * groups Zod's issues so the preview can show them next to the right item.
 * On success it returns the parsed game (trimmed text), which is what gets played.
 */
export function validateDraft(draft: Game): DraftValidation {
  const result = gameSchema.safeParse(draft);
  if (result.success) return { ok: true, game: result.data };

  const list = entriesOf(draft);
  const general = new Set<string>();
  const byEntry: Record<string, Set<string>> = {};
  const fields = new Set<string>();

  for (const issue of result.error.issues) {
    const [listKey, index] = issue.path;
    const entry = (listKey === "items" || listKey === "pairs") && typeof index === "number" ? list[index] : undefined;
    if (entry) {
      (byEntry[entry.id] ??= new Set()).add(issue.message);
      fields.add(issue.path.join("."));
    } else {
      general.add(issue.message);
    }
  }

  return {
    ok: false,
    general: [...general],
    byEntry: Object.fromEntries(Object.entries(byEntry).map(([id, messages]) => [id, [...messages]])),
    fields,
  };
}
