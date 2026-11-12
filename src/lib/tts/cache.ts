import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Language } from "@/lib/schemas";

/**
 * TTS cache: identical text is never sent to ElevenLabs twice.
 * Pure Node code, no ElevenLabs, so all of it is tested offline.
 */

export interface TtsRequest {
  text: string;
  language: Language;
  voiceId: string;
  modelId: string;
}

/** Trim and collapse runs of whitespace. Case and punctuation stay: they change how text is spoken. */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * SHA-256 over everything that changes the audio, not just the text: the
 * same sentence in another voice or model is different audio, so it must not
 * come back from the cache. JSON.stringify keeps the fields unambiguous
 * (no "ab"+"c" vs "a"+"bc" collisions).
 */
export function ttsCacheKey({ text, language, voiceId, modelId }: TtsRequest): string {
  const input = JSON.stringify({ text: normalizeText(text), language, voiceId, modelId });
  return createHash("sha256").update(input).digest("hex");
}

export interface AudioStore {
  get(key: string): Promise<Uint8Array | undefined>;
  set(key: string, audio: Uint8Array): Promise<void>;
}

/**
 * In-memory store that evicts the least recently used clip. A Map keeps
 * insertion order, so re-inserting on read moves a clip to the "newest" end.
 */
export class MemoryStore implements AudioStore {
  private readonly entries = new Map<string, Uint8Array>();
  private bytes = 0;

  constructor(
    private readonly maxEntries = 200,
    private readonly maxBytes = 20 * 1024 * 1024,
  ) {}

  async get(key: string) {
    const audio = this.entries.get(key);
    if (audio) {
      this.entries.delete(key);
      this.entries.set(key, audio);
    }
    return audio;
  }

  async set(key: string, audio: Uint8Array) {
    if (audio.byteLength > this.maxBytes) return; // Would evict everything else; not worth it.
    const existing = this.entries.get(key);
    if (existing) {
      this.bytes -= existing.byteLength;
      this.entries.delete(key);
    }
    this.entries.set(key, audio);
    this.bytes += audio.byteLength;
    for (const [oldKey, oldAudio] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) break;
      this.entries.delete(oldKey);
      this.bytes -= oldAudio.byteLength;
    }
  }

  get size() {
    return this.entries.size;
  }
}

const KEY_PATTERN = /^[a-f0-9]{64}$/;

/**
 * One <hash>.mp3 per clip. Survives server restarts. Writes go to a temp file
 * first and are then renamed, so a crash mid-write never leaves a broken clip.
 */
export class FileStore implements AudioStore {
  constructor(private readonly dir: string) {}

  private file(key: string) {
    // Keys are our own hashes; checking anyway means a bad key can never escape the folder.
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid cache key");
    return path.join(this.dir, `${key}.mp3`);
  }

  async get(key: string) {
    try {
      const data = await readFile(this.file(key));
      return data.byteLength > 0 ? new Uint8Array(data) : undefined;
    } catch {
      return undefined; // Missing or unreadable: a cache miss, not an error.
    }
  }

  async set(key: string, audio: Uint8Array) {
    const target = this.file(key);
    const temp = `${target}.${randomUUID()}.tmp`;
    await mkdir(this.dir, { recursive: true });
    try {
      await writeFile(temp, audio);
      await rename(temp, target);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }
}

/** Reads the fastest tier first; a hit in a slower tier is copied into the faster ones. */
export class TieredStore implements AudioStore {
  constructor(private readonly tiers: AudioStore[]) {}

  async get(key: string) {
    for (let i = 0; i < this.tiers.length; i++) {
      const audio = await this.tiers[i].get(key);
      if (audio) {
        await Promise.allSettled(this.tiers.slice(0, i).map((tier) => tier.set(key, audio)));
        return audio;
      }
    }
    return undefined;
  }

  /** Writes every tier. One failing tier (e.g. a read-only disk) doesn't stop the others. */
  async set(key: string, audio: Uint8Array) {
    const results = await Promise.allSettled(this.tiers.map((tier) => tier.set(key, audio)));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) throw failed.reason;
  }
}

export type Synthesize = (request: TtsRequest) => Promise<Uint8Array>;

export interface CachedResult {
  audio: Uint8Array;
  /** true when no new ElevenLabs call was made for this request. */
  cached: boolean;
}

/**
 * Wraps a synthesize function with the cache.
 *
 * In-flight sharing: the pending promise is registered *synchronously*,
 * before any await, so two requests for the same text that arrive together
 * (two clicks, two classrooms) share one ElevenLabs call. Checking only the
 * store would let both miss and both generate.
 *
 * Failures are never cached, and the in-flight entry is removed either way,
 * so the next request simply tries again. Storing is best effort: if it fails,
 * the audio is still returned.
 */
export function createCachedSynth(
  store: AudioStore,
  synthesize: Synthesize,
  onStoreError: (error: unknown) => void = () => {},
) {
  const inFlight = new Map<string, Promise<CachedResult>>();

  return async function cachedSynth(request: TtsRequest): Promise<CachedResult> {
    const normalized = { ...request, text: normalizeText(request.text) };
    const key = ttsCacheKey(normalized);

    const pending = inFlight.get(key);
    if (pending) return { audio: (await pending).audio, cached: true };

    const work = (async (): Promise<CachedResult> => {
      const hit = await store.get(key).catch(() => undefined);
      if (hit) return { audio: hit, cached: true };
      const audio = await synthesize(normalized);
      await store.set(key, audio).catch(onStoreError);
      return { audio, cached: false };
    })();

    inFlight.set(key, work);
    try {
      return await work;
    } finally {
      inFlight.delete(key);
    }
  };
}
