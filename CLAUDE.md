# PlayLesson

Web app for elementary school teachers (grades 1–4). The teacher picks subject
(math, English, science), topic, grade, game type and language (English or German).
Gemini generates game content as JSON; the app renders it with fixed game templates
for the class to play on a projector. Built after the Major Hacking League Linz hackathon.

## Stack
Next.js (App Router), TypeScript, Tailwind CSS, Zod, Vitest + Testing Library.
Gemini API for content, ElevenLabs API for text-to-speech.
API keys only in server-side route handlers, read from env vars (GEMINI_API_KEY,
ELEVENLABS_API_KEY). Provide .env.example, never commit .env.

## Architecture rules
- Gemini never generates code. It returns JSON matching a Zod schema per game type
  (quiz, matching, true-false). Invalid output -> retry once, then show a friendly error.
- Prompts include grade level, language, and rules: age-appropriate, factually correct,
  short sentences, no names of real people.
- The teacher always previews and can edit or delete items before playing.
- Game templates are pure React components that receive validated data.
- Cache TTS audio by text hash so identical text is never generated twice.
- Demo mode: 5 bundled sample games playable without any API keys.
- No student data, accounts or tracking.

## Conventions
- Tests for schemas, game logic (scoring, team turns) and API route error handling,
  with Gemini/ElevenLabs mocked.
- Stop after each phase so I can review and commit.
- Explain non-obvious decisions briefly; I must be able to explain this in an interview.
