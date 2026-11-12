import { describe, expect, it } from "vitest";
import { createTeams, getWinners, rankTeams } from "./teams";

describe("createTeams", () => {
  it("creates one 'class' team for solo mode", () => {
    const teams = createTeams(1);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ id: "class", score: 0 });
  });

  it.each([2, 3, 4])("creates %i teams with unique ids, icons and colors", (count) => {
    const teams = createTeams(count);
    expect(teams).toHaveLength(count);
    expect(new Set(teams.map((t) => t.id)).size).toBe(count);
    expect(new Set(teams.map((t) => t.icon)).size).toBe(count);
    expect(new Set(teams.map((t) => t.color)).size).toBe(count);
    expect(teams.every((t) => t.score === 0)).toBe(true);
  });

  it.each([0, 5, 2.5, -1])("rejects %s teams", (count) => {
    expect(() => createTeams(count)).toThrow(RangeError);
  });
});

describe("getWinners", () => {
  it("returns the single highest-scoring team", () => {
    const [fox, whale, frog] = createTeams(3);
    const winners = getWinners([{ ...fox, score: 2 }, { ...whale, score: 5 }, { ...frog, score: 1 }]);
    expect(winners.map((t) => t.id)).toEqual(["whale"]);
  });

  it("returns every team on a tie", () => {
    const [fox, whale, frog] = createTeams(3);
    const winners = getWinners([{ ...fox, score: 4 }, { ...whale, score: 4 }, { ...frog, score: 1 }]);
    expect(winners.map((t) => t.id)).toEqual(["fox", "whale"]);
  });

  it("treats all-zero scores as a tie of everyone", () => {
    expect(getWinners(createTeams(2))).toHaveLength(2);
  });

  it("returns no winners for no teams", () => {
    expect(getWinners([])).toEqual([]);
  });
});

describe("rankTeams", () => {
  it("sorts by score and keeps the original order on ties", () => {
    const [fox, whale, frog] = createTeams(3);
    const ranked = rankTeams([{ ...fox, score: 1 }, { ...whale, score: 3 }, { ...frog, score: 1 }]);
    expect(ranked.map((t) => t.id)).toEqual(["whale", "fox", "frog"]);
  });
});
