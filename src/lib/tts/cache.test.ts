// @vitest-environment node
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FileStore,
  MemoryStore,
  TieredStore,
  createCachedSynth,
  normalizeText,
  ttsCacheKey,
  type AudioStore,
  type TtsRequest,
} from "./cache";

const request: TtsRequest = { text: "What is 2 + 3?", language: "en", voiceId: "voice-a", modelId: "model-a" };
const bytes = (...values: number[]) => new Uint8Array(values);
const key = (n: number) => n.toString(16).padStart(64, "0");

describe("ttsCacheKey", () => {
  it("is a stable SHA-256 hex string", () => {
    expect(ttsCacheKey(request)).toMatch(/^[a-f0-9]{64}$/);
    expect(ttsCacheKey(request)).toBe(ttsCacheKey({ ...request }));
  });

  it("ignores leading, trailing and repeated whitespace", () => {
    expect(ttsCacheKey({ ...request, text: "  What  is 2 +\n3?  " })).toBe(ttsCacheKey(request));
    expect(normalizeText("  a \t b\n\nc ")).toBe("a b c");
  });

  it("keeps case and punctuation, which change how text is spoken", () => {
    expect(ttsCacheKey({ ...request, text: "what is 2 + 3?" })).not.toBe(ttsCacheKey(request));
    expect(ttsCacheKey({ ...request, text: "What is 2 + 3" })).not.toBe(ttsCacheKey(request));
  });

  it.each([
    ["voice", { voiceId: "voice-b" }],
    ["model", { modelId: "model-b" }],
    ["language", { language: "de" as const }],
  ])("changes when the %s changes", (_name, change) => {
    expect(ttsCacheKey({ ...request, ...change })).not.toBe(ttsCacheKey(request));
  });

  it("can't be fooled by moving characters between fields", () => {
    const a = ttsCacheKey({ ...request, text: "ab", voiceId: "c" });
    const b = ttsCacheKey({ ...request, text: "a", voiceId: "bc" });
    expect(a).not.toBe(b);
  });
});

describe("createCachedSynth", () => {
  it("calls the synthesizer once for the same text", async () => {
    const synth = vi.fn(async () => bytes(1, 2, 3));
    const cached = createCachedSynth(new MemoryStore(), synth);

    expect(await cached(request)).toEqual({ audio: bytes(1, 2, 3), cached: false });
    expect(await cached({ ...request, text: ` ${request.text}  ` })).toEqual({ audio: bytes(1, 2, 3), cached: true });
    expect(synth).toHaveBeenCalledTimes(1);
  });

  it("sends the normalized text to the synthesizer", async () => {
    const synth = vi.fn(async () => bytes(1));
    await createCachedSynth(new MemoryStore(), synth)({ ...request, text: "  Hello\n  class " });
    expect(synth).toHaveBeenCalledWith({ ...request, text: "Hello class" });
  });

  it("generates again for different text or voice", async () => {
    const synth = vi.fn(async () => bytes(1));
    const cached = createCachedSynth(new MemoryStore(), synth);
    await cached(request);
    await cached({ ...request, text: "What is 3 + 3?" });
    await cached({ ...request, voiceId: "voice-b" });
    expect(synth).toHaveBeenCalledTimes(3);
  });

  it("shares one call between requests that arrive at the same time", async () => {
    let finish!: (audio: Uint8Array) => void;
    const synth = vi.fn(() => new Promise<Uint8Array>((resolve) => (finish = resolve)));
    const cached = createCachedSynth(new MemoryStore(), synth);

    const all = Promise.all([cached(request), cached(request), cached(request)]);
    await vi.waitFor(() => expect(synth).toHaveBeenCalled());
    finish(bytes(7));
    const results = await all;

    expect(synth).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.cached)).toEqual([false, true, true]);
    expect(results.every((r) => r.audio[0] === 7)).toBe(true);
  });

  it("doesn't cache failures, so the next request tries again", async () => {
    const synth = vi.fn<(r: TtsRequest) => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error("429"))
      .mockResolvedValueOnce(bytes(9));
    const cached = createCachedSynth(new MemoryStore(), synth);

    await expect(cached(request)).rejects.toThrow("429");
    expect(await cached(request)).toEqual({ audio: bytes(9), cached: false });
    expect(synth).toHaveBeenCalledTimes(2);
  });

  it("shares a failure with requests waiting on the same call, then retries fresh", async () => {
    let fail!: (error: Error) => void;
    const synth = vi
      .fn<(r: TtsRequest) => Promise<Uint8Array>>()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => (fail = reject)))
      .mockResolvedValueOnce(bytes(5));
    const cached = createCachedSynth(new MemoryStore(), synth);

    const first = cached(request);
    const second = cached(request);
    await vi.waitFor(() => expect(synth).toHaveBeenCalled());
    fail(new Error("down"));
    await expect(first).rejects.toThrow("down");
    await expect(second).rejects.toThrow("down");
    expect((await cached(request)).audio).toEqual(bytes(5));
  });

  it("still returns audio when storing it fails, and reports the error", async () => {
    const broken: AudioStore = { get: async () => undefined, set: async () => Promise.reject(new Error("read-only")) };
    const onStoreError = vi.fn();
    const result = await createCachedSynth(broken, async () => bytes(4), onStoreError)(request);
    expect(result).toEqual({ audio: bytes(4), cached: false });
    expect(onStoreError).toHaveBeenCalledWith(new Error("read-only"));
  });

  it("treats a failing store read as a miss", async () => {
    const broken: AudioStore = { get: async () => Promise.reject(new Error("io")), set: async () => {} };
    const synth = vi.fn(async () => bytes(2));
    expect(await createCachedSynth(broken, synth)(request)).toEqual({ audio: bytes(2), cached: false });
  });
});

describe("MemoryStore", () => {
  it("evicts the least recently used clip when there are too many", async () => {
    const store = new MemoryStore(2, 1000);
    await store.set(key(1), bytes(1));
    await store.set(key(2), bytes(2));
    await store.get(key(1)); // key 1 is now the most recently used
    await store.set(key(3), bytes(3));
    expect(await store.get(key(2))).toBeUndefined();
    expect(await store.get(key(1))).toEqual(bytes(1));
    expect(await store.get(key(3))).toEqual(bytes(3));
  });

  it("evicts by total bytes", async () => {
    const store = new MemoryStore(100, 10);
    await store.set(key(1), new Uint8Array(6));
    await store.set(key(2), new Uint8Array(6));
    expect(await store.get(key(1))).toBeUndefined();
    expect(store.size).toBe(1);
  });

  it("skips a clip bigger than the whole budget", async () => {
    const store = new MemoryStore(100, 10);
    await store.set(key(1), new Uint8Array(4));
    await store.set(key(2), new Uint8Array(11));
    expect(await store.get(key(2))).toBeUndefined();
    expect(await store.get(key(1))).toBeDefined();
  });

  it("replacing a clip doesn't count its bytes twice", async () => {
    const store = new MemoryStore(100, 10);
    await store.set(key(1), new Uint8Array(6));
    await store.set(key(1), new Uint8Array(6));
    await store.set(key(2), new Uint8Array(4));
    expect(store.size).toBe(2);
  });
});

describe("FileStore", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "tts-cache-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes <hash>.mp3 and reads it back, also from a new instance (after a restart)", async () => {
    await new FileStore(path.join(dir, "nested")).set(key(1), bytes(1, 2, 3));
    expect(await new FileStore(path.join(dir, "nested")).get(key(1))).toEqual(bytes(1, 2, 3));
    expect(await readdir(path.join(dir, "nested"))).toEqual([`${key(1)}.mp3`]);
  });

  it("returns undefined for a missing or empty file", async () => {
    const store = new FileStore(dir);
    expect(await store.get(key(1))).toBeUndefined();
    await writeFile(path.join(dir, `${key(2)}.mp3`), new Uint8Array(0));
    expect(await store.get(key(2))).toBeUndefined();
  });

  it("rejects keys that aren't hashes, so nothing can be written outside the folder", async () => {
    const store = new FileStore(dir);
    await expect(store.set("../../evil", bytes(1))).rejects.toThrow("Invalid cache key");
    expect(await store.get("../../evil")).toBeUndefined();
  });

  it("throws when the folder can't be written, leaving no temp files", async () => {
    const file = path.join(dir, "not-a-folder");
    await writeFile(file, "x");
    await expect(new FileStore(file).set(key(1), bytes(1))).rejects.toThrow();
    expect(await readdir(dir)).toEqual(["not-a-folder"]);
  });
});

describe("TieredStore", () => {
  it("copies a slow-tier hit into the fast tier", async () => {
    const memory = new MemoryStore();
    const slow = new MemoryStore();
    await slow.set(key(1), bytes(8));
    const tiered = new TieredStore([memory, slow]);

    expect(await tiered.get(key(1))).toEqual(bytes(8));
    expect(await memory.get(key(1))).toEqual(bytes(8));
  });

  it("writes to every tier and keeps going when one fails", async () => {
    const memory = new MemoryStore();
    const broken: AudioStore = { get: async () => undefined, set: async () => Promise.reject(new Error("disk full")) };
    const tiered = new TieredStore([memory, broken]);

    await expect(tiered.set(key(1), bytes(3))).rejects.toThrow("disk full");
    expect(await memory.get(key(1))).toEqual(bytes(3));
  });

  it("serves from the file tier after the memory tier is gone (server restart)", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "tts-tier-"));
    try {
      const synth = vi.fn(async () => bytes(6));
      await createCachedSynth(new TieredStore([new MemoryStore(), new FileStore(dir)]), synth)(request);
      // "Restart": fresh memory, same folder.
      const afterRestart = createCachedSynth(new TieredStore([new MemoryStore(), new FileStore(dir)]), synth);
      expect(await afterRestart(request)).toEqual({ audio: bytes(6), cached: true });
      expect(synth).toHaveBeenCalledTimes(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
