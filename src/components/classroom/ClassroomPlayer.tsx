"use client";

import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { MatchingTemplate } from "@/components/games/MatchingTemplate";
import { QuizTemplate } from "@/components/games/QuizTemplate";
import { TrueFalseTemplate } from "@/components/games/TrueFalseTemplate";
import {
  createRightOrder,
  initSession,
  itemCount,
  sessionReducer,
  type SessionAction,
  type SessionState,
} from "@/lib/game/session";
import { createTeams, getWinners, rankTeams, type Team, type TeamCount } from "@/lib/game/teams";
import { translator } from "@/lib/i18n";
import { readAloudText } from "@/lib/tts/readAloudText";
import type { Game } from "@/lib/schemas";
import { burst, celebrate } from "./confetti";
import { ReadAloudButton } from "./ReadAloudButton";
import { Scoreboard } from "./Scoreboard";
import { TEAM_STYLES } from "./teamStyles";
import { useFullscreen } from "./useFullscreen";

export interface ClassroomPlayerProps {
  game: Game;
  teamCount: TeamCount;
  onExit?: () => void;
}

/**
 * Projector view: owns the session reducer and wires it to the template for
 * the game's type, plus scoreboard, turn banner, confetti, fullscreen and
 * keyboard shortcuts for presenter clickers.
 */
export function ClassroomPlayer({ game, teamCount, onExit }: ClassroomPlayerProps) {
  // Lazy initializer: teams and the shuffled right column are created once.
  // The player only mounts after the teacher clicks Start, so the random
  // shuffle never runs during server rendering (no hydration mismatch).
  const [state, dispatch] = useReducer(sessionReducer, null, () =>
    initSession(game, createTeams(teamCount)),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(containerRef);
  const tr = translator(game.language);
  const teamName = (team: Team) => `${team.icon} ${tr(`team.${team.id}`)}`;
  const solo = state.teams.length === 1;

  /**
   * Confetti is a reaction to a user action, so it's triggered here in the
   * event handler, not in an effect watching state. The reducer is pure, so
   * running it once more to see the outcome is safe and gives the same
   * result React will store.
   */
  function act(action: SessionAction) {
    const next = sessionReducer(state, action);
    dispatch(action);
    if (next === state) return;
    if (next.phase === "finished") celebrate();
    else if (next.lastResult?.correct && next.lastResult.seq !== state.lastResult?.seq) {
      burst(TEAM_STYLES[next.teams[next.lastResult.teamIndex].color].hex);
    }
  }

  const playAgain = () => dispatch({ type: "reset", rightOrder: createRightOrder(game) });

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    // Enter/Space on a focused button already "clicks" it. Handling them here
    // as well would advance twice and skip a question.
    if (target?.closest("button") && (event.key === "Enter" || event.key === " ")) return;

    const key = event.key.toLowerCase();
    if (key === "f" && fullscreen.isSupported) {
      void fullscreen.toggle();
      return;
    }
    if (state.phase === "answering" && /^[1-4]$/.test(key)) {
      const n = Number(key);
      if (game.type === "quiz") act({ type: "answer", choice: n - 1 });
      if (game.type === "true-false" && n <= 2) act({ type: "answer", choice: n === 1 });
      return;
    }
    if (state.phase === "feedback" && ["enter", " ", "arrowright", "pagedown"].includes(key)) {
      event.preventDefault();
      act({ type: "next" });
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const total = itemCount(game);
  // Matching has no single question to read, so no button there.
  const spokenText = game.type === "matching" ? null : readAloudText(game.items[state.itemIndex], game.language);
  const progress =
    game.type === "matching"
      ? tr("progress.pairs", { n: state.matchedIds.length, total })
      : tr("progress.question", { n: state.itemIndex + 1, total });

  return (
    <div ref={containerRef} className="flex min-h-dvh w-full flex-col gap-4 overflow-auto bg-slate-50 p-4 md:px-8 md:py-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{game.title}</h1>
          {state.phase !== "finished" && <p className="text-xl text-slate-600">{progress}</p>}
        </div>
        <div className="flex gap-2">
          {fullscreen.isSupported && (
            <button type="button" onClick={() => void fullscreen.toggle()} className={TOOLBAR_BUTTON}>
              {fullscreen.isFullscreen ? tr("fullscreen.exit") : tr("fullscreen.enter")}
            </button>
          )}
          {onExit && (
            <button type="button" onClick={onExit} className={TOOLBAR_BUTTON}>
              {tr("exit")}
            </button>
          )}
        </div>
      </header>

      <Scoreboard
        teams={state.teams}
        currentTeam={state.currentTeam}
        language={game.language}
        highlight={state.phase !== "finished"}
      />

      {/* justify-center-safe: if content is taller than the screen it starts at the top instead of being clipped. */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center-safe gap-5">
        {state.phase === "finished" ? (
          <EndScreen state={state} total={total} tr={tr} teamName={teamName} onPlayAgain={playAgain} onExit={onExit} />
        ) : (
          <>
            {(!solo || spokenText) && (
              // Same row as the turn banner, so the button costs no extra height at 720p.
              <div className="flex flex-wrap items-center justify-center gap-4">
                {!solo && <TurnBanner state={state} teamName={teamName} tr={tr} />}
                {spokenText && (
                  // A new key per question remounts the button, which stops the previous audio.
                  <ReadAloudButton key={`${game.id}-${state.itemIndex}`} text={spokenText} language={game.language} />
                )}
              </div>
            )}
            <GameBoard state={state} act={act} />
            <Feedback state={state} solo={solo} total={total} tr={tr} teamName={teamName} act={act} />
          </>
        )}
      </main>
    </div>
  );
}

const TOOLBAR_BUTTON =
  "rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-lg font-bold hover:border-slate-500 md:text-xl";

type Tr = ReturnType<typeof translator>;

function TurnBanner({ state, teamName, tr }: { state: SessionState; teamName: (t: Team) => string; tr: Tr }) {
  // Quiz/true-false: during feedback this is still the team that just answered.
  const team = state.teams[state.currentTeam];
  return (
    <p
      key={`${team.id}-${state.itemIndex}`}
      aria-live="polite"
      className={`animate-pop rounded-full px-8 py-2 text-3xl font-bold shadow ${TEAM_STYLES[team.color].banner}`}
    >
      {tr("turn", { team: teamName(team) })}
    </p>
  );
}

function GameBoard({ state, act }: { state: SessionState; act: (a: SessionAction) => void }) {
  const { game } = state;
  const choice = state.lastResult?.kind === "answer" ? state.lastResult.choice : null;

  switch (game.type) {
    case "quiz":
      return (
        <QuizTemplate
          item={game.items[state.itemIndex]}
          phase={state.phase}
          choice={typeof choice === "number" ? choice : null}
          onAnswer={(c) => act({ type: "answer", choice: c })}
        />
      );
    case "true-false":
      return (
        <TrueFalseTemplate
          item={game.items[state.itemIndex]}
          phase={state.phase}
          choice={typeof choice === "boolean" ? choice : null}
          language={game.language}
          onAnswer={(c) => act({ type: "answer", choice: c })}
        />
      );
    case "matching":
      return (
        <MatchingTemplate
          pairs={game.pairs}
          rightOrder={state.rightOrder}
          matchedIds={state.matchedIds}
          lastResult={state.lastResult}
          language={game.language}
          onMatch={(leftId, rightId) => act({ type: "match", leftId, rightId })}
        />
      );
  }
}

function correctAnswerText(state: SessionState, tr: Tr): string {
  const { game } = state;
  if (game.type === "quiz") {
    const item = game.items[state.itemIndex];
    return item.options[item.correctIndex];
  }
  if (game.type === "true-false") return game.items[state.itemIndex].answer ? tr("true") : tr("false");
  return "";
}

function Feedback({
  state,
  solo,
  total,
  tr,
  teamName,
  act,
}: {
  state: SessionState;
  solo: boolean;
  total: number;
  tr: Tr;
  teamName: (t: Team) => string;
  act: (a: SessionAction) => void;
}) {
  const result = state.lastResult;
  if (!result) return <div className="min-h-20" />;

  if (result.kind === "match") {
    const team = state.teams[result.teamIndex];
    const text = result.correct
      ? `${tr("match.correct")}${solo ? "" : ` ${tr("pointFor", { team: teamName(team) })}`}`
      : solo
        ? tr("match.wrongSolo")
        : tr("match.wrong");
    return (
      <p
        key={result.seq}
        role="status"
        className={`animate-pop min-h-12 text-center text-3xl font-bold md:text-4xl ${result.correct ? "text-emerald-700" : "text-rose-700"}`}
      >
        {text}
      </p>
    );
  }

  const isLast = state.itemIndex + 1 >= total;
  const team = state.teams[result.teamIndex];
  return (
    <div className="flex w-full flex-col items-center gap-4 md:flex-row md:justify-between">
      <div role="status" className="animate-pop text-center md:text-left">
        <p className={`text-4xl font-bold ${result.correct ? "text-emerald-700" : "text-rose-700"}`}>
          {result.correct ? `🎉 ${tr("correct")}` : tr("wrong")}
          {result.correct && !solo && <span className="ml-3 text-3xl">{tr("pointFor", { team: teamName(team) })}</span>}
        </p>
        {!result.correct && (
          <p className="text-3xl">{tr("answerIs", { answer: correctAnswerText(state, tr) })}</p>
        )}
      </div>
      <button
        type="button"
        autoFocus
        onClick={() => act({ type: "next" })}
        className="min-h-20 rounded-3xl bg-violet-600 px-12 text-4xl font-bold text-white shadow-lg hover:bg-violet-700 active:scale-[0.98]"
      >
        {isLast ? tr("results") : `${tr("next")} →`}
      </button>
    </div>
  );
}

function EndScreen({
  state,
  total,
  tr,
  teamName,
  onPlayAgain,
  onExit,
}: {
  state: SessionState;
  total: number;
  tr: Tr;
  teamName: (t: Team) => string;
  onPlayAgain: () => void;
  onExit?: () => void;
}) {
  const solo = state.teams.length === 1;
  const winners = getWinners(state.teams);

  return (
    <section className="animate-pop flex flex-col items-center gap-8 text-center">
      <p aria-hidden className="text-8xl">
        🏆
      </p>
      {solo ? (
        <>
          <h2 className="text-5xl font-bold md:text-7xl">{tr("end.solo")}</h2>
          <p className="text-3xl md:text-4xl">{tr("end.soloScore", { score: state.teams[0].score, total })}</p>
        </>
      ) : (
        <>
          <h2 className="text-5xl font-bold md:text-7xl">
            {winners.length === 1 ? tr("end.winner", { team: teamName(winners[0]) }) : tr("end.tie")}
          </h2>
          <ol className="flex flex-col gap-3 text-3xl md:text-4xl">
            {rankTeams(state.teams).map((team) => (
              <li key={team.id}>
                {teamName(team)}: <strong>{team.score === 1 ? tr("end.point") : tr("end.points", { score: team.score })}</strong>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          autoFocus
          onClick={onPlayAgain}
          className="min-h-24 rounded-3xl bg-violet-600 px-10 text-3xl font-bold text-white shadow-lg hover:bg-violet-700 md:text-4xl"
        >
          {tr("playAgain")}
        </button>
        {onExit && (
          <button
            type="button"
            onClick={onExit}
            className="min-h-24 rounded-3xl border-4 border-slate-300 bg-white px-10 text-3xl font-bold hover:border-slate-500 md:text-4xl"
          >
            {tr("exit")}
          </button>
        )}
      </div>
    </section>
  );
}
