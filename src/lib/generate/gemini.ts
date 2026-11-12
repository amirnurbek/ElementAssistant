import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { Prompt } from "./prompt";

/**
 * The only thing generateGame needs from a model. Tests pass a fake; the app
 * passes the Gemini implementation below. This keeps the SDK (and the API
 * key) out of the game logic and makes the retry logic testable offline.
 */
export interface GameModel {
  generateJson(prompt: Prompt, jsonSchema: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
}

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function createGeminiModel(apiKey: string, model: string = DEFAULT_GEMINI_MODEL): GameModel {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async generateJson(prompt, jsonSchema, signal) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt.user,
        config: {
          systemInstruction: prompt.system,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          // Some variety between "generate again" runs, but stay factual.
          temperature: 0.7,
          abortSignal: signal,
        },
      });
      return response.text ?? "";
    },
  };
}
