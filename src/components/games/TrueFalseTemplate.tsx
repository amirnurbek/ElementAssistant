"use client";

import type { Phase } from "@/lib/game/session";
import { translator } from "@/lib/i18n";
import type { Language, TrueFalseItem } from "@/lib/schemas";

export interface TrueFalseTemplateProps {
  item: TrueFalseItem;
  phase: Phase;
  choice: boolean | null;
  language: Language;
  onAnswer: (choice: boolean) => void;
}

export function TrueFalseTemplate({ item, phase, choice, language, onAnswer }: TrueFalseTemplateProps) {
  const tr = translator(language);
  const revealed = phase !== "answering";

  const buttons = [
    { value: true, icon: "✓", label: tr("true"), className: "bg-emerald-600 text-white" },
    { value: false, icon: "✗", label: tr("false"), className: "bg-rose-600 text-white" },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <h2 className="text-center text-4xl font-bold leading-tight md:text-5xl">{item.statement}</h2>
      <div className="grid grid-cols-2 gap-4 md:gap-8">
        {buttons.map(({ value, icon, label, className }) => {
          const isCorrect = value === item.answer;
          let state = "";
          if (revealed) {
            state = isCorrect ? "ring-8 ring-emerald-300 scale-[1.02]" : value === choice ? "opacity-60" : "opacity-30";
          }
          return (
            <button
              key={label}
              type="button"
              disabled={revealed}
              onClick={() => onAnswer(value)}
              className={`flex min-h-32 flex-col items-center justify-center gap-1 rounded-3xl text-4xl font-bold shadow-lg transition md:min-h-44 md:text-5xl enabled:hover:brightness-110 enabled:active:scale-[0.98] ${className} ${state}`}
            >
              <span aria-hidden className="text-5xl md:text-6xl">
                {icon}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      {revealed && item.explanation && (
        <p className="animate-pop rounded-2xl bg-white p-4 text-center text-2xl shadow md:text-3xl">
          💡 {item.explanation}
        </p>
      )}
    </div>
  );
}
