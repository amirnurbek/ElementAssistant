import type { Metadata } from "next";
import Link from "next/link";
import { SAMPLE_GAMES } from "@/data/samples";
import { GAME_TYPE_LABELS, SUBJECT_LABELS, countLabel } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Demo games · PlayLesson",
};

export default function DemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-8">
      <nav>
        <Link href="/" className="font-bold text-violet-700 hover:underline">
          ← PlayLesson
        </Link>
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">Demo games</h1>
        <p className="text-lg text-slate-600">
          Five ready-made games. No setup or API keys needed. Pick one, check the questions, then play it with
          your class.
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SAMPLE_GAMES.map((game) => {
          const subject = SUBJECT_LABELS[game.subject];
          return (
            <li key={game.id}>
              <Link
                href={`/demo/${game.id}`}
                className="flex h-full flex-col gap-3 rounded-3xl border-4 border-transparent bg-white p-6 shadow-sm transition hover:border-violet-400 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span aria-hidden className="text-5xl">
                    {subject.icon}
                  </span>
                  {/* Text instead of a flag emoji: Windows (common on school PCs) shows flags as letters anyway. */}
                  <span className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-bold text-white" title="Language">
                    {game.language.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{game.title}</h2>
                <p className="mt-auto text-slate-600">
                  {subject.label} · Grade {game.grade} · {GAME_TYPE_LABELS[game.type]} · {countLabel(game)}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
