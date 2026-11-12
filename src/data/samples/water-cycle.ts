import { toGame } from "@/lib/schemas";

export const waterCycle = toGame(
  "true-false",
  {
    id: "water-cycle",
    title: "The water cycle",
    subject: "science",
    topic: "The water cycle",
    grade: 4,
    language: "en",
  },
  {
    items: [
      {
        statement: "The sun heats water and turns it into water vapor.",
        answer: true,
        explanation: "This is called evaporation.",
      },
      {
        statement: "Evaporation means that water falls from the sky.",
        answer: false,
        explanation: "Water falling from the sky is called precipitation.",
      },
      {
        statement: "Clouds are made of tiny drops of water or ice.",
        answer: true,
        explanation: "Water vapor cools down high in the sky and forms tiny drops.",
      },
      {
        statement: "When water vapor cools down and turns into drops, it is called condensation.",
        answer: true,
      },
      {
        statement: "Rain, snow and hail are all kinds of precipitation.",
        answer: true,
      },
      {
        statement: "Water can only evaporate from the sea.",
        answer: false,
        explanation: "Water also evaporates from lakes, rivers, puddles and even plants.",
      },
      {
        statement: "The water on Earth gets used up and never comes back.",
        answer: false,
        explanation: "The same water moves around the cycle again and again.",
      },
    ],
  },
);
