import { toGame, type GameMeta } from "@/lib/schemas";

const meta = (id: string, language: GameMeta["language"] = "en"): GameMeta => ({
  id,
  title: `Test ${id}`,
  subject: "math",
  topic: "Testing",
  grade: 2,
  language,
});

/** 3 questions. Correct answers: index 1, 0, 2. */
export const quizGame = toGame("quiz", meta("quiz"), {
  items: [
    { question: "What is 2 + 3?", options: ["4", "5", "6"], correctIndex: 1 },
    { question: "What is 10 - 4?", options: ["6", "7"], correctIndex: 0 },
    { question: "What is 3 + 3?", options: ["5", "7", "6", "8"], correctIndex: 2 },
  ],
});

/** 2 statements. Answers: true, false. */
export const trueFalseGame = toGame("true-false", meta("tf"), {
  items: [
    { statement: "Ice is frozen water.", answer: true },
    { statement: "Fish can fly.", answer: false, explanation: "Fish swim in water." },
  ],
});

/** 3 pairs with ids p1, p2, p3. */
export const matchingGame = toGame("matching", meta("match"), {
  pairs: [
    { left: "big", right: "small" },
    { left: "hot", right: "cold" },
    { left: "up", right: "down" },
  ],
});

export const germanQuizGame = { ...quizGame, id: "quiz-de", language: "de" as const };
