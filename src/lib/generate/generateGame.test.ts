// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { gameSchema } from "@/lib/schemas";
import {
  duplicatePairsJson,
  matchingRequest,
  outOfRangeQuizJson,
  quizRequest,
  validPairsJson,
  validQuizJson,
} from "./fixtures";
import type { GameModel } from "./gemini";
import { GenerationError, generateGame } from "./generateGame";

/** A fake model that returns (or throws) the given answers in order. */
function fakeModel(...answers: (string | Error)[]) {
  const generateJson = vi.fn<GameModel["generateJson"]>();
  for (const answer of answers) {
    if (answer instanceof Error) generateJson.mockRejectedValueOnce(answer);
    else generateJson.mockResolvedValueOnce(answer);
  }
  return { generateJson };
}

const opts = { makeId: () => "fixed" };

async function expectError(promise: Promise<unknown>, code: GenerationError["code"]) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(GenerationError);
  expect((error as GenerationError).code).toBe(code);
}

describe("generateGame", () => {
  it("returns a valid game after one call when the output is valid", async () => {
    const model = fakeModel(validQuizJson);
    const game = await generateGame(quizRequest, model, opts);
    expect(model.generateJson).toHaveBeenCalledTimes(1);
    expect(gameSchema.safeParse(game).success).toBe(true);
  });

  it("uses the teacher's metadata and app-made ids, and drops extra fields from the model", async () => {
    const withExtras = JSON.stringify({ ...JSON.parse(validQuizJson), title: "Model title", grade: 4, id: "evil" });
    const game = await generateGame(quizRequest, fakeModel(withExtras), opts);
    expect(game).toMatchObject({
      id: "gen-fixed",
      title: "Adding to 10",
      topic: "Adding to 10",
      grade: 1,
      language: "en",
      subject: "math",
      type: "quiz",
    });
    expect(game.type === "quiz" && game.items.map((i) => i.id)).toEqual(["q1", "q2"]);
  });

  it("sends the JSON schema for the requested game type", async () => {
    const model = fakeModel(validQuizJson);
    await generateGame(quizRequest, model, opts);
    const schema = model.generateJson.mock.calls[0][1];
    expect(schema).toMatchObject({ properties: { items: { type: "array" } } });
    expect(schema).not.toHaveProperty("$schema");
  });

  it("retries once after non-JSON output and tells the model what was wrong", async () => {
    const model = fakeModel("Sure! Here is your quiz: {", validQuizJson);
    const onInvalid = vi.fn();
    const game = await generateGame(quizRequest, model, { ...opts, onInvalid });
    expect(game.type).toBe("quiz");
    expect(model.generateJson).toHaveBeenCalledTimes(2);
    expect(model.generateJson.mock.calls[1][0].user).toContain("The answer was not valid JSON.");
    expect(onInvalid).toHaveBeenCalledWith(1, ["The answer was not valid JSON."]);
  });

  it("retries once after output that breaks a schema rule", async () => {
    const model = fakeModel(outOfRangeQuizJson, validQuizJson);
    await generateGame(quizRequest, model, opts);
    expect(model.generateJson).toHaveBeenCalledTimes(2);
    expect(model.generateJson.mock.calls[1][0].user).toContain(
      "items.0.correctIndex: The correct answer must be one of the options",
    );
  });

  it("catches duplicate matching cards that JSON mode can't prevent", async () => {
    const model = fakeModel(duplicatePairsJson, validPairsJson);
    const game = await generateGame(matchingRequest, model, opts);
    expect(game.type).toBe("matching");
    expect(model.generateJson.mock.calls[1][0].user).toContain("pairs.1.left: Each left card must be different");
  });

  it("gives up with invalid_output after exactly 2 invalid answers", async () => {
    const model = fakeModel(outOfRangeQuizJson, "{}", validQuizJson);
    await expectError(generateGame(quizRequest, model, opts), "invalid_output");
    expect(model.generateJson).toHaveBeenCalledTimes(2);
  });

  it("treats output for the wrong game type as invalid", async () => {
    const model = fakeModel(validPairsJson, validPairsJson);
    await expectError(generateGame(quizRequest, model, opts), "invalid_output");
  });

  it("does not retry when the model call itself fails", async () => {
    const model = fakeModel(Object.assign(new Error("Too many requests"), { status: 429 }), validQuizJson);
    await expectError(generateGame(quizRequest, model, opts), "upstream");
    expect(model.generateJson).toHaveBeenCalledTimes(1);
  });

  it("reports an upstream failure on the retry as upstream", async () => {
    const model = fakeModel("not json", new Error("network down"));
    await expectError(generateGame(quizRequest, model, opts), "upstream");
  });

  it("passes the abort signal to the model", async () => {
    const model = fakeModel(validQuizJson);
    const controller = new AbortController();
    await generateGame(quizRequest, model, { ...opts, signal: controller.signal });
    expect(model.generateJson.mock.calls[0][2]).toBe(controller.signal);
  });
});
