import { z } from "zod";
import { contentSchemaByType, type GameType } from "@/lib/schemas";

/**
 * JSON Schema for Gemini's structured output, generated from the same Zod
 * content schema we validate with, so the two can never drift apart.
 * Refinements (correct option exists, no duplicates) can't be expressed in
 * JSON Schema, which is why Zod still validates every response afterwards.
 */
export function contentJsonSchema(type: GameType): Record<string, unknown> {
  const schema = z.toJSONSchema(contentSchemaByType[type]) as Record<string, unknown>;
  // "$schema" only names the JSON Schema draft; Gemini doesn't need it.
  delete schema.$schema;
  return schema;
}
