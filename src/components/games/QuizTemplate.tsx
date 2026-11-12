"use client";

import type { Phase } from "@/lib/game/session";
import type { QuizItem } from "@/lib/schemas";

/**
 * Each option has a color AND a shape, so children who can't tell red from
 * green can still say "the triangle".
 */
const OPTION_STYLES = [
  { shape: "▲", className: "bg-red-600 text-white" },
  { shape: "◆", className: "bg-blue-600 text-white" },
  { shape: "●", className: "bg-amber-400 text-slate-900" },
  { shape: "■", className: "bg-green-700 text-white" },
] as const;

export interface QuizTemplateProps {
  item: QuizItem;
  phase: Phase;
  /** The option chosen for this question, once answered. */
  choice: number | null;
  onAnswer: (choice: number) => void;
}

export function QuizTemplate({ item, phase, choice, onAnswer }: QuizTemplateProps) {
  const revealed = phase !== "answering";

  return (
    <div className="flex w-full flex-col gap-6">
      <h2 className="text-center text-4xl font-bold leading-tight md:text-5xl">{item.question}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        {item.options.map((option, index) => {
          const style = OPTION_STYLES[index];
          const isCorrect = index === item.correctIndex;
          const isChosen = index === choice;
          let state = "";
          if (revealed) {
            state = isCorrect
              ? "ring-8 ring-emerald-400 scale-[1.02]"
              : isChosen
                ? "opacity-60"
                : "opacity-30";
          }
          return (
            <button
              key={index}
              type="button"
              disabled={revealed}
              onClick={() => onAnswer(index)}
              className={`flex min-h-24 items-center gap-5 rounded-3xl px-6 py-4 text-left text-3xl font-bold shadow-lg transition md:min-h-28 md:text-4xl enabled:hover:brightness-110 enabled:active:scale-[0.98] ${style.className} ${state}`}
            >
              <span aria-hidden className="text-3xl md:text-4xl">
                {style.shape}
              </span>
              <span className="flex-1">{option}</span>
              {revealed && isCorrect && <span aria-label="correct">✓</span>}
              {revealed && isChosen && !isCorrect && <span aria-label="wrong">✗</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
