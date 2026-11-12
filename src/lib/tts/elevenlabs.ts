import "server-only";
import type { Synthesize } from "./cache";

/**
 * Premade voice from the ElevenLabs API examples. ElevenLabs retires its
 * current default voices on 2026-12-31, so set ELEVENLABS_VOICE_ID to a
 * voice from your own account before then.
 */
export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

/** The API's default model. Speaks English and German with the same voice. */
export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

const API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

export class ElevenLabsError extends Error {
  constructor(readonly status: number) {
    super(`ElevenLabs request failed with status ${status}`);
    this.name = "ElevenLabsError";
  }
}

/** The docs say language_code isn't supported by multilingual_v2 models; it detects the language itself. */
export function supportsLanguageCode(modelId: string): boolean {
  return !modelId.startsWith("eleven_multilingual_v2");
}

/**
 * Plain fetch instead of the SDK: one endpoint, easy to read and to mock.
 * No per-request abort signal on purpose: one generation can be shared by
 * several waiting requests (see createCachedSynth), so one teacher closing
 * the tab must not cancel it for the others. A timeout still applies.
 */
export function createElevenLabsSynth(apiKey: string, timeoutMs = 20_000): Synthesize {
  return async ({ text, language, voiceId, modelId }) => {
    const response = await fetch(`${API_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: modelId,
        ...(supportsLanguageCode(modelId) ? { language_code: language } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new ElevenLabsError(response.status);
    const audio = new Uint8Array(await response.arrayBuffer());
    if (audio.byteLength === 0) throw new ElevenLabsError(502);
    return audio;
  };
}
