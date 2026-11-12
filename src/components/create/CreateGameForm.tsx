"use client";

import type { FormEvent, ReactNode } from "react";
import { generateRequestSchema, type GenerateRequest } from "@/lib/generate/request";
import { GAME_TYPE_LABELS, SUBJECT_LABELS } from "@/lib/labels";
import { GAME_TYPES, LANGUAGES, SUBJECTS, type Language, type Subject } from "@/lib/schemas";

/** A few ideas per subject, in the language the game will be in. Clicking one fills the topic. */
const TOPIC_IDEAS: Record<Subject, Record<Language, string[]>> = {
  math: {
    en: ["Adding to 20", "Telling time", "Shapes"],
    de: ["Plus bis 20", "Die Uhr lesen", "Formen"],
  },
  english: {
    en: ["Animals", "Colors", "Opposites"],
    de: ["Tiere auf Englisch", "Farben auf Englisch", "Zahlen auf Englisch"],
  },
  science: {
    en: ["The water cycle", "Plants", "Animals in winter"],
    de: ["Der Wasserkreislauf", "Pflanzen", "Tiere im Winter"],
  },
};

const LANGUAGE_LABELS: Record<Language, string> = { en: "English", de: "Deutsch" };

const GAME_TYPE_HINTS = {
  quiz: "8 questions, 3–4 answers each",
  matching: "6 pairs to match",
  "true-false": "8 statements",
} as const;

export interface CreateGameFormProps {
  values: GenerateRequest;
  onChange: (values: GenerateRequest) => void;
  onSubmit: () => void;
}

export function CreateGameForm({ values, onChange, onSubmit }: CreateGameFormProps) {
  // Same schema the server uses, so the button is only enabled for requests the route accepts.
  const valid = generateRequestSchema.safeParse(values).success;
  const set = <K extends keyof GenerateRequest>(key: K, value: GenerateRequest[K]) => onChange({ ...values, [key]: value });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) onSubmit();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <Choice label="Subject">
        {SUBJECTS.map((subject) => (
          <Option key={subject} selected={values.subject === subject} onSelect={() => set("subject", subject)}>
            <span aria-hidden className="text-3xl">
              {SUBJECT_LABELS[subject].icon}
            </span>
            {SUBJECT_LABELS[subject].label}
          </Option>
        ))}
      </Choice>

      <div className="flex flex-col gap-3">
        <label htmlFor="topic" className="text-lg font-bold">
          Topic
        </label>
        <input
          id="topic"
          type="text"
          value={values.topic}
          maxLength={80}
          placeholder="What is the lesson about?"
          onChange={(event) => set("topic", event.target.value)}
          className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xl outline-none focus:border-violet-500"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Ideas:</span>
          {TOPIC_IDEAS[values.subject][values.language].map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => set("topic", idea)}
              className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-800 hover:bg-violet-100"
            >
              {idea}
            </button>
          ))}
        </div>
      </div>

      <Choice label="Grade">
        {([1, 2, 3, 4] as const).map((grade) => (
          <Option key={grade} selected={values.grade === grade} onSelect={() => set("grade", grade)}>
            {grade}
          </Option>
        ))}
      </Choice>

      <Choice label="Game type">
        {GAME_TYPES.map((type) => (
          <Option key={type} selected={values.gameType === type} onSelect={() => set("gameType", type)}>
            {GAME_TYPE_LABELS[type]}
            <span className="text-sm font-normal opacity-80">{GAME_TYPE_HINTS[type]}</span>
          </Option>
        ))}
      </Choice>

      <Choice label="Language of the game">
        {LANGUAGES.map((language) => (
          <Option key={language} selected={values.language === language} onSelect={() => set("language", language)}>
            {LANGUAGE_LABELS[language]}
          </Option>
        ))}
      </Choice>

      <button
        type="submit"
        disabled={!valid}
        className="self-start rounded-2xl bg-violet-600 px-10 py-4 text-2xl font-bold text-white shadow hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        ✨ Create game
      </button>
    </form>
  );
}

/** A labelled group of big toggle buttons. Uses radio semantics for screen readers. */
function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-bold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-3">
        {children}
      </div>
    </fieldset>
  );
}

function Option({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex min-h-16 min-w-16 flex-col items-center justify-center gap-1 rounded-2xl border-4 px-5 py-2 text-xl font-bold transition ${
        selected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white hover:border-violet-400"
      }`}
    >
      {children}
    </button>
  );
}
