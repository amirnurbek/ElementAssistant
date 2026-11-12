import { describe, expect, it } from "vitest";
import { gameSchema } from "@/lib/schemas";
import { SAMPLE_GAMES, getSampleGame } from ".";

describe("sample games", () => {
  it("has exactly 5 games", () => {
    expect(SAMPLE_GAMES).toHaveLength(5);
  });

  it.each(SAMPLE_GAMES.map((g) => [g.id, g]))("%s passes the game schema", (_id, game) => {
    const result = gameSchema.safeParse(game);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it("has unique ids", () => {
    const ids = SAMPLE_GAMES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all game types, subjects and both languages", () => {
    expect(new Set(SAMPLE_GAMES.map((g) => g.type))).toEqual(new Set(["quiz", "matching", "true-false"]));
    expect(new Set(SAMPLE_GAMES.map((g) => g.subject))).toEqual(new Set(["math", "english", "science"]));
    expect(new Set(SAMPLE_GAMES.map((g) => g.language))).toEqual(new Set(["en", "de"]));
  });

  it("gets a game by id", () => {
    expect(getSampleGame("opposites")?.title).toBe("Opposites");
    expect(getSampleGame("nope")).toBeUndefined();
  });

  it("only uses ids that are safe in a URL", () => {
    for (const game of SAMPLE_GAMES) expect(game.id).toMatch(/^[a-z0-9-]+$/);
  });
});
