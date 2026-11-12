import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GameFlow } from "@/components/GameFlow";
import { SAMPLE_GAMES, getSampleGame } from "@/data/samples";

/**
 * All 5 demo pages are prerendered at build time. With Cache Components on,
 * `dynamicParams = false` isn't available, so unknown ids hit notFound() instead.
 */
export function generateStaticParams() {
  return SAMPLE_GAMES.map((game) => ({ id: game.id }));
}

export async function generateMetadata({ params }: PageProps<"/demo/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = getSampleGame(id);
  return { title: game ? `${game.title} · Element` : "Game not found · Element" };
}

/**
 * Next 16 (Cache Components) treats `params` as URL data. Reading it inside a
 * <Suspense> boundary lets client navigations show the shell right away
 * instead of blocking until the params resolve.
 */
export default function DemoGamePage({ params }: PageProps<"/demo/[id]">) {
  return (
    <Suspense fallback={<p className="p-8 text-xl text-slate-500">Loading game…</p>}>
      <DemoGame params={params} />
    </Suspense>
  );
}

async function DemoGame({ params }: { params: PageProps<"/demo/[id]">["params"] }) {
  const { id } = await params;
  const game = getSampleGame(id);
  if (!game) notFound();
  return <GameFlow game={game} backHref="/demo" backLabel="All demo games" />;
}
