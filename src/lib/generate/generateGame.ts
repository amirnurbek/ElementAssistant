import { contentSchemaByType, toGame, type Game, type GameMeta } from "@/lib/schemas";
import type { GameModel } from "./gemini";
import { contentJsonSchema } from "./jsonSchema";
import { buildPrompt, buildRetryPrompt } from "./prompt";
import type { GenerateRequest } from "./request";

export class GenerationError extends Error {
  constructor(
    readonly code: "invalid_output" | "upstream",
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

type Attempt = { ok: true; content: unknown } | { ok: false; problems: string[] };

/** JSON.parse + Zod. Returns readable problems instead of throwing. */
function check(request: GenerateRequest, raw: string): Attempt {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, problems: ["The answer was not valid JSON."] };
  }
  const result = contentSchemaByType[request.gameType].safeParse(json);
  if (result.success) return { ok: true, content: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  };
}

export interface GenerateOptions {
  signal?: AbortSignal;
  /** Injectable for tests; defaults to a random UUID. */
  makeId?: () => string;
  /** Called with the problems of each failed attempt (for server logs). */
  onInvalid?: (attempt: number, problems: string[]) => void;
}

/**
 * Ask the model, validate with the content schema, retry once with the
 * problems listed, then give up with "invalid_output".
 *
 * Only invalid output is retried. If the call itself fails (rate limit,
 * outage, timeout), retrying right away would most likely fail again and
 * make the teacher wait twice as long, so that becomes "upstream" at once.
 */
export async function generateGame(
  request: GenerateRequest,
  model: GameModel,
  { signal, makeId = () => crypto.randomUUID(), onInvalid }: GenerateOptions = {},
): Promise<Game> {
  const schema = contentJsonSchema(request.gameType);
  let prompt = buildPrompt(request);

  for (let attempt = 1; attempt <= 2; attempt++) {
    let raw: string;
    try {
      raw = await model.generateJson(prompt, schema, signal);
    } catch (error) {
      throw new GenerationError("upstream", "The model request failed", error);
    }

    const result = check(request, raw);
    if (result.ok) {
      // The app owns ids and metadata. Gemini only supplied the content.
      const meta: GameMeta = {
        id: `gen-${makeId()}`,
        title: request.topic,
        subject: request.subject,
        topic: request.topic,
        grade: request.grade,
        language: request.language,
      };
      // Cast is safe: the content was parsed by contentSchemaByType[gameType].
      return toGame(request.gameType, meta, result.content as never);
    }

    onInvalid?.(attempt, result.problems);
    prompt = buildRetryPrompt(request, result.problems);
  }

  throw new GenerationError("invalid_output", "The model returned invalid content twice");
}
