import { describe, expect, it } from "vitest";
import { shuffle, shuffleChanged } from "./shuffle";

/** Deterministic pseudo-random sequence for repeatable tests. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("shuffle", () => {
  it("keeps exactly the same elements", () => {
    const input = ["a", "b", "c", "d", "e"];
    expect(shuffle(input, seeded(1)).sort()).toEqual(input);
  });

  it("does not mutate the input", () => {
    const input = [1, 2, 3];
    shuffle(input, seeded(2));
    expect(input).toEqual([1, 2, 3]);
  });

  it("is deterministic for a given rng", () => {
    expect(shuffle([1, 2, 3, 4], seeded(7))).toEqual(shuffle([1, 2, 3, 4], seeded(7)));
  });
});

describe("shuffleChanged", () => {
  it("never returns the original order", () => {
    // rng() = 0.999… makes Fisher–Yates swap each element with itself: identity order.
    const identityRng = () => 0.999999;
    expect(shuffle([1, 2, 3], identityRng)).toEqual([1, 2, 3]);
    expect(shuffleChanged([1, 2, 3], identityRng)).not.toEqual([1, 2, 3]);
  });

  it("differs from the input across many random runs", () => {
    const rng = seeded(42);
    for (let run = 0; run < 200; run++) {
      const result = shuffleChanged(["a", "b", "c"], rng);
      expect(result).not.toEqual(["a", "b", "c"]);
      expect([...result].sort()).toEqual(["a", "b", "c"]);
    }
  });

  it("handles 0 and 1 elements", () => {
    expect(shuffleChanged([])).toEqual([]);
    expect(shuffleChanged(["x"])).toEqual(["x"]);
  });
});
