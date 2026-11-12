import type { Language } from "@/lib/schemas";

/**
 * The classroom UI speaks the game's language, so a German game shows German
 * buttons. About 30 strings don't justify an i18n library: a typed dictionary
 * makes a missing German string a compile error.
 */
const en = {
  "team.class": "Class",
  "team.fox": "Foxes",
  "team.whale": "Whales",
  "team.frog": "Frogs",
  "team.chick": "Chicks",
  "setup.title": "How do you want to play?",
  "setup.solo": "Whole class",
  "setup.teams": "{n} teams",
  "turn": "{team}, your turn!",
  "progress.question": "Question {n} of {total}",
  "progress.pairs": "{n} of {total} pairs found",
  "correct": "Correct!",
  "wrong": "Not quite.",
  "answerIs": "The answer is: {answer}",
  "pointFor": "+1 for {team}",
  "true": "True",
  "false": "False",
  "next": "Next",
  "results": "See results",
  "match.instructions": "Tap a card on the left, then its partner on the right.",
  "match.correct": "Great match!",
  "match.wrong": "Not a pair. Next team!",
  "match.wrongSolo": "Not a pair. Try again!",
  "end.solo": "Well done!",
  "end.soloScore": "You got {score} of {total} points.",
  "end.winner": "{team} win!",
  "end.tie": "It's a tie!",
  "end.point": "1 point",
  "end.points": "{score} points",
  "playAgain": "Play again",
  "exit": "Exit",
  "fullscreen.enter": "Full screen",
  "fullscreen.exit": "Exit full screen",
  "scoreboard": "Scoreboard",
  "readAloud": "Read aloud",
  "readAloud.loading": "Loading…",
  "readAloud.stop": "Stop",
  "shape.0": "Triangle",
  "shape.1": "Diamond",
  "shape.2": "Circle",
  "shape.3": "Square",
  "speech.times": "times",
  "speech.minus": "minus",
} as const;

export type MessageKey = keyof typeof en;

const de: Record<MessageKey, string> = {
  "team.class": "Klasse",
  "team.fox": "Füchse",
  "team.whale": "Wale",
  "team.frog": "Frösche",
  "team.chick": "Küken",
  "setup.title": "Wie wollt ihr spielen?",
  "setup.solo": "Ganze Klasse",
  "setup.teams": "{n} Teams",
  "turn": "{team}, ihr seid dran!",
  "progress.question": "Frage {n} von {total}",
  "progress.pairs": "{n} von {total} Paaren gefunden",
  "correct": "Richtig!",
  "wrong": "Leider falsch.",
  "answerIs": "Die Antwort ist: {answer}",
  "pointFor": "+1 für {team}",
  "true": "Wahr",
  "false": "Falsch",
  "next": "Weiter",
  "results": "Ergebnis zeigen",
  "match.instructions": "Tippe links auf eine Karte, dann rechts auf ihren Partner.",
  "match.correct": "Super, ein Paar!",
  "match.wrong": "Kein Paar. Das nächste Team!",
  "match.wrongSolo": "Kein Paar. Versucht es nochmal!",
  "end.solo": "Super gemacht!",
  "end.soloScore": "Ihr habt {score} von {total} Punkten.",
  "end.winner": "{team} gewinnen!",
  "end.tie": "Unentschieden!",
  "end.point": "1 Punkt",
  "end.points": "{score} Punkte",
  "playAgain": "Nochmal spielen",
  "exit": "Beenden",
  "fullscreen.enter": "Vollbild",
  "fullscreen.exit": "Vollbild beenden",
  "scoreboard": "Punktestand",
  "readAloud": "Vorlesen",
  "readAloud.loading": "Lädt…",
  "readAloud.stop": "Stopp",
  "shape.0": "Dreieck",
  "shape.1": "Raute",
  "shape.2": "Kreis",
  "shape.3": "Quadrat",
  "speech.times": "mal",
  "speech.minus": "minus",
};

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, de };

export function t(language: Language, key: MessageKey, vars: Record<string, string | number> = {}): string {
  return dictionaries[language][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in vars ? String(vars[name]) : placeholder,
  );
}

/** Convenience: bind a language once, e.g. `const tr = translator("de")`. */
export function translator(language: Language) {
  return (key: MessageKey, vars?: Record<string, string | number>) => t(language, key, vars);
}
