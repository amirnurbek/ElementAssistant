import { connection } from "next/server";
import { z } from "zod";
import { languageSchema } from "@/lib/schemas";
import { isTtsEnabled, speak } from "@/lib/tts/service";

/** A 120-char question plus 4 × 60-char options and shape names fits. */
const ttsRequestSchema = z.object({
  text: z.string().trim().min(1).max(400),
  language: languageSchema,
});

type TtsErrorCode = "bad_request" | "not_configured" | "upstream";

function errorResponse(status: number, error: TtsErrorCode) {
  return Response.json({ error }, { status });
}

/**
 * GET /api/tts -> { enabled }
 * The player asks this once to decide whether to show the read-aloud button.
 * connection() makes Next answer at request time instead of baking the
 * answer in at build time, so adding a key only needs a restart.
 */
export async function GET() {
  await connection();
  return Response.json({ enabled: isTtsEnabled() });
}

/**
 * POST /api/tts { text, language } -> audio/mpeg
 * Identical text is served from the cache (x-tts-cache: hit) and never
 * generated twice. Logs never contain the key or the text.
 */
export async function POST(request: Request) {
  if (!isTtsEnabled()) return errorResponse(503, "not_configured");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request");
  }
  const parsed = ttsRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "bad_request");

  try {
    const { audio, cached } = await speak(parsed.data.text, parsed.data.language);
    return new Response(new Blob([audio as Uint8Array<ArrayBuffer>], { type: "audio/mpeg" }), {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(audio.byteLength),
        "x-tts-cache": cached ? "hit" : "miss",
      },
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    console.error(`[tts] upstream (${error instanceof Error ? error.name : "unknown"}${status ? ` ${status}` : ""})`);
    return errorResponse(502, "upstream");
  }
}
