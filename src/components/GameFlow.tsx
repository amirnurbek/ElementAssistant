"use client";

import Link from "next/link";
import { useState } from "react";
import { ClassroomPlayer } from "@/components/classroom/ClassroomPlayer";
import { TeamSetup } from "@/components/classroom/TeamSetup";
import { GamePreview } from "@/components/preview/GamePreview";
import type { TeamCount } from "@/lib/game/teams";
import type { Game } from "@/lib/schemas";

type Step =
  | { name: "preview" }
  | { name: "setup"; game: Game }
  | { name: "play"; game: Game; teamCount: TeamCount; round: number };

export interface GameFlowProps {
  game: Game;
  backHref?: string;
  backLabel?: string;
}

/**
 * Preview/edit -> team setup -> classroom player.
 * The teacher's draft lives here, so going back from the game to the preview
 * keeps their edits. Edits stay in memory only: nothing is saved or sent anywhere.
 */
export function GameFlow({ game, backHref, backLabel = "Back" }: GameFlowProps) {
  const [draft, setDraft] = useState<Game>(game);
  const [step, setStep] = useState<Step>({ name: "preview" });
  const [round, setRound] = useState(0);

  return (
    // lang tells screen readers (and hyphenation) when a game is German.
    <div lang={game.language} className="flex w-full flex-1 flex-col">
      {step.name === "preview" && (
        <>
          {backHref && (
            <nav className="mx-auto w-full max-w-4xl px-4 pt-4 md:px-8">
              <Link href={backHref} className="font-bold text-violet-700 hover:underline">
                ← {backLabel}
              </Link>
            </nav>
          )}
          <GamePreview
            game={draft}
            dirty={draft !== game}
            onChange={setDraft}
            onReset={() => setDraft(game)}
            onPlay={(valid) => setStep({ name: "setup", game: valid })}
          />
        </>
      )}

      {step.name === "setup" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 md:p-8">
          <TeamSetup
            language={step.game.language}
            onStart={(teamCount) => {
              // A new round number remounts the player, so every start is a fresh session.
              setRound(round + 1);
              setStep({ name: "play", game: step.game, teamCount, round: round + 1 });
            }}
          />
          <button
            type="button"
            onClick={() => setStep({ name: "preview" })}
            className="font-bold text-slate-600 underline hover:text-slate-900"
          >
            ← Back to preview
          </button>
        </div>
      )}

      {step.name === "play" && (
        <ClassroomPlayer
          key={step.round}
          game={step.game}
          teamCount={step.teamCount}
          onExit={() => setStep({ name: "preview" })}
        />
      )}
    </div>
  );
}
