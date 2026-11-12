import { toGame } from "@/lib/schemas";

export const additionTo20 = toGame(
  "quiz",
  {
    id: "addition-to-20",
    title: "Adding and subtracting to 20",
    subject: "math",
    topic: "Addition and subtraction up to 20",
    grade: 2,
    language: "en",
  },
  {
    items: [
      { question: "7 + 5 = ?", options: ["11", "12", "13"], correctIndex: 1 },
      { question: "15 − 6 = ?", options: ["9", "8", "11"], correctIndex: 0 },
      { question: "8 + 8 = ?", options: ["15", "18", "16"], correctIndex: 2 },
      { question: "20 − 7 = ?", options: ["12", "13", "14", "17"], correctIndex: 1 },
      { question: "9 + 6 = ?", options: ["14", "16", "13", "15"], correctIndex: 3 },
      { question: "14 − 9 = ?", options: ["5", "6", "4"], correctIndex: 0 },
      {
        question: "You have 6 apples. You get 7 more. How many apples do you have now?",
        options: ["12", "14", "13"],
        correctIndex: 2,
      },
      {
        question: "There are 18 birds on a tree. 9 fly away. How many birds are left?",
        options: ["8", "9", "10"],
        correctIndex: 1,
      },
    ],
  },
);
