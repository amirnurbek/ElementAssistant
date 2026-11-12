"use client";

import { TEAM_COUNTS, createTeams, type TeamCount } from "@/lib/game/teams";
import { translator } from "@/lib/i18n";
import type { Language } from "@/lib/schemas";

export interface TeamSetupProps {
  language: Language;
  onStart: (count: TeamCount) => void;
}

export function TeamSetup({ language, onStart }: TeamSetupProps) {
  const tr = translator(language);
  return (
    <div className="flex flex-col items-center gap-8">
      <h2 className="text-center text-4xl font-bold md:text-5xl">{tr("setup.title")}</h2>
      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
        {TEAM_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onStart(count)}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl border-4 border-slate-200 bg-white p-4 text-3xl font-bold shadow-md transition hover:border-violet-500 active:scale-[0.98] md:text-4xl"
          >
            <span aria-hidden className="text-4xl">
              {createTeams(count)
                .map((team) => team.icon)
                .join(" ")}
            </span>
            {count === 1 ? tr("setup.solo") : tr("setup.teams", { n: count })}
          </button>
        ))}
      </div>
    </div>
  );
}
