import { useCallback, useState } from "react";

// Sound-effect files aren't part of the repo — drop the real audio into
// public/sounds/ using the filenames below (any format <audio> supports,
// e.g. .mp3). Until a file exists, play() below fails silently, same as if
// muted, so missing assets never surface an error to the user.
const SOUND_URLS = {
  blockLanding: "/sounds/block-landing.mp3",
  cityComplete: "/sounds/city-complete.mp3",
  buttonClick: "/sounds/button-click.mp3",
} as const;

export type SoundName = keyof typeof SOUND_URLS;

const MUTE_KEY = "gradimir_muted";

const templates = new Map<SoundName, HTMLAudioElement>();

function getTemplate(name: SoundName): HTMLAudioElement {
  let audio = templates.get(name);
  if (!audio) {
    audio = new Audio(SOUND_URLS[name]);
    audio.preload = "auto";
    templates.set(name, audio);
  }
  return audio;
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private browsing / storage disabled — mute state just won't persist.
  }
}

// Plays a short one-shot effect. No-ops if muted; swallows playback failures
// (missing file, browser autoplay restrictions) since sound is a bonus layer
// on top of the existing visual feedback, never a required signal.
export function playSound(name: SoundName): void {
  if (isMuted()) return;
  // Clone rather than play the cached template directly so rapid repeated
  // triggers (e.g. quick button taps) overlap instead of cutting each other off.
  const instance = getTemplate(name).cloneNode(true) as HTMLAudioElement;
  instance.play().catch(() => {});
}

// Reactive mute state for UI (e.g. a mute toggle button) — sound.ts's own
// module state above is the source of truth; this just re-renders on toggle.
export function useMuted(): [boolean, () => void] {
  const [muted, setMutedState] = useState(isMuted);
  const toggle = useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      setMuted(next);
      return next;
    });
  }, []);
  return [muted, toggle];
}
