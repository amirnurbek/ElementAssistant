import { toGame } from "@/lib/schemas";

export const tiereZuhause = toGame(
  "quiz",
  {
    id: "tiere-zuhause",
    title: "Tiere und ihr Zuhause",
    subject: "science",
    topic: "Wo Tiere wohnen",
    grade: 1,
    language: "de",
  },
  {
    items: [
      { question: "Wo wohnt der Fuchs?", options: ["Im Nest", "Im Bau", "Im Teich"], correctIndex: 1 },
      { question: "Wo lebt der Fisch?", options: ["Im Wasser", "Auf dem Baum", "Im Stall"], correctIndex: 0 },
      { question: "Wo baut die Amsel ihr Nest?", options: ["Im Teich", "Unter der Erde", "Im Busch"], correctIndex: 2 },
      { question: "Wo wohnen die Bienen?", options: ["Im Stall", "Im Bienenstock", "Im Wasser"], correctIndex: 1 },
      { question: "Wo schläft die Kuh auf dem Bauernhof?", options: ["Im Stall", "Im Nest", "Im Teich"], correctIndex: 0 },
      { question: "Wo baut das Eichhörnchen sein Nest?", options: ["Im Wasser", "Im Stall", "Auf dem Baum"], correctIndex: 2 },
      { question: "Wo legt der Frosch seine Eier?", options: ["Im Nest", "Im Teich", "Im Bau"], correctIndex: 1 },
    ],
  },
);
