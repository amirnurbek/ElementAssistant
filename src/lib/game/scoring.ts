import type { QuizItem, TrueFalseItem } from "@/lib/schemas";

/** Points per correct answer. There are no minus points for 6–10 year olds. */
export const POINTS_PER_CORRECT = 1;

export function isQuizCorrect(item: QuizItem, choice: number): boolean {
  return choice === item.correctIndex;
}

export function isTrueFalseCorrect(item: TrueFalseItem, choice: boolean): boolean {
  return choice === item.answer;
}

/**
 * Left and right cards both carry their pair's id, so a match is correct
 * exactly when both cards come from the same pair.
 */
export function isMatchCorrect(leftPairId: string, rightPairId: string): boolean {
  return leftPairId === rightPairId;
}
