import type { Team } from "@/lib/game/teams";
import { translator } from "@/lib/i18n";
import type { Language } from "@/lib/schemas";
import { TEAM_STYLES } from "./teamStyles";

export interface ScoreboardProps {
  teams: Team[];
  currentTeam: number;
  language: Language;
  /** Highlight whose turn it is. Off on the end screen. */
  highlight?: boolean;
}

export function Scoreboard({ teams, currentTeam, language, highlight = true }: ScoreboardProps) {
  const tr = translator(language);
  return (
    <ul aria-label={tr("scoreboard")} className="flex flex-wrap justify-center gap-3 md:gap-4">
      {teams.map((team, index) => {
        const style = TEAM_STYLES[team.color];
        const active = highlight && teams.length > 1 && index === currentTeam;
        return (
          <li
            key={team.id}
            aria-current={active ? "true" : undefined}
            className={`flex items-center gap-3 rounded-2xl border-4 px-4 py-2 transition md:px-6 ${style.chip} ${active ? `scale-110 ring-4 ${style.ring}` : ""}`}
          >
            <span aria-hidden className="text-3xl md:text-4xl">
              {team.icon}
            </span>
            <span className="text-xl font-bold md:text-2xl">{tr(`team.${team.id}`)}</span>
            <span className="min-w-[2ch] text-right text-3xl font-bold tabular-nums md:text-4xl" data-testid={`score-${team.id}`}>
              {team.score}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
