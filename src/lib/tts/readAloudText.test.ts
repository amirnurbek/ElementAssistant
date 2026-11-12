import { describe, expect, it } from "vitest";
import { readAloudText } from "./readAloudText";

const quiz = { id: "q1", question: "What is 2 + 3?", options: ["4", "5", "6"], correctIndex: 1 };

describe("readAloudText", () => {
  it("reads the question and each option with its tile shape", () => {
    expect(readAloudText(quiz, "en")).toBe("What is 2 + 3? Triangle: 4. Diamond: 5. Circle: 6.");
  });

  it("uses German shape names in German games and names all four shapes", () => {
    const item = { ...quiz, question: "Wo wohnt der Fuchs?", options: ["Im Nest", "Im Bau", "Im Teich", "Im Stall"] };
    expect(readAloudText(item, "de")).toBe(
      "Wo wohnt der Fuchs? Dreieck: Im Nest. Raute: Im Bau. Kreis: Im Teich. Quadrat: Im Stall.",
    );
  });

  it("doesn't double punctuation and adds a full stop to a question without one", () => {
    const item = { ...quiz, question: "Pick the biggest number", options: ["Ten!", "Two"] };
    expect(readAloudText(item, "en")).toBe("Pick the biggest number. Triangle: Ten! Diamond: Two.");
  });

  it("speaks math symbols as words", () => {
    expect(readAloudText({ ...quiz, question: "3 · 4 = ?", options: ["12", "15 − 3"] }, "de")).toBe(
      "3 mal 4 = ? Dreieck: 12. Raute: 15 minus 3.",
    );
    expect(readAloudText({ ...quiz, question: "2 × 5 = ?", options: ["10", "7"] }, "en")).toContain("2 times 5");
  });

  it("reads only the statement for true/false", () => {
    expect(readAloudText({ id: "q1", statement: "Fish can fly.", answer: false, explanation: "Fish swim." }, "en")).toBe(
      "Fish can fly.",
    );
  });
});
