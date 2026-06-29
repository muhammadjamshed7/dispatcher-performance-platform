"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

const MUTE_STORAGE_KEY = "dpp:notifications:muted";

const muteListeners = new Set<() => void>();

function emitMuteChange() {
  for (const listener of muteListeners) {
    listener();
  }
}

function subscribeMuted(callback: () => void) {
  muteListeners.add(callback);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === MUTE_STORAGE_KEY) {
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    muteListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

function readStoredMuted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredMuted(next: boolean) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage failures (e.g. private mode); listeners still update.
    }
  }

  emitMuteChange();
}

/**
 * Plays a short beep when a notification arrives and persists a per-browser
 * mute preference. The beep is synthesized with the Web Audio API so no audio
 * asset is required.
 */
export function useNotificationSound() {
  // Read the mute preference from localStorage via an external store so the
  // value stays in sync across tabs without calling setState inside an effect.
  const muted = useSyncExternalStore(
    subscribeMuted,
    readStoredMuted,
    () => false,
  );
  const audioContextRef = useRef<AudioContext | null>(null);

  const toggleMuted = useCallback(() => {
    writeStoredMuted(!readStoredMuted());
  }, []);

  const playBeep = useCallback(() => {
    if (typeof window === "undefined" || readStoredMuted()) {
      return;
    }

    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    try {
      let context = audioContextRef.current;
      if (!context) {
        context = new AudioContextClass();
        audioContextRef.current = context;
      }

      // Browsers may suspend the context until a user gesture occurs.
      if (context.state === "suspended") {
        void context.resume();
      }

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, now);

      // Quick fade in/out to avoid an audible click.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + 0.32);
    } catch {
      // Audio playback is best-effort.
    }
  }, []);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  return { muted, toggleMuted, playBeep };
}
