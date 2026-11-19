import { useCallback, useState } from "react";

// Sound files live in public/sounds/. Sound starts muted on every load
// (2026-11-17, user request) — nothing plays until the visitor taps the
// sound button, which also starts the background music. Browsers block
// audio before a user gesture anyway, so the tap doubles as the unlock.
// Only the user's own block has effects (falling, then landing);
// city-complete and button-click sounds were dropped (same request).
const SOUND_URLS = {
  blockFalling: "/sounds/block-falling.mp3",
  blockLanding: "/sounds/block-landing.mp3",
} as const;

const MUSIC_URL = "/sounds/background-music.mp3";
const MUSIC_VOLUME = 0.25;

export type SoundName = keyof typeof SOUND_URLS;

let muted = true;

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

// Created on the first unmute, so the file isn't downloaded for visitors
// who never turn sound on.
let music: HTMLAudioElement | null = null;

function getMusic(): HTMLAudioElement {
  if (!music) {
    music = new Audio(MUSIC_URL);
    music.loop = true;
    music.volume = MUSIC_VOLUME;
  }
  return music;
}

function syncMusic(): void {
  if (muted || document.hidden) {
    music?.pause();
  } else {
    getMusic().play().catch(() => {});
  }
}

// Pause while the tab is in the background, resume on return (if unmuted).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", syncMusic);
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  syncMusic();
}

// Plays a short one-shot effect and returns it (so the caller can stop it
// early), or null if muted. Swallows playback failures
// (missing file, browser autoplay restrictions) since sound is a bonus layer
// on top of the existing visual feedback, never a required signal.
export function playSound(name: SoundName): HTMLAudioElement | null {
  if (muted) return null;
  // Clone rather than play the cached template directly so rapid repeated
  // triggers overlap instead of cutting each other off.
  const instance = getTemplate(name).cloneNode(true) as HTMLAudioElement;
  instance.play().catch(() => {});
  return instance;
}

// Reactive mute state for the sound button — the module state above is the
// source of truth; this just re-renders on toggle.
export function useMuted(): [boolean, () => void] {
  const [mutedState, setMutedState] = useState(isMuted);
  const toggle = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
  }, []);
  return [mutedState, toggle];
}
