import { toGame } from "@/lib/schemas";

export const opposites = toGame(
  "matching",
  {
    id: "opposites",
    title: "Opposites",
    subject: "english",
    topic: "Adjectives and their opposites",
    grade: 3,
    language: "en",
  },
  {
    pairs: [
      { left: "big", right: "small" },
      { left: "hot", right: "cold" },
      { left: "fast", right: "slow" },
      { left: "happy", right: "sad" },
      { left: "full", right: "empty" },
      { left: "day", right: "night" },
    ],
  },
);
