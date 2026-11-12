import { describe, expect, it } from "vitest";
import { matchingGame, quizGame, trueFalseGame } from "@/test/fixtures";
import { addOption, removeEntry, removeOption, setOption, updateEntry, validateDraft } from "./edit";

describe("updateEntry / removeEntry", () => {
  it("updates one quiz question and leaves the original untouched", () => {
    const edited = updateEntry(quizGame, "q2", { question: "What is 10 - 3?" });
    expect(edited.items[1].question).toBe("What is 10 - 3?");
    expect(edited.items[0]).toBe(quizGame.items[0]);
    expect(quizGame.items[1].question).toBe("What is 10 - 4?");
  });

  it("updates a matching pair", () => {
    const edited = updateEntry(matchingGame, "p2", { right: "freezing" });
    expect(edited.pairs[1]).toEqual({ id: "p2", left: "hot", right: "freezing" });
  });

  it("updates a true/false answer", () => {
    expect(updateEntry(trueFalseGame, "q1", { answer: false }).items[0].answer).toBe(false);
  });

  it("removes an entry and keeps the other ids", () => {
    const edited = removeEntry(quizGame, "q2");
    expect(edited.items.map((i) => i.id)).toEqual(["q1", "q3"]);
    expect(removeEntry(matchingGame, "p1").pairs.map((p) => p.id)).toEqual(["p2", "p3"]);
  });
});

describe("quiz option helpers", () => {
  const item = { id: "q", question: "?", options: ["a", "b", "c", "d"], correctIndex: 2 };

  it("sets one option's text", () => {
    expect(setOption(item, 0, "z").options).toEqual(["z", "b", "c", "d"]);
  });

  it("adds an empty option, up to 4", () => {
    const three = { ...item, options: ["a", "b", "c"] };
    expect(addOption(three).options).toEqual(["a", "b", "c", ""]);
    expect(addOption(item)).toBe(item);
  });

  it("keeps the correct answer when removing an option before it", () => {
    const edited = removeOption(item, 0);
    expect(edited.options).toEqual(["b", "c", "d"]);
    expect(edited.options[edited.correctIndex]).toBe("c");
  });

  it("keeps the correct answer when removing an option after it", () => {
    const edited = removeOption(item, 3);
    expect(edited.options[edited.correctIndex]).toBe("c");
  });

  it("refuses to remove the correct option or go below 2 options", () => {
    expect(removeOption(item, 2)).toBe(item);
    const two = { ...item, options: ["a", "b"], correctIndex: 0 };
    expect(removeOption(two, 1)).toBe(two);
  });
});

describe("validateDraft", () => {
  it("returns the parsed (trimmed) game when valid", () => {
    const result = validateDraft(updateEntry(quizGame, "q1", { question: "  What is 2 + 3?  " }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.game.type === "quiz" && result.game.items[0].question).toBe("What is 2 + 3?");
  });

  it("groups problems by the item they belong to", () => {
    const draft = updateEntry(quizGame, "q2", { options: ["6", ""] });
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.byEntry).toEqual({ q2: ["Must not be empty"] });
    expect(result.fields).toEqual(new Set(["items.1.options.1"]));
    expect(result.general).toEqual([]);
  });

  it("reports list-level problems as general", () => {
    const draft = removeEntry(matchingGame, "p1");
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.general).toEqual(["A matching game needs at least 3 pairs"]);
  });

  it("finds duplicates after an edit", () => {
    const draft = updateEntry(matchingGame, "p3", { right: "Cold" });
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.byEntry.p3).toEqual(["Each right card must be different"]);
  });

  it("rejects an empty explanation, so the UI must store undefined instead", () => {
    expect(validateDraft(updateEntry(trueFalseGame, "q1", { explanation: "" })).ok).toBe(false);
    expect(validateDraft(updateEntry(trueFalseGame, "q1", { explanation: undefined })).ok).toBe(true);
  });
});
