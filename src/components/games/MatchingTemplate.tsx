"use client";

import { useState } from "react";
import type { LastResult } from "@/lib/game/session";
import { translator } from "@/lib/i18n";
import type { Language, MatchingPair } from "@/lib/schemas";

export interface MatchingTemplateProps {
  pairs: MatchingPair[];
  /** Pair ids in the shuffled order of the right column. */
  rightOrder: string[];
  matchedIds: string[];
  lastResult: LastResult | null;
  disabled?: boolean;
  language: Language;
  onMatch: (leftId: string, rightId: string) => void;
}

type Side = "left" | "right";

/**
 * Game state (score, matched pairs, turns) lives in the session reducer. The
 * only state here is which card is currently picked. That is UI state that
 * resets after every attempt, so it doesn't belong in the game logic.
 */
export function MatchingTemplate({
  pairs,
  rightOrder,
  matchedIds,
  lastResult,
  disabled = false,
  language,
  onMatch,
}: MatchingTemplateProps) {
  const tr = translator(language);
  const [selected, setSelected] = useState<{ left: string | null; right: string | null }>({
    left: null,
    right: null,
  });

  const byId = new Map(pairs.map((pair) => [pair.id, pair]));
  const rightPairs = rightOrder.map((id) => byId.get(id)).filter((p): p is MatchingPair => !!p);

  function pick(side: Side, id: string) {
    const next = { ...selected, [side]: selected[side] === id ? null : id };
    if (next.left && next.right) {
      onMatch(next.left, next.right);
      setSelected({ left: null, right: null });
    } else {
      setSelected(next);
    }
  }

  // Up to 8 pairs must fit a 720p projector without scrolling. With more than 4,
  // each side becomes a 2-column grid (4 rows instead of 8).
  const dense = pairs.length > 4;
  const column = dense ? "grid grid-cols-2 content-start gap-3" : "flex flex-col gap-4";
  const lastWrong = lastResult?.kind === "match" && !lastResult.correct ? lastResult : null;

  function card(side: Side, pair: MatchingPair) {
    const matched = matchedIds.includes(pair.id);
    const isSelected = selected[side] === pair.id;
    const shaking = lastWrong && (side === "left" ? lastWrong.leftId : lastWrong.rightId) === pair.id;

    let className = "bg-white text-slate-900 border-slate-300 enabled:hover:border-sky-500";
    if (matched) className = "bg-emerald-100 text-emerald-900 border-emerald-500";
    else if (isSelected) className = "bg-sky-100 text-slate-900 border-sky-500 ring-8 ring-sky-300";

    return (
      <button
        // A new key per wrong attempt remounts the card, so the shake replays every time.
        key={shaking ? `${pair.id}-${lastWrong.seq}` : pair.id}
        type="button"
        disabled={disabled || matched}
        aria-pressed={isSelected}
        onClick={() => pick(side, pair.id)}
        className={`flex items-center justify-center gap-3 rounded-3xl border-4 px-4 font-bold shadow-md transition ${dense ? "min-h-16 py-2 text-2xl md:text-3xl" : "min-h-20 py-3 text-3xl md:min-h-24 md:text-4xl"} ${className} ${shaking ? "animate-shake" : ""}`}
      >
        {matched && <span aria-hidden>✓</span>}
        {side === "left" ? pair.left : pair.right}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-center text-xl text-slate-600 md:text-2xl">{tr("match.instructions")}</p>
      <div className="grid grid-cols-2 gap-6 md:gap-12">
        <div className={column}>{pairs.map((pair) => card("left", pair))}</div>
        <div className={column}>{rightPairs.map((pair) => card("right", pair))}</div>
      </div>
    </div>
  );
}
