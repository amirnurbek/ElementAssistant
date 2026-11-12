import "server-only";
import path from "node:path";
import { FileStore, MemoryStore, TieredStore, createCachedSynth, type CachedResult } from "./cache";
import { DEFAULT_MODEL_ID, DEFAULT_VOICE_ID, createElevenLabsSynth } from "./elevenlabs";
import type { Language } from "@/lib/schemas";

let cachedSynth: ReturnType<typeof createCachedSynth> | undefined;

/**
 * One cache per server process, created on first use: memory in front,
 * <hash>.mp3 files behind it, so clips survive a restart.
 * TTS_CACHE_DIR can point somewhere writable (e.g. /tmp on serverless).
 */
function getCachedSynth() {
  cachedSynth ??= createCachedSynth(
    new TieredStore([
      new MemoryStore(),
      new FileStore(process.env.TTS_CACHE_DIR || path.join(process.cwd(), ".cache", "tts")),
    ]),
    // The key is read per call, so it never sits in a long-lived closure.
    (request) => createElevenLabsSynth(process.env.ELEVENLABS_API_KEY ?? "")(request),
    (error) => console.warn("[tts] could not store clip:", error instanceof Error ? error.name : "unknown"),
  );
  return cachedSynth;
}

export function isTtsEnabled(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function speak(text: string, language: Language): Promise<CachedResult> {
  return getCachedSynth()({
    text,
    language,
    voiceId: process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID,
    modelId: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
  });
}
