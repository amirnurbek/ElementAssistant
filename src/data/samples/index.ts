import type { Game } from "@/lib/schemas";
import { additionTo20 } from "./addition-to-20";
import { einmaleins } from "./einmaleins";
import { opposites } from "./opposites";
import { tiereZuhause } from "./tiere-zuhause";
import { waterCycle } from "./water-cycle";

/**
 * Demo mode: 5 bundled games that work without any API keys.
 * Each one is built with toGame(), which parses it with the game schema when
 * the module loads. A broken sample fails loudly at build time, not in class.
 */
export const SAMPLE_GAMES: readonly Game[] = [additionTo20, opposites, waterCycle, tiereZuhause, einmaleins];

export function getSampleGame(id: string): Game | undefined {
  return SAMPLE_GAMES.find((game) => game.id === id);
}
