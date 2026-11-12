import { toGame } from "@/lib/schemas";

// "·" is the multiplication sign used in Austrian and German primary schools.
export const einmaleins = toGame(
  "matching",
  {
    id: "einmaleins",
    title: "Das kleine Einmaleins",
    subject: "math",
    topic: "Einmaleins",
    grade: 3,
    language: "de",
  },
  {
    pairs: [
      { left: "3 · 4", right: "12" },
      { left: "5 · 6", right: "30" },
      { left: "6 · 6", right: "36" },
      { left: "7 · 8", right: "56" },
      { left: "9 · 3", right: "27" },
      { left: "8 · 5", right: "40" },
    ],
  },
);
