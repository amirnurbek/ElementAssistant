import { createGeminiModel, DEFAULT_GEMINI_MODEL } from "@/lib/generate/gemini";
import { GenerationError, generateGame } from "@/lib/generate/generateGame";
import { generateRequestSchema, type GenerateErrorBody, type GenerateErrorCode } from "@/lib/generate/request";

/** Gemini usually answers in a few seconds. After 30 s the teacher gets an error instead of waiting forever. */
const TIMEOUT_MS = 30_000;

const MESSAGES: Record<GenerateErrorCode, string> = {
  bad_request: "Please check the form and try again.",
  not_configured: "Game generation isn't set up yet. You can still play the demo games.",
  invalid_output: "We couldn't create a good game this time. Please try again or change the topic.",
  upstream: "The AI service isn't answering right now. Please try again in a minute.",
};

function errorResponse(status: number, error: GenerateErrorCode, issues?: string[]) {
  const body: GenerateErrorBody = { error, message: MESSAGES[error], ...(issues ? { issues } : {}) };
  return Response.json(body, { status });
}

/**
 * POST /api/generate
 * Body: { subject, topic, grade, gameType, language } -> { game }
 *
 * The API key is read here, on the server, and never sent to the browser.
 * Logs contain error codes and validation problems only: no key, no prompt.
 */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse(503, "not_configured");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", ["Body must be JSON"]);
  }

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "bad_request",
      parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    );
  }

  // Stop waiting when the client disconnects (teacher pressed Cancel) or after the timeout.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  const model = createGeminiModel(apiKey, process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);

  try {
    const game = await generateGame(parsed.data, model, {
      signal,
      onInvalid: (attempt, problems) =>
        console.warn(`[generate] attempt ${attempt} invalid (${parsed.data.gameType}):`, problems.slice(0, 5)),
    });
    return Response.json({ game });
  } catch (error) {
    if (error instanceof GenerationError) {
      // Log the error type and HTTP status only (e.g. ApiError 429), never the message body.
      const cause = error.cause as { name?: string; status?: number } | undefined;
      const detail = cause ? ` (${cause.name ?? "Error"}${cause.status ? ` ${cause.status}` : ""})` : "";
      console.error(`[generate] ${error.code}${detail}`);
      return errorResponse(502, error.code);
    }
    console.error("[generate] unexpected error", error instanceof Error ? error.name : "unknown");
    return errorResponse(500, "upstream");
  }
}
