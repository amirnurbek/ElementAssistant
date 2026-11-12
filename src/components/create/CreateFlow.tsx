"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameFlow } from "@/components/GameFlow";
import type { GenerateErrorBody, GenerateRequest } from "@/lib/generate/request";
import { GAME_TYPE_LABELS } from "@/lib/labels";
import { gameSchema, type Game } from "@/lib/schemas";
import { CreateGameForm } from "./CreateGameForm";

type State =
  | { step: "form"; error?: GenerateErrorBody }
  | { step: "generating" }
  | { step: "ready"; game: Game };

const DEFAULT_VALUES: GenerateRequest = {
  subject: "math",
  topic: "",
  grade: 2,
  gameType: "quiz",
  language: "en",
};

const NETWORK_ERROR: GenerateErrorBody = {
  error: "upstream",
  message: "Couldn't reach the server. Check the internet connection and try again.",
};

/**
 * Teacher flow: form -> generating -> preview/edit -> team setup -> play.
 * The form values live here, so they survive errors and "Change settings".
 * Everything after "ready" is the same GameFlow the demo games use.
 */
export function CreateFlow() {
  const [values, setValues] = useState<GenerateRequest>(DEFAULT_VALUES);
  const [state, setState] = useState<State>({ step: "form" });
  const controllerRef = useRef<AbortController | null>(null);

  // Leaving the page while generating cancels the request.
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function generate() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ step: "generating" });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        // The server already validated it. Parsing again keeps the client honest
        // if the route ever changes, and gives us a typed Game.
        const parsed = gameSchema.safeParse((body as { game?: unknown } | null)?.game);
        if (parsed.success) setState({ step: "ready", game: parsed.data });
        else setState({ step: "form", error: { error: "invalid_output", message: "The game we got back was broken. Please try again." } });
        return;
      }
      const error = body as GenerateErrorBody | null;
      setState({ step: "form", error: error?.message ? error : NETWORK_ERROR });
    } catch (error) {
      if (controller.signal.aborted) return; // Cancel: the cancel handler already reset the state.
      console.error(error);
      setState({ step: "form", error: NETWORK_ERROR });
    }
  }

  function cancel() {
    controllerRef.current?.abort();
    setState({ step: "form" });
  }

  if (state.step === "ready") {
    return (
      <GameFlow
        // A new game gets a fresh preview draft.
        key={state.game.id}
        game={state.game}
        header={
          <>
            <button type="button" onClick={() => setState({ step: "form" })} className={LINK_BUTTON}>
              ← Change settings
            </button>
            <button type="button" onClick={() => void generate()} className={LINK_BUTTON}>
              ↻ Generate a new version
            </button>
          </>
        }
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-4 md:p-8">
      <nav>
        <Link href="/" className="font-bold text-violet-700 hover:underline">
          ← PlayLesson
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">Create a game</h1>
        <p className="text-lg text-slate-600">
          Choose what the class should practise. You can check and change every question before you play.
        </p>
      </header>

      {state.step === "generating" ? (
        <div role="status" className="flex flex-col items-center gap-6 rounded-3xl bg-white p-10 text-center shadow-sm">
          <span aria-hidden className="size-16 animate-spin rounded-full border-8 border-violet-200 border-t-violet-600" />
          <p className="text-2xl font-bold">
            Creating your {GAME_TYPE_LABELS[values.gameType].toLowerCase()} about “{values.topic.trim()}”…
          </p>
          <p className="text-slate-600">This usually takes about 10 seconds.</p>
          <button type="button" onClick={cancel} className="rounded-xl border-2 border-slate-300 px-6 py-2 font-bold hover:border-slate-500">
            Cancel
          </button>
        </div>
      ) : (
        <>
          {state.error && <ErrorBox error={state.error} onRetry={() => void generate()} />}
          <CreateGameForm values={values} onChange={setValues} onSubmit={() => void generate()} />
        </>
      )}
    </main>
  );
}

const LINK_BUTTON = "font-bold text-violet-700 hover:underline";

function ErrorBox({ error, onRetry }: { error: GenerateErrorBody; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 text-rose-900">
      <p className="text-lg font-bold">{error.message}</p>
      {error.error === "not_configured" ? (
        <Link href="/demo" className="self-start font-bold text-violet-700 underline">
          Play the demo games →
        </Link>
      ) : error.error !== "bad_request" ? (
        <button type="button" onClick={onRetry} className="self-start rounded-xl bg-rose-700 px-5 py-2 font-bold text-white hover:bg-rose-800">
          Try again
        </button>
      ) : null}
    </div>
  );
}
