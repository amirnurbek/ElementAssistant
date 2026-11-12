"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/schemas";

/**
 * Whether read-aloud is available is checked once per page load and shared
 * by every player on the page. Until the answer is "enabled", the button
 * stays hidden, so a missing key never shows an error to the class.
 */
let availability: Promise<boolean> | null = null;

function checkAvailability(): Promise<boolean> {
  availability ??= fetch("/api/tts")
    .then((response) => (response.ok ? response.json() : null))
    .then((body: { enabled?: unknown } | null) => body?.enabled === true)
    .catch(() => false);
  return availability;
}

/**
 * Browser-side cache: language|text -> object URL of the MP3. Replaying a
 * question doesn't even send a request. The server caches across sessions;
 * this one only saves the round trip. Capped so a long lesson can't grow it forever.
 */
const clips = new Map<string, string>();
const MAX_CLIPS = 100;

function rememberClip(id: string, url: string) {
  clips.set(id, url);
  if (clips.size > MAX_CLIPS) {
    const [oldestId, oldestUrl] = clips.entries().next().value as [string, string];
    URL.revokeObjectURL(oldestUrl);
    clips.delete(oldestId);
  }
}

/** Test helper: forget availability and cached clips between tests. */
export function resetReadAloudForTests() {
  availability = null;
  clips.clear();
}

export type ReadAloudState = "idle" | "loading" | "playing";

export function useReadAloud(language: Language) {
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<ReadAloudState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void checkAvailability().then((enabled) => {
      if (alive) setAvailable(enabled);
    });
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }, []);

  // Stop talking when the button goes away (next question, end screen, exit).
  useEffect(
    () => () => {
      requestRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  const speak = useCallback(
    async (text: string) => {
      const id = `${language}|${text}`;
      let url = clips.get(id);

      if (!url) {
        const controller = new AbortController();
        requestRef.current = controller;
        setState("loading");
        try {
          const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text, language }),
            signal: controller.signal,
          });
          if (response.status === 503) {
            // The key was removed since the page loaded: hide the button quietly.
            availability = Promise.resolve(false);
            setAvailable(false);
            setState("idle");
            return;
          }
          if (!response.ok) throw new Error(`TTS failed with ${response.status}`);
          url = URL.createObjectURL(await response.blob());
          rememberClip(id, url);
        } catch (error) {
          if (!controller.signal.aborted) {
            console.warn("[read aloud]", error);
            setState("idle");
          }
          return;
        } finally {
          if (requestRef.current === controller) requestRef.current = null;
        }
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      const done = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setState("idle");
        }
      };
      audio.onended = done;
      audio.onerror = done;
      setState("playing");
      // play() can be refused (autoplay rules, no audio device). The button simply resets.
      await audio.play().catch(done);
    },
    [language],
  );

  /** One button: idle -> speak, loading/playing -> stop. */
  const toggle = useCallback(
    (text: string) => {
      if (state === "idle") void speak(text);
      else stop();
    },
    [speak, state, stop],
  );

  return { available, state, toggle };
}
