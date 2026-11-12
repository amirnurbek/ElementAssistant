import type { Game } from "@/lib/schemas";
import { POINTS_PER_CORRECT, isMatchCorrect, isQuizCorrect, isTrueFalseCorrect } from "./scoring";
import { shuffleChanged } from "./shuffle";
import type { Team } from "./teams";

/**
 * One game session as a pure reducer. The reducer is the single source of
 * truth: templates only report what was tapped ("option 2"), and the reducer
 * decides whether that's correct. That keeps all rules in one tested place,
 * and it's why the templates can stay simple presentational components.
 */

export type Phase = "answering" | "feedback" | "finished";

export type LastResult =
  | { kind: "answer"; choice: number | boolean; correct: boolean; teamIndex: number; seq: number }
  | { kind: "match"; leftId: string; rightId: string; correct: boolean; teamIndex: number; seq: number };

export interface SessionState {
  game: Game;
  teams: Team[];
  /** Index into `teams` of the team whose turn it is. */
  currentTeam: number;
  /** Current question (quiz / true-false). Unused for matching. */
  itemIndex: number;
  phase: Phase;
  /** Pair ids already matched (matching only). */
  matchedIds: string[];
  /** Shuffled pair ids for the right column (matching only). */
  rightOrder: string[];
  lastResult: LastResult | null;
  /** Number of answers/attempts so far. Gives each result a unique `seq` for animations. */
  attempts: number;
}

export type SessionAction =
  | { type: "answer"; choice: number | boolean }
  | { type: "match"; leftId: string; rightId: string }
  | { type: "next" }
  /** `rightOrder` comes from the caller so the reducer itself stays pure (no Math.random). */
  | { type: "reset"; rightOrder: string[] };

/** Number of points available: one per question or pair. */
export function itemCount(game: Game): number {
  return game.type === "matching" ? game.pairs.length : game.items.length;
}

export function createRightOrder(game: Game, rng: () => number = Math.random): string[] {
  return game.type === "matching" ? shuffleChanged(game.pairs.map((p) => p.id), rng) : [];
}

export function initSession(
  game: Game,
  teams: Team[],
  rightOrder: string[] = createRightOrder(game),
): SessionState {
  return {
    game,
    teams: teams.map((team) => ({ ...team, score: 0 })),
    currentTeam: 0,
    itemIndex: 0,
    phase: "answering",
    matchedIds: [],
    rightOrder,
    lastResult: null,
    attempts: 0,
  };
}

function award(teams: Team[], index: number, correct: boolean): Team[] {
  if (!correct) return teams;
  return teams.map((team, i) => (i === index ? { ...team, score: team.score + POINTS_PER_CORRECT } : team));
}

function nextTeam(state: SessionState): number {
  return (state.currentTeam + 1) % state.teams.length;
}

function answer(state: SessionState, choice: number | boolean): SessionState {
  const { game } = state;
  // Ignoring answers outside "answering" means a double tap can't score twice.
  if (state.phase !== "answering" || game.type === "matching") return state;

  let correct: boolean;
  if (game.type === "quiz") {
    const item = game.items[state.itemIndex];
    const valid = typeof choice === "number" && Number.isInteger(choice) && choice >= 0 && choice < item.options.length;
    if (!valid) return state;
    correct = isQuizCorrect(item, choice);
  } else {
    if (typeof choice !== "boolean") return state;
    correct = isTrueFalseCorrect(game.items[state.itemIndex], choice);
  }

  const seq = state.attempts + 1;
  return {
    ...state,
    teams: award(state.teams, state.currentTeam, correct),
    phase: "feedback",
    attempts: seq,
    // currentTeam doesn't move yet: during feedback the banner still shows who answered.
    lastResult: { kind: "answer", choice, correct, teamIndex: state.currentTeam, seq },
  };
}

function next(state: SessionState): SessionState {
  if (state.phase !== "feedback") return state;
  if (state.itemIndex + 1 >= itemCount(state.game)) {
    return { ...state, phase: "finished", lastResult: null };
  }
  return {
    ...state,
    itemIndex: state.itemIndex + 1,
    currentTeam: nextTeam(state),
    phase: "answering",
    lastResult: null,
  };
}

function match(state: SessionState, leftId: string, rightId: string): SessionState {
  const { game } = state;
  if (state.phase !== "answering" || game.type !== "matching") return state;

  const open = (id: string) => game.pairs.some((p) => p.id === id) && !state.matchedIds.includes(id);
  if (!open(leftId) || !open(rightId)) return state;

  const correct = isMatchCorrect(leftId, rightId);
  const matchedIds = correct ? [...state.matchedIds, leftId] : state.matchedIds;
  const seq = state.attempts + 1;

  return {
    ...state,
    teams: award(state.teams, state.currentTeam, correct),
    matchedIds,
    // Every attempt passes the turn, so one team can't clear the whole board.
    // Wrong tries never lock a card, so the game can always be finished.
    currentTeam: nextTeam(state),
    phase: matchedIds.length === game.pairs.length ? "finished" : "answering",
    attempts: seq,
    lastResult: { kind: "match", leftId, rightId, correct, teamIndex: state.currentTeam, seq },
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "answer":
      return answer(state, action.choice);
    case "next":
      return next(state);
    case "match":
      return match(state, action.leftId, action.rightId);
    case "reset":
      return initSession(state.game, state.teams, action.rightOrder);
  }
}
