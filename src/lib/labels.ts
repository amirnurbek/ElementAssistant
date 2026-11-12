import type { Game, GameType, Subject } from "@/lib/schemas";

/** Labels for the teacher-facing screens (preview, demo list). */
export const SUBJECT_LABELS: Record<Subject, { label: string; icon: string }> = {
  math: { label: "Math", icon: "🔢" },
  english: { label: "English", icon: "🔤" },
  science: { label: "Science", icon: "🔬" },
};

export const GAME_TYPE_LABELS: Record<GameType, string> = {
  quiz: "Quiz",
  matching: "Matching",
  "true-false": "True or false",
};

export function countLabel(game: Game): string {
  const n = game.type === "matching" ? game.pairs.length : game.items.length;
  const noun = game.type === "matching" ? "pair" : game.type === "quiz" ? "question" : "statement";
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
