// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GAME_TYPES } from "@/lib/schemas";
import { contentJsonSchema } from "./jsonSchema";

const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function (this: unknown) {
    return { models: { generateContent } };
  }),
}));

const { createGeminiModel, DEFAULT_GEMINI_MODEL } = await import("./gemini");
const { GoogleGenAI } = await import("@google/genai");

beforeEach(() => generateContent.mockReset());

describe("createGeminiModel", () => {
  it("asks for JSON matching the schema, with the rules as system instruction", async () => {
    generateContent.mockResolvedValue({ text: '{"items":[]}' });
    const signal = new AbortController().signal;
    const model = createGeminiModel("test-key");
    const schema = contentJsonSchema("quiz");

    const text = await model.generateJson({ system: "RULES", user: "REQUEST" }, schema, signal);

    expect(text).toBe('{"items":[]}');
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(generateContent).toHaveBeenCalledWith({
      model: DEFAULT_GEMINI_MODEL,
      contents: "REQUEST",
      config: expect.objectContaining({
        systemInstruction: "RULES",
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        abortSignal: signal,
      }),
    });
  });

  it("uses a custom model id and returns '' when there is no text", async () => {
    generateContent.mockResolvedValue({ text: undefined });
    const text = await createGeminiModel("k", "other-model").generateJson({ system: "", user: "" }, {});
    expect(text).toBe("");
    expect(generateContent.mock.calls[0][0].model).toBe("other-model");
  });
});

describe("contentJsonSchema", () => {
  it.each(GAME_TYPES)("builds a JSON schema for %s without $schema", (type) => {
    const schema = contentJsonSchema(type);
    expect(schema.type).toBe("object");
    expect(schema).not.toHaveProperty("$schema");
  });

  it("carries the limits Gemini can enforce", () => {
    expect(contentJsonSchema("quiz")).toMatchObject({
      properties: {
        items: {
          maxItems: 15,
          items: { properties: { options: { minItems: 2, maxItems: 4 }, correctIndex: { minimum: 0, maximum: 3 } } },
        },
      },
    });
    expect(contentJsonSchema("matching")).toMatchObject({ properties: { pairs: { minItems: 3, maxItems: 8 } } });
    expect(contentJsonSchema("true-false")).toMatchObject({
      properties: { items: { items: { required: ["statement", "answer"] } } },
    });
  });
});
