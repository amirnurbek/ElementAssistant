"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

const noopSubscribe = () => () => {};

/**
 * Fullscreen for one element (only the game, not the whole page).
 * useSyncExternalStore reads browser state without a setState-in-effect, and
 * it also catches the user leaving fullscreen with Esc.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const isSupported = useSyncExternalStore(
    noopSubscribe,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const isFullscreen = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null && document.fullscreenElement === ref.current,
    () => false,
  );

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ref.current?.requestFullscreen();
    } catch {
      // The browser can refuse (e.g. without a user gesture). The game still works without it.
    }
  }, [ref]);

  return { isSupported, isFullscreen, toggle };
}
