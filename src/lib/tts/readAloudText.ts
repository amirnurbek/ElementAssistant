import { translator } from "@/lib/i18n";
import type { Language, QuizItem, TrueFalseItem } from "@/lib/schemas";

/**
 * Symbols that speech engines often skip or misread. "·" is the
 * multiplication sign in Austrian/German schools; "−" is a typographic minus.
 */
function speakable(text: string, language: Language): string {
  const tr = translator(language);
  return text
    .replace(/\s*[·×]\s*/g, ` ${tr("speech.times")} `)
    .replace(/\s*−\s*/g, ` ${tr("speech.minus")} `);
}

const endsSentence = (text: string) => /[.!?:]$/.test(text);
const sentence = (text: string) => (endsSentence(text) ? text : `${text}.`);

/**
 * What the read-aloud button says.
 * Quiz: the question, then each option with the shape on its tile
 * ("Triangle: 4."), so children who can't read yet know which tile to pick.
 * True/false: the statement only.
 */
export function readAloudText(item: QuizItem | TrueFalseItem, language: Language): string {
  const tr = translator(language);
  if ("statement" in item) return speakable(item.statement, language);
  const options = item.options.map((option, i) => `${tr(`shape.${i}` as "shape.0")}: ${sentence(option)}`);
  return speakable([sentence(item.question), ...options].join(" "), language);
}
