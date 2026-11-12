import type { GenerateRequest } from "./request";

/** Test data for the generator. Raw model answers are JSON strings, like Gemini returns. */
export const quizRequest: GenerateRequest = {
  subject: "math",
  topic: "Adding to 10",
  grade: 1,
  gameType: "quiz",
  language: "en",
};

export const validQuizJson = JSON.stringify({
  items: [
    { question: "What is 2 + 3?", options: ["4", "5", "6"], correctIndex: 1 },
    { question: "What is 4 + 4?", options: ["8", "7", "9"], correctIndex: 0 },
  ],
});

/** correctIndex 5 doesn't exist: passes JSON mode, fails our refinement. */
export const outOfRangeQuizJson = JSON.stringify({
  items: [{ question: "What is 2 + 3?", options: ["4", "5", "6"], correctIndex: 3 }],
});

export const matchingRequest: GenerateRequest = {
  subject: "english",
  topic: "Opposites",
  grade: 3,
  gameType: "matching",
  language: "en",
};

export const duplicatePairsJson = JSON.stringify({
  pairs: [
    { left: "big", right: "small" },
    { left: "big", right: "tiny" },
    { left: "hot", right: "cold" },
  ],
});

export const validPairsJson = JSON.stringify({
  pairs: [
    { left: "big", right: "small" },
    { left: "hot", right: "cold" },
    { left: "fast", right: "slow" },
  ],
});
