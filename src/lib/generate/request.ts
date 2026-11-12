import { z } from "zod";
import { gameTypeSchema, gradeSchema, languageSchema, subjectSchema, type GameType } from "@/lib/schemas";

/**
 * What the teacher asks for. Shared by the form (client-side checks) and the
 * route (the server never trusts the client), so both apply the same rules.
 */
export const generateRequestSchema = z.object({
  subject: subjectSchema,
  topic: z
    .string()
    .trim()
    .min(2, "Please enter a topic")
    .max(80, "Keep the topic under 80 characters"),
  grade: gradeSchema,
  gameType: gameTypeSchema,
  language: languageSchema,
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * Items per game. These fit the 720p projector layout and a ~10 minute
 * class activity. Not a teacher setting yet, to keep the form short.
 */
export const DEFAULT_ITEM_COUNT: Record<GameType, number> = {
  quiz: 8,
  "true-false": 8,
  matching: 6,
};

/** Error codes the route returns. The client maps them to friendly messages. */
export type GenerateErrorCode = "bad_request" | "not_configured" | "invalid_output" | "upstream";

export interface GenerateErrorBody {
  error: GenerateErrorCode;
  message: string;
  /** Field problems, only for bad_request. */
  issues?: string[];
}
