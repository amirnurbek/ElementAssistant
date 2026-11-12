"use client";

import type { ReactNode } from "react";
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  addOption,
  removeEntry,
  removeOption,
  setOption,
  updateEntry,
  validateDraft,
} from "@/lib/game/edit";
import { GAME_TYPE_LABELS, SUBJECT_LABELS, countLabel } from "@/lib/labels";
import type { Game, MatchingPair, QuizItem, TrueFalseItem } from "@/lib/schemas";

export interface GamePreviewProps {
  /** The current draft. It may be invalid while the teacher edits. */
  game: Game;
  /** True when the draft differs from the original game. */
  dirty: boolean;
  onChange: (game: Game) => void;
  onReset: () => void;
  /** Called with the validated, trimmed game. */
  onPlay: (game: Game) => void;
}

/**
 * Teacher-only screen shown before every game: read through the items, fix
 * or delete what you don't want, then play. Built for any Game, so
 * AI-generated games can use the same screen later.
 */
export function GamePreview({ game, dirty, onChange, onReset, onPlay }: GamePreviewProps) {
  const validation = validateDraft(game);
  const fields = validation.ok ? new Set<string>() : validation.fields;
  const errorsFor = (id: string) => (validation.ok ? [] : (validation.byEntry[id] ?? []));
  const problemCount = validation.ok
    ? 0
    : validation.general.length + Object.values(validation.byEntry).reduce((n, list) => n + list.length, 0);
  const subject = SUBJECT_LABELS[game.subject];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-8">
      <header className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-violet-700">Preview and edit</p>
          <h1 className="text-3xl font-bold">{game.title}</h1>
          <ul className="flex flex-wrap gap-2 text-sm" aria-label="Game details">
            <Badge>
              {subject.icon} {subject.label}
            </Badge>
            <Badge>Grade {game.grade}</Badge>
            <Badge>{game.language.toUpperCase()}</Badge>
            <Badge>{GAME_TYPE_LABELS[game.type]}</Badge>
            <Badge>{countLabel(game)}</Badge>
          </ul>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:items-end">
          <button
            type="button"
            disabled={!validation.ok}
            onClick={() => validation.ok && onPlay(validation.game)}
            className="rounded-2xl bg-violet-600 px-10 py-4 text-2xl font-bold text-white shadow hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            ▶ Play
          </button>
          {dirty && (
            <button type="button" onClick={onReset} className="text-sm font-bold text-slate-600 underline hover:text-slate-900">
              Undo all changes
            </button>
          )}
        </div>
      </header>

      {!validation.ok && (
        <div role="alert" className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-900">
          <p className="font-bold">
            Fix {problemCount === 1 ? "1 problem" : `${problemCount} problems`} before playing.
          </p>
          {validation.general.length > 0 && (
            <ul className="mt-1 list-disc pl-6">
              {validation.general.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="flex flex-col gap-4">
        {game.type === "quiz" &&
          game.items.map((item, index) => (
            <EntryCard key={item.id} label={`Question ${index + 1}`} errors={errorsFor(item.id)} onDelete={() => onChange(removeEntry(game, item.id))}>
              <QuizItemEditor
                item={item}
                index={index}
                fields={fields}
                onChange={(next) => onChange(updateEntry(game, item.id, next))}
              />
            </EntryCard>
          ))}
        {game.type === "true-false" &&
          game.items.map((item, index) => (
            <EntryCard key={item.id} label={`Statement ${index + 1}`} errors={errorsFor(item.id)} onDelete={() => onChange(removeEntry(game, item.id))}>
              <TrueFalseItemEditor
                item={item}
                index={index}
                fields={fields}
                onChange={(patch) => onChange(updateEntry(game, item.id, patch))}
              />
            </EntryCard>
          ))}
        {game.type === "matching" &&
          game.pairs.map((pair, index) => (
            <EntryCard key={pair.id} label={`Pair ${index + 1}`} errors={errorsFor(pair.id)} onDelete={() => onChange(removeEntry(game, pair.id))}>
              <MatchingPairEditor
                pair={pair}
                index={index}
                fields={fields}
                onChange={(patch) => onChange(updateEntry(game, pair.id, patch))}
              />
            </EntryCard>
          ))}
      </ol>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <li className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">{children}</li>;
}

function EntryCard({
  label,
  errors,
  onDelete,
  children,
}: {
  label: string;
  errors: string[];
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <li
      aria-label={label}
      className={`flex flex-col gap-3 rounded-3xl border-2 bg-white p-5 shadow-sm ${errors.length ? "border-rose-300" : "border-transparent"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-500">{label}</h2>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label.toLowerCase()}`}
          className="rounded-xl px-3 py-1 font-bold text-rose-700 hover:bg-rose-50"
        >
          🗑 Delete
        </button>
      </div>
      {children}
      {errors.length > 0 && (
        <ul className="list-disc pl-6 text-rose-700">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TextInput({
  value,
  label,
  invalid,
  onChange,
  placeholder,
  multiline = false,
  className = "",
}: {
  value: string;
  label: string;
  invalid: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Grows with its content so long questions stay fully readable. */
  multiline?: boolean;
  className?: string;
}) {
  const classes = `w-full rounded-xl border-2 px-3 py-2 text-lg outline-none focus:border-violet-500 ${invalid ? "border-rose-400 bg-rose-50" : "border-slate-200"} ${className}`;
  const common = {
    value,
    "aria-label": label,
    "aria-invalid": invalid || undefined,
    placeholder,
  };
  if (multiline) {
    return (
      <textarea
        {...common}
        rows={1}
        // Line breaks would be lost on the projector anyway, so Enter doesn't add one.
        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
        onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, " "))}
        className={`field-sizing-content resize-none ${classes}`}
      />
    );
  }
  return <input type="text" {...common} onChange={(event) => onChange(event.target.value)} className={classes} />;
}

function QuizItemEditor({
  item,
  index,
  fields,
  onChange,
}: {
  item: QuizItem;
  index: number;
  fields: Set<string>;
  onChange: (item: QuizItem) => void;
}) {
  const path = `items.${index}`;
  const n = index + 1;
  return (
    <div className="flex flex-col gap-3">
      <TextInput
        value={item.question}
        label={`Question ${n} text`}
        invalid={fields.has(`${path}.question`)}
        onChange={(question) => onChange({ ...item, question })}
        multiline
        className="text-xl font-bold"
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-slate-500">Options (select the correct answer)</legend>
        {item.options.map((option, i) => {
          const isCorrect = i === item.correctIndex;
          const cannotRemove = isCorrect || item.options.length <= MIN_OPTIONS;
          return (
            <div key={i} className="flex items-center gap-3">
              <input
                type="radio"
                name={`correct-${item.id}`}
                checked={isCorrect}
                onChange={() => onChange({ ...item, correctIndex: i })}
                aria-label={`Option ${i + 1} of question ${n} is correct`}
                className="size-6 accent-emerald-600"
              />
              <TextInput
                value={option}
                label={`Question ${n}, option ${i + 1}`}
                invalid={fields.has(`${path}.options.${i}`)}
                placeholder="Type an answer"
                onChange={(text) => onChange(setOption(item, i, text))}
                className={isCorrect ? "border-emerald-400" : ""}
              />
              <button
                type="button"
                disabled={cannotRemove}
                onClick={() => onChange(removeOption(item, i))}
                aria-label={`Remove option ${i + 1} of question ${n}`}
                title={isCorrect ? "Pick another correct answer first" : undefined}
                className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          );
        })}
      </fieldset>
      {item.options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => onChange(addOption(item))}
          className="self-start rounded-xl px-3 py-1 font-bold text-violet-700 hover:bg-violet-50"
        >
          + Add option
        </button>
      )}
    </div>
  );
}

function TrueFalseItemEditor({
  item,
  index,
  fields,
  onChange,
}: {
  item: TrueFalseItem;
  index: number;
  fields: Set<string>;
  onChange: (patch: Partial<Omit<TrueFalseItem, "id">>) => void;
}) {
  const path = `items.${index}`;
  const n = index + 1;
  return (
    <div className="flex flex-col gap-3">
      <TextInput
        value={item.statement}
        label={`Statement ${n} text`}
        invalid={fields.has(`${path}.statement`)}
        onChange={(statement) => onChange({ statement })}
        multiline
        className="text-xl font-bold"
      />
      <fieldset className="flex gap-6">
        <legend className="mb-1 text-sm text-slate-500">This statement is</legend>
        {[true, false].map((value) => (
          <label key={String(value)} className="flex items-center gap-2 text-lg font-bold">
            <input
              type="radio"
              name={`answer-${item.id}`}
              checked={item.answer === value}
              onChange={() => onChange({ answer: value })}
              className="size-5 accent-violet-600"
            />
            {value ? "True" : "False"}
          </label>
        ))}
      </fieldset>
      <TextInput
        value={item.explanation ?? ""}
        label={`Statement ${n} explanation`}
        invalid={fields.has(`${path}.explanation`)}
        placeholder="Explanation shown after answering (optional)"
        multiline
        // The schema rejects an empty explanation, so clearing the field removes it.
        onChange={(text) => onChange({ explanation: text.trim() === "" ? undefined : text })}
      />
    </div>
  );
}

function MatchingPairEditor({
  pair,
  index,
  fields,
  onChange,
}: {
  pair: MatchingPair;
  index: number;
  fields: Set<string>;
  onChange: (patch: Partial<Omit<MatchingPair, "id">>) => void;
}) {
  const path = `pairs.${index}`;
  const n = index + 1;
  return (
    <div className="flex items-center gap-3">
      <TextInput
        value={pair.left}
        label={`Pair ${n} left card`}
        invalid={fields.has(`${path}.left`)}
        onChange={(left) => onChange({ left })}
        className="text-xl font-bold"
      />
      <span aria-hidden className="text-2xl text-slate-400">
        ↔
      </span>
      <TextInput
        value={pair.right}
        label={`Pair ${n} right card`}
        invalid={fields.has(`${path}.right`)}
        onChange={(right) => onChange({ right })}
        className="text-xl font-bold"
      />
    </div>
  );
}
