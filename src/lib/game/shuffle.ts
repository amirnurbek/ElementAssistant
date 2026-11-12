/**
 * Fisher–Yates shuffle. Returns a new array and never mutates the input.
 * `rng` can be swapped out so tests get a fixed order.
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Like shuffle, but the result is never the original order (if length > 1).
 * For the matching game: with 3 pairs a plain shuffle leaves the columns lined
 * up 1 time in 6, which turns the game into "read straight across".
 */
export function shuffleChanged<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = shuffle(items, rng);
  const unchanged = result.every((item, i) => item === items[i]);
  if (unchanged && result.length > 1) result.push(result.shift() as T);
  return result;
}
