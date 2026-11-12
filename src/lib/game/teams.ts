export type TeamId = "class" | "fox" | "whale" | "frog" | "chick";
export type TeamColor = "violet" | "orange" | "blue" | "green" | "yellow";

export interface Team {
  id: TeamId;
  /** Animal icon: teams differ by shape too, not only by color (color-blind kids). */
  icon: string;
  color: TeamColor;
  score: number;
}

type TeamPreset = Omit<Team, "score">;

/** Solo mode: the whole class plays together as one team. */
const CLASS_TEAM: TeamPreset = { id: "class", icon: "⭐", color: "violet" };

const TEAM_PRESETS: readonly TeamPreset[] = [
  { id: "fox", icon: "🦊", color: "orange" },
  { id: "whale", icon: "🐳", color: "blue" },
  { id: "frog", icon: "🐸", color: "green" },
  { id: "chick", icon: "🐥", color: "yellow" },
];

export const TEAM_COUNTS = [1, 2, 3, 4] as const;
export type TeamCount = (typeof TEAM_COUNTS)[number];

/** 1 = solo (whole class), 2–4 = competing teams. */
export function createTeams(count: number): Team[] {
  if (count === 1) return [{ ...CLASS_TEAM, score: 0 }];
  if (Number.isInteger(count) && count >= 2 && count <= TEAM_PRESETS.length) {
    return TEAM_PRESETS.slice(0, count).map((preset) => ({ ...preset, score: 0 }));
  }
  throw new RangeError(`Team count must be 1–${TEAM_PRESETS.length}, got ${count}`);
}

/** All teams sharing the top score. More than one entry means a tie. */
export function getWinners(teams: readonly Team[]): Team[] {
  if (teams.length === 0) return [];
  const best = Math.max(...teams.map((team) => team.score));
  return teams.filter((team) => team.score === best);
}

/** Teams sorted by score (highest first), keeping the original order on ties. */
export function rankTeams(teams: readonly Team[]): Team[] {
  return [...teams].sort((a, b) => b.score - a.score);
}
