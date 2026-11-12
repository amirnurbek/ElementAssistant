import Link from "next/link";

const STEPS = [
  { icon: "📝", title: "Pick a topic", text: "Choose subject, grade, game type and language (English or German)." },
  { icon: "👀", title: "Check the game", text: "Read every question first. Fix or delete anything you don't like." },
  { icon: "🎉", title: "Play together", text: "Full screen on the projector, big buttons, teams and a scoreboard." },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 p-4 md:p-8">
      <header className="flex flex-col gap-4">
        <p className="text-6xl" aria-hidden>
          🎲
        </p>
        <h1 className="text-5xl font-bold md:text-6xl">Element</h1>
        <p className="max-w-2xl text-xl text-slate-700 md:text-2xl">
          Classroom learning games for grades 1–4. Math, English and science, played together on the projector.
        </p>
      </header>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-2 rounded-3xl bg-white p-6 shadow-sm">
            <span aria-hidden className="text-4xl">
              {step.icon}
            </span>
            <h2 className="text-xl font-bold">
              {i + 1}. {step.title}
            </h2>
            <p className="text-slate-600">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/create"
          className="inline-block rounded-2xl bg-violet-600 px-8 py-4 text-2xl font-bold text-white shadow hover:bg-violet-700"
        >
          ✨ Create a game
        </Link>
        <Link
          href="/demo"
          className="inline-block rounded-2xl border-4 border-violet-200 bg-white px-8 py-3 text-2xl font-bold text-violet-800 hover:border-violet-400"
        >
          Try the demo games
        </Link>
      </div>
    </main>
  );
}
