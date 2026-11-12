// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { outOfRangeQuizJson, quizRequest, validQuizJson } from "@/lib/generate/fixtures";
import type { GameModel } from "@/lib/generate/gemini";
import { gameSchema } from "@/lib/schemas";

const generateJson = vi.hoisted(() => vi.fn<GameModel["generateJson"]>());
const createGeminiModel = vi.hoisted(() => vi.fn(() => ({ generateJson })));
vi.mock("@/lib/generate/gemini", () => ({ createGeminiModel, DEFAULT_GEMINI_MODEL: "default-model" }));

const { POST } = await import("./route");

const KEY = "secret-test-key-123";

function post(body: unknown, init: RequestInit = {}) {
  return POST(
    new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      ...init,
    }),
  );
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", KEY);
  vi.stubEnv("GEMINI_MODEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  generateJson.mockReset();
  createGeminiModel.mockClear();
});

describe("POST /api/generate", () => {
  it("returns 200 with a valid game", async () => {
    generateJson.mockResolvedValueOnce(validQuizJson);
    const response = await post(quizRequest);
    expect(response.status).toBe(200);
    const { game } = await response.json();
    expect(gameSchema.safeParse(game).success).toBe(true);
    expect(game).toMatchObject({ type: "quiz", title: "Adding to 10", grade: 1 });
    expect(createGeminiModel).toHaveBeenCalledWith(KEY, "default-model");
  });

  it("uses GEMINI_MODEL when set", async () => {
    vi.stubEnv("GEMINI_MODEL", "custom-model");
    generateJson.mockResolvedValueOnce(validQuizJson);
    await post(quizRequest);
    expect(createGeminiModel).toHaveBeenCalledWith(KEY, "custom-model");
  });

  it("returns 200 when the first answer is invalid and the retry is valid", async () => {
    generateJson.mockResolvedValueOnce(outOfRangeQuizJson).mockResolvedValueOnce(validQuizJson);
    const response = await post(quizRequest);
    expect(response.status).toBe(200);
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("returns 502 invalid_output with a friendly message after two invalid answers", async () => {
    generateJson.mockResolvedValue("not json at all");
    const response = await post(quizRequest);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "invalid_output",
      message: "We couldn't create a good game this time. Please try again or change the topic.",
    });
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("returns 502 upstream when Gemini fails, without retrying", async () => {
    generateJson.mockRejectedValue(Object.assign(new Error("quota"), { name: "ApiError", status: 429 }));
    const response = await post(quizRequest);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("upstream");
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith("[generate] upstream (ApiError 429)");
  });

  it("returns 503 not_configured when there is no API key, without calling Gemini", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await post(quizRequest);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("not_configured");
    expect(createGeminiModel).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that isn't JSON", async () => {
    const response = await post("{oops");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "bad_request", issues: ["Body must be JSON"] });
  });

  it.each([
    ["unknown subject", { ...quizRequest, subject: "history" }, "subject"],
    ["empty topic", { ...quizRequest, topic: "   " }, "topic"],
    ["grade 5", { ...quizRequest, grade: 5 }, "grade"],
    ["unknown game type", { ...quizRequest, gameType: "memory" }, "gameType"],
    ["unsupported language", { ...quizRequest, language: "fr" }, "language"],
  ])("returns 400 for %s and doesn't call Gemini", async (_name, body, field) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("bad_request");
    expect(json.issues.join(" ")).toContain(field);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("never puts the API key in a response", async () => {
    generateJson.mockRejectedValue(new Error(`bad key ${KEY}`));
    const responses = [await post(quizRequest), await post({}), await post("x")];
    generateJson.mockReset().mockResolvedValue(validQuizJson);
    responses.push(await post(quizRequest));
    for (const response of responses) expect(await response.text()).not.toContain(KEY);
  });

  it("passes a signal that aborts when the client disconnects", async () => {
    const controller = new AbortController();
    generateJson.mockImplementation(async (_prompt, _schema, signal) => {
      controller.abort();
      expect(signal?.aborted).toBe(true);
      throw new DOMException("aborted", "AbortError");
    });
    const response = await post(quizRequest, { signal: controller.signal });
    expect(response.status).toBe(502);
  });
});
