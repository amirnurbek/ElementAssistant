import { describe, expect, it } from "vitest";
import {
  gameSchema,
  matchingContentSchema,
  quizContentSchema,
  toGame,
  trueFalseContentSchema,
  type GameMeta,
} from "./schemas";

const meta: GameMeta = {
  id: "test-game",
  title: "Test game",
  subject: "math",
  topic: "Addition",
  grade: 2,
  language: "en",
};

const quizItem = { question: "What is 2 + 3?", options: ["4", "5", "6"], correctIndex: 1 };
const pairs = [
  { left: "big", right: "small" },
  { left: "hot", right: "cold" },
  { left: "up", right: "down" },
];
const tfItem = { statement: "Water freezes at 0 °C.", answer: true };

/** Collects "path: message" strings so tests can assert which rule failed. */
function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return (result.error?.issues ?? []).map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("quiz content", () => {
  it("accepts a valid quiz", () => {
    expect(quizContentSchema.safeParse({ items: [quizItem] }).success).toBe(true);
  });

  it("trims whitespace", () => {
    const parsed = quizContentSchema.parse({
      items: [{ ...quizItem, question: "  What is 2 + 3?  " }],
    });
    expect(parsed.items[0].question).toBe("What is 2 + 3?");
  });

  it("rejects correctIndex pointing past the options", () => {
    const result = quizContentSchema.safeParse({ items: [{ ...quizItem, correctIndex: 3 }] });
    expect(issues(result)).toContain(
      "items.0.correctIndex: The correct answer must be one of the options",
    );
  });

  it("rejects a negative or fractional correctIndex", () => {
    expect(quizContentSchema.safeParse({ items: [{ ...quizItem, correctIndex: -1 }] }).success).toBe(false);
    expect(quizContentSchema.safeParse({ items: [{ ...quizItem, correctIndex: 1.5 }] }).success).toBe(false);
  });

  it("rejects duplicate options, ignoring case and spaces", () => {
    const result = quizContentSchema.safeParse({
      items: [{ ...quizItem, options: ["Cat", " cat ", "Dog"], correctIndex: 2 }],
    });
    expect(issues(result)).toContain("items.0.options.1: Options must all be different");
  });

  it("rejects fewer than 2 or more than 4 options", () => {
    const one = quizContentSchema.safeParse({ items: [{ ...quizItem, options: ["5"], correctIndex: 0 }] });
    const five = quizContentSchema.safeParse({
      items: [{ ...quizItem, options: ["1", "2", "3", "4", "5"] }],
    });
    expect(one.success).toBe(false);
    expect(five.success).toBe(false);
  });

  it("rejects empty and whitespace-only text", () => {
    expect(quizContentSchema.safeParse({ items: [{ ...quizItem, question: "   " }] }).success).toBe(false);
    expect(
      quizContentSchema.safeParse({ items: [{ ...quizItem, options: ["4", "", "6"] }] }).success,
    ).toBe(false);
  });

  it("rejects text that is too long for the projector", () => {
    const result = quizContentSchema.safeParse({ items: [{ ...quizItem, question: "a".repeat(121) }] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty quiz and more than 15 questions", () => {
    expect(quizContentSchema.safeParse({ items: [] }).success).toBe(false);
    expect(quizContentSchema.safeParse({ items: Array(16).fill(quizItem) }).success).toBe(false);
  });
});

describe("matching content", () => {
  it("accepts valid pairs", () => {
    expect(matchingContentSchema.safeParse({ pairs }).success).toBe(true);
  });

  it("rejects fewer than 3 or more than 8 pairs", () => {
    expect(matchingContentSchema.safeParse({ pairs: pairs.slice(0, 2) }).success).toBe(false);
    const nine = Array.from({ length: 9 }, (_, i) => ({ left: `l${i}`, right: `r${i}` }));
    expect(matchingContentSchema.safeParse({ pairs: nine }).success).toBe(false);
  });

  it("rejects duplicate left cards", () => {
    const result = matchingContentSchema.safeParse({
      pairs: [...pairs, { left: "Big", right: "tiny" }],
    });
    expect(issues(result)).toContain("pairs.3.left: Each left card must be different");
  });

  it("rejects duplicate right cards", () => {
    const result = matchingContentSchema.safeParse({
      pairs: [...pairs, { left: "tall", right: "SMALL" }],
    });
    expect(issues(result)).toContain("pairs.3.right: Each right card must be different");
  });
});

describe("true/false content", () => {
  it("accepts statements with and without explanation", () => {
    const result = trueFalseContentSchema.safeParse({
      items: [tfItem, { statement: "The sun is cold.", answer: false, explanation: "The sun is very hot." }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a string answer instead of a boolean", () => {
    expect(
      trueFalseContentSchema.safeParse({ items: [{ ...tfItem, answer: "true" }] }).success,
    ).toBe(false);
  });

  it("rejects an empty explanation", () => {
    expect(
      trueFalseContentSchema.safeParse({ items: [{ ...tfItem, explanation: " " }] }).success,
    ).toBe(false);
  });
});

describe("game schema", () => {
  const quizGame = { ...meta, type: "quiz", items: [{ id: "q1", ...quizItem }] };

  it("accepts a full quiz game", () => {
    expect(gameSchema.safeParse(quizGame).success).toBe(true);
  });

  it.each([0, 5, 2.5])("rejects grade %s", (grade) => {
    expect(gameSchema.safeParse({ ...quizGame, grade }).success).toBe(false);
  });

  it("rejects an unsupported language", () => {
    expect(gameSchema.safeParse({ ...quizGame, language: "fr" }).success).toBe(false);
  });

  it("rejects an unknown subject", () => {
    expect(gameSchema.safeParse({ ...quizGame, subject: "history" }).success).toBe(false);
  });

  it("rejects an unknown game type", () => {
    expect(gameSchema.safeParse({ ...quizGame, type: "memory" }).success).toBe(false);
  });

  it("rejects a game whose content doesn't match its type", () => {
    // A quiz body labelled as matching must fail: the discriminator picks the schema.
    expect(gameSchema.safeParse({ ...quizGame, type: "matching" }).success).toBe(false);
  });

  it("rejects duplicate item ids", () => {
    const result = gameSchema.safeParse({
      ...quizGame,
      items: [
        { id: "q1", ...quizItem },
        { id: "q1", ...quizItem },
      ],
    });
    expect(issues(result)).toContain("items.1.id: Duplicate id");
  });

  it("applies the content rules inside full games too", () => {
    const result = gameSchema.safeParse({
      ...quizGame,
      items: [{ id: "q1", ...quizItem, correctIndex: 9 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("toGame", () => {
  it("adds metadata and positional ids to quiz content", () => {
    const game = toGame("quiz", meta, { items: [quizItem, quizItem] });
    expect(game.type).toBe("quiz");
    expect(game.title).toBe("Test game");
    expect(game.items.map((i) => i.id)).toEqual(["q1", "q2"]);
  });

  it("adds ids to matching pairs", () => {
    const game = toGame("matching", meta, { pairs });
    expect(game.pairs.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("produces a true/false game that passes the game schema", () => {
    const game = toGame("true-false", meta, { items: [tfItem] });
    expect(gameSchema.safeParse(game).success).toBe(true);
  });

  it("throws if the metadata is invalid", () => {
    expect(() => toGame("quiz", { ...meta, grade: 7 }, { items: [quizItem] })).toThrow();
  });
});
