import { describe, expect, it } from "vitest";
import { matchingGame, quizGame, trueFalseGame } from "@/test/fixtures";
import { createRightOrder, initSession, itemCount, sessionReducer, type SessionAction, type SessionState } from "./session";
import { createTeams } from "./teams";

function play(state: SessionState, ...actions: SessionAction[]): SessionState {
  return actions.reduce(sessionReducer, state);
}

const scores = (state: SessionState) => state.teams.map((t) => t.score);
const answer = (choice: number | boolean): SessionAction => ({ type: "answer", choice });
const next: SessionAction = { type: "next" };
const match = (leftId: string, rightId: string): SessionAction => ({ type: "match", leftId, rightId });

describe("initSession", () => {
  it("starts at the first item with the first team and zero scores", () => {
    const teams = createTeams(2).map((t) => ({ ...t, score: 9 }));
    const state = initSession(quizGame, teams);
    expect(state).toMatchObject({ currentTeam: 0, itemIndex: 0, phase: "answering", attempts: 0 });
    expect(scores(state)).toEqual([0, 0]);
  });

  it("shuffles the right column for matching games only", () => {
    expect(initSession(quizGame, createTeams(1)).rightOrder).toEqual([]);
    const order = initSession(matchingGame, createTeams(1)).rightOrder;
    expect([...order].sort()).toEqual(["p1", "p2", "p3"]);
    expect(order).not.toEqual(["p1", "p2", "p3"]);
  });
});

describe("quiz scoring", () => {
  it("gives the current team a point for a correct answer", () => {
    const state = play(initSession(quizGame, createTeams(2)), answer(1));
    expect(scores(state)).toEqual([1, 0]);
    expect(state.phase).toBe("feedback");
    expect(state.lastResult).toMatchObject({ kind: "answer", choice: 1, correct: true, teamIndex: 0 });
  });

  it("gives no points (and takes none away) for a wrong answer", () => {
    const state = play(initSession(quizGame, createTeams(2)), answer(0));
    expect(scores(state)).toEqual([0, 0]);
    expect(state.phase).toBe("feedback");
    expect(state.lastResult).toMatchObject({ correct: false });
  });

  it("ignores a second answer to the same question (double tap)", () => {
    const once = play(initSession(quizGame, createTeams(2)), answer(1));
    const twice = sessionReducer(once, answer(1));
    expect(twice).toBe(once);
  });

  it.each([-1, 3, 1.5, true])("ignores the invalid choice %s", (choice) => {
    const start = initSession(quizGame, createTeams(2));
    expect(sessionReducer(start, answer(choice))).toBe(start);
  });

  it("ignores 'next' while still answering", () => {
    const start = initSession(quizGame, createTeams(2));
    expect(sessionReducer(start, next)).toBe(start);
  });

  it("ignores match actions in a quiz", () => {
    const start = initSession(quizGame, createTeams(2));
    expect(sessionReducer(start, match("q1", "q1"))).toBe(start);
  });
});

describe("team turns", () => {
  it("keeps the answering team during feedback, then passes the turn", () => {
    const afterAnswer = play(initSession(quizGame, createTeams(3)), answer(0));
    expect(afterAnswer.currentTeam).toBe(0);
    const afterNext = sessionReducer(afterAnswer, next);
    expect(afterNext).toMatchObject({ currentTeam: 1, itemIndex: 1, phase: "answering", lastResult: null });
  });

  it("wraps around from the last team to the first", () => {
    const state = play(initSession(quizGame, createTeams(2)), answer(1), next, answer(0), next);
    expect(state.currentTeam).toBe(0);
    expect(state.itemIndex).toBe(2);
    expect(scores(state)).toEqual([1, 1]);
  });

  it("solo mode keeps the one class team on every question", () => {
    const state = play(initSession(quizGame, createTeams(1)), answer(1), next, answer(0), next, answer(2));
    expect(state.currentTeam).toBe(0);
    expect(scores(state)).toEqual([3]);
  });
});

describe("finishing", () => {
  it("finishes after 'next' on the last question", () => {
    const beforeEnd = play(initSession(quizGame, createTeams(2)), answer(1), next, answer(0), next, answer(0));
    expect(beforeEnd.phase).toBe("feedback");
    const end = sessionReducer(beforeEnd, next);
    expect(end.phase).toBe("finished");
    expect(scores(end)).toEqual([1, 1]);
  });

  it("ignores answers and 'next' once finished", () => {
    const end = play(initSession(trueFalseGame, createTeams(1)), answer(true), next, answer(true), next);
    expect(end.phase).toBe("finished");
    expect(sessionReducer(end, answer(true))).toBe(end);
    expect(sessionReducer(end, next)).toBe(end);
  });

  it("reset starts over with the same teams and zero scores", () => {
    const end = play(initSession(trueFalseGame, createTeams(2)), answer(true), next, answer(false), next);
    const fresh = sessionReducer(end, { type: "reset", rightOrder: [] });
    expect(fresh).toMatchObject({ phase: "answering", itemIndex: 0, currentTeam: 0, attempts: 0 });
    expect(fresh.teams.map((t) => t.id)).toEqual(["fox", "whale"]);
    expect(scores(fresh)).toEqual([0, 0]);
  });
});

describe("true/false", () => {
  it("scores boolean answers", () => {
    const state = play(initSession(trueFalseGame, createTeams(2)), answer(true), next, answer(true));
    expect(scores(state)).toEqual([1, 0]);
  });

  it("ignores a numeric choice", () => {
    const start = initSession(trueFalseGame, createTeams(2));
    expect(sessionReducer(start, answer(0))).toBe(start);
  });
});

describe("matching", () => {
  const start = () => initSession(matchingGame, createTeams(2), ["p3", "p1", "p2"]);

  it("scores a correct match and locks the pair", () => {
    const state = play(start(), match("p1", "p1"));
    expect(scores(state)).toEqual([1, 0]);
    expect(state.matchedIds).toEqual(["p1"]);
    expect(state.lastResult).toMatchObject({ kind: "match", correct: true, teamIndex: 0 });
  });

  it("passes the turn after every attempt, right or wrong", () => {
    const afterWrong = play(start(), match("p1", "p2"));
    expect(afterWrong.currentTeam).toBe(1);
    expect(afterWrong.matchedIds).toEqual([]);
    expect(scores(afterWrong)).toEqual([0, 0]);
    const afterRight = sessionReducer(afterWrong, match("p2", "p2"));
    expect(afterRight.currentTeam).toBe(0);
    expect(scores(afterRight)).toEqual([0, 1]);
  });

  it("ignores attempts with already-matched or unknown cards", () => {
    const state = play(start(), match("p1", "p1"));
    expect(sessionReducer(state, match("p1", "p1"))).toBe(state);
    expect(sessionReducer(state, match("p2", "p1"))).toBe(state);
    expect(sessionReducer(state, match("nope", "p2"))).toBe(state);
  });

  it("can always be finished after wrong tries, and finishes when all pairs are matched", () => {
    const state = play(
      start(),
      match("p1", "p2"),
      match("p1", "p3"),
      match("p1", "p1"),
      match("p2", "p2"),
      match("p3", "p3"),
    );
    expect(state.phase).toBe("finished");
    expect(state.matchedIds).toHaveLength(3);
    // Attempts alternate fox, whale, fox, whale, fox -> fox got p1 and p3, whale got p2.
    expect(scores(state)).toEqual([2, 1]);
    expect(state.attempts).toBe(5);
  });

  it("ignores quiz answers and 'next'", () => {
    const s = start();
    expect(sessionReducer(s, answer(0))).toBe(s);
    expect(sessionReducer(s, next)).toBe(s);
  });

  it("gives each attempt a new seq so the UI can replay animations", () => {
    const state = play(start(), match("p1", "p2"));
    const again = sessionReducer(state, match("p1", "p2"));
    expect(again.lastResult?.seq).toBe((state.lastResult?.seq ?? 0) + 1);
  });
});

describe("helpers", () => {
  it("itemCount counts questions or pairs", () => {
    expect(itemCount(quizGame)).toBe(3);
    expect(itemCount(trueFalseGame)).toBe(2);
    expect(itemCount(matchingGame)).toBe(3);
  });

  it("createRightOrder is empty for non-matching games", () => {
    expect(createRightOrder(trueFalseGame)).toEqual([]);
  });
});
