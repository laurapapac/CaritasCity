import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Hand, Mouse, Move, Rotate3d, X, ZoomIn } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

// Small "how to move the camera" card for the city view (2026-10-13, user
// request: mostly pictures, very little text). Each row is a picture of the
// physical input with the relevant part highlighted, the action's icon, and
// one word. Mouse devices get mouse rows (OrbitControls' defaults in
// cityScene.ts: left drag = rotate, right drag = pan, wheel = zoom); touch
// devices get the matching gestures (one finger = rotate, two-finger drag =
// pan, pinch = zoom), since most visitors are on phones. Open/closed is one
// shared, per-browser-remembered state (useControlsHintOpen) so the kiosk
// can place the card and its toggle differently on wide and narrow screens.

const HIGHLIGHT = "#dc2626"; // red-600, same as the "Unesi kod" CTA
const COLLAPSED_KEY = "gradimir_controls_hint_collapsed";

function readOpen(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) !== "1";
  } catch {
    return true;
  }
}

export function useControlsHintOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpenState] = useState(readOpen);
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "0" : "1");
    } catch {
      // Private browsing / storage disabled — just won't persist.
    }
  }, []);
  return [open, setOpen];
}

// True on devices whose main pointer is a mouse/trackpad; false on phones
// and tablets. Follows changes (e.g. a tablet docking a mouse).
function useFinePointer(): boolean {
  const query = "(hover: hover) and (pointer: fine)";
  const [fine, setFine] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setFine(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return fine;
}

// ── Pictures ────────────────────────────────────────────────────────────────

function MouseIcon({ part }: { part: "left" | "right" | "wheel" }) {
  return (
    <svg viewBox="0 0 24 34" className="h-9 w-6 text-foreground/70" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      {part === "left" && <path d="M12 1.5A10.5 10.5 0 0 0 1.5 12V14H12Z" fill={HIGHLIGHT} stroke="none" />}
      {part === "right" && <path d="M12 1.5A10.5 10.5 0 0 1 22.5 12V14H12Z" fill={HIGHLIGHT} stroke="none" />}
      <rect x={1.5} y={1.5} width={21} height={31} rx={10.5} />
      <path d="M12 1.5V5M12 11V14M1.5 14H22.5" />
      <rect
        x={10}
        y={5}
        width={4}
        height={6}
        rx={2}
        fill={part === "wheel" ? HIGHLIGHT : "var(--card)"}
        stroke={part === "wheel" ? HIGHLIGHT : "currentColor"}
      />
    </svg>
  );
}

// Hand outlines drawn on lucide's "Pointer" geometry (24×24, index finger up
// with its tip at (8, 2), thumb lobe out to the lower left) so they match the
// rest of the UI's icons. The first version used plain red dots for
// fingertips, which many people didn't read as fingers (user feedback) — a
// real hand makes the gesture obvious; the red arrows show the motion.
const HAND_PALM = "M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15";
const HAND_PATHS_ONE_FINGER = [
  "M22 14a8 8 0 0 1-8 8",
  "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2",
  "M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1", // middle finger, folded
  "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10", // index finger, up
  HAND_PALM,
];
const HAND_PATHS_TWO_FINGERS = [
  "M22 14a8 8 0 0 1-8 8",
  "M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2",
  // middle finger, up and tilted slightly outward so a V gap separates it
  // from the index (straight up beside it, the two read as one wide finger)
  "M14 10L15.2 4.6a2 2 0 0 0-3.9-.9L10 9.5",
  "M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10",
  HAND_PALM,
];

function TouchIcon({ gesture }: { gesture: "rotate" | "pan" | "pinch" }) {
  const hand = gesture === "pan" ? HAND_PATHS_TWO_FINGERS : HAND_PATHS_ONE_FINGER;
  return (
    <svg viewBox="-6 -7 32 31" className="h-9 w-9" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g stroke="currentColor" strokeWidth={1.6} className="text-foreground/70">
        {hand.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g stroke={HIGHLIGHT} strokeWidth={1.8}>
        {gesture === "rotate" && (
          // ← → either side of the fingertip: drag sideways with one finger
          <path d="M3.5 2H-3.5M-3.5 2L-1.3-.2M-3.5 2L-1.3 4.2M12.5 2H19.5M19.5 2L17.3-.2M19.5 2L17.3 4.2" />
        )}
        {gesture === "pan" && (
          // → above both fingertips: drag with two fingers together
          <path d="M3-3.5H18M18-3.5L15.6-5.9M18-3.5L15.6-1.1" />
        )}
        {gesture === "pinch" && (
          // index tip and thumb tip spreading apart
          <path d="M10.5-.5L15.5-5.5M15.5-5.5H12.2M15.5-5.5V-2.2M.5 15.5L-4.5 20.5M-4.5 20.5H-1.2M-4.5 20.5V17.2" />
        )}
      </g>
    </svg>
  );
}

function Row({ device, action, label }: { device: ReactNode; action: ReactNode; label: string }) {
  return (
    <>
      <div className="flex h-9 w-9 items-center justify-center">{device}</div>
      <div className="text-muted-foreground">{action}</div>
      <span className="text-sm font-medium">{label}</span>
    </>
  );
}

// ── Public pieces ───────────────────────────────────────────────────────────

/** The instructions card itself, with a small ✕ that calls onClose. Unpositioned. */
export function ControlsHintCard({ onClose, className }: { onClose: () => void; className?: string }) {
  const finePointer = useFinePointer();
  const iconSize = "h-5 w-5";
  return (
    <div
      className={cn("pointer-events-auto relative rounded-xl border bg-card/90 px-3 py-2.5 shadow-sm backdrop-blur", className)}
      role="note"
      aria-label="Upute za kretanje"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        aria-label="Sakrij upute"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="grid grid-cols-[auto_auto_auto] items-center gap-x-2.5 gap-y-1.5">
        {finePointer ? (
          <>
            <Row device={<MouseIcon part="left" />} action={<Rotate3d className={iconSize} />} label="Okreni" />
            <Row device={<MouseIcon part="right" />} action={<Move className={iconSize} />} label="Pomakni" />
            <Row device={<MouseIcon part="wheel" />} action={<ZoomIn className={iconSize} />} label="Zumiraj" />
          </>
        ) : (
          <>
            <Row device={<TouchIcon gesture="rotate" />} action={<Rotate3d className={iconSize} />} label="Okreni" />
            <Row device={<TouchIcon gesture="pan" />} action={<Move className={iconSize} />} label="Pomakni" />
            <Row device={<TouchIcon gesture="pinch" />} action={<ZoomIn className={iconSize} />} label="Zumiraj" />
          </>
        )}
      </div>
    </div>
  );
}

/** Round icon button (mouse or hand, matching the device) that toggles the card. */
export function ControlsHintToggle({
  open,
  onToggle,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const finePointer = useFinePointer();
  return (
    <Button
      size="icon"
      variant="outline"
      className={cn("pointer-events-auto bg-card/90 backdrop-blur", className)}
      onClick={onToggle}
      aria-label={open ? "Sakrij upute za kretanje" : "Prikaži upute za kretanje"}
      aria-pressed={open}
      title="Upute za kretanje"
    >
      {finePointer ? <Mouse /> : <Hand />}
    </Button>
  );
}
