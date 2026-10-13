import { useEffect, useState, type ReactNode } from "react";
import { Hand, Mouse, Move, Rotate3d, X, ZoomIn } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

// Small "how to move the camera" card for the city view (2026-10-13, user
// request: mostly pictures, very little text). Each row is a picture of the
// physical input with the relevant part highlighted, the action's icon, and
// one word. Mouse devices get mouse rows (OrbitControls' defaults in
// cityScene.ts: left drag = rotate, right drag = pan, wheel = zoom); touch
// devices get the matching gestures (one finger = rotate, two-finger drag =
// pan, pinch = zoom), since most visitors are on phones. Collapses to a
// small round button; that choice is remembered per browser.

const HIGHLIGHT = "#dc2626"; // red-600, same as the "Unesi kod" CTA
const COLLAPSED_KEY = "gradimir_controls_hint_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // Private browsing / storage disabled — just won't persist.
  }
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

function FingerDot({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={3.2} fill={HIGHLIGHT} stroke="none" />;
}

function TouchIcon({ gesture }: { gesture: "rotate" | "pan" | "pinch" }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className="h-8 w-8 text-foreground/70"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {gesture === "rotate" && (
        <>
          <FingerDot cx={14} cy={14} />
          <path d="M3 14H9M3 14L5.5 11.5M3 14L5.5 16.5" />
          <path d="M25 14H19M25 14L22.5 11.5M25 14L22.5 16.5" />
        </>
      )}
      {gesture === "pan" && (
        <>
          <FingerDot cx={9.5} cy={11} />
          <FingerDot cx={18.5} cy={11} />
          <path d="M5 21H23M23 21L20.5 18.5M23 21L20.5 23.5" />
        </>
      )}
      {gesture === "pinch" && (
        <>
          <FingerDot cx={11} cy={17} />
          <FingerDot cx={17} cy={11} />
          <path d="M7.5 20.5L3 25M3 25H6.5M3 25V21.5" />
          <path d="M20.5 7.5L25 3M25 3H21.5M25 3V6.5" />
        </>
      )}
    </svg>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function Row({ device, action, label }: { device: ReactNode; action: ReactNode; label: string }) {
  return (
    <>
      <div className="flex h-9 w-8 items-center justify-center">{device}</div>
      <div className="text-muted-foreground">{action}</div>
      <span className="text-sm font-medium">{label}</span>
    </>
  );
}

export function ControlsHint({ className }: { className?: string }) {
  const finePointer = useFinePointer();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggle(next: boolean) {
    setCollapsed(next);
    writeCollapsed(next);
  }

  if (collapsed) {
    return (
      <div className={cn("pointer-events-none", className)}>
        <Button
          size="icon"
          variant="outline"
          className="pointer-events-auto rounded-full bg-card/90 backdrop-blur"
          onClick={() => toggle(false)}
          aria-label="Prikaži upute za kretanje"
          title="Upute za kretanje"
        >
          {finePointer ? <Mouse /> : <Hand />}
        </Button>
      </div>
    );
  }

  const iconSize = "h-5 w-5";
  return (
    <div className={cn("pointer-events-none", className)}>
      <div
        className="pointer-events-auto relative rounded-xl border bg-card/90 px-3 py-2.5 shadow-sm backdrop-blur"
        role="note"
        aria-label="Upute za kretanje"
      >
        <button
          type="button"
          onClick={() => toggle(true)}
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
    </div>
  );
}
