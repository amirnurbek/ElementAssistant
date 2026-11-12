"use client";

import { useEffect, useEffectEvent } from "react";
import { translator } from "@/lib/i18n";
import type { Language } from "@/lib/schemas";
import { useReadAloud } from "./useReadAloud";

export interface ReadAloudButtonProps {
  text: string;
  language: Language;
}

/**
 * 🔊 button for the current question. Renders nothing until the server says
 * TTS is configured. Give it a `key` per question: remounting stops the old audio.
 * Keyboard: R (for presenter clickers and keyboards).
 */
export function ReadAloudButton({ text, language }: ReadAloudButtonProps) {
  const tr = translator(language);
  const { available, state, toggle } = useReadAloud(language);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!available || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
    if (event.key.toLowerCase() === "r") toggle(text);
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  if (!available) return null;

  const label = state === "loading" ? tr("readAloud.loading") : state === "playing" ? tr("readAloud.stop") : tr("readAloud");
  return (
    <button
      type="button"
      onClick={() => toggle(text)}
      aria-label={label}
      aria-busy={state === "loading" || undefined}
      className="flex min-h-14 items-center gap-3 rounded-full border-4 border-violet-300 bg-white px-6 text-2xl font-bold text-violet-800 shadow hover:border-violet-500 active:scale-[0.98]"
    >
      {state === "loading" ? (
        <span aria-hidden className="size-7 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      ) : (
        <span aria-hidden className="text-3xl">
          {state === "playing" ? "⏹" : "🔊"}
        </span>
      )}
      {label}
    </button>
  );
}
