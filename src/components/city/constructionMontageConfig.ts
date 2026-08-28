/**
 * Shared timing for the "under construction" montage — used by both the real
 * kiosk (Kiosk.tsx, on a genuine fresh placement) and the dev-only preview
 * page (DevPreview.tsx, to simulate the exact same effect on demand). Keeping
 * these in one place means the preview's "Simulate placement" button reflects
 * the real timing exactly, not an approximation.
 */

// Purely visual — replays the reveal of recent blocks with a stagger so the
// moment feels more dynamic. Doesn't affect completedBlocks or placed_at.
export const MONTAGE_BLOCK_COUNT = 100;
export const MONTAGE_STAGGER_MS = 20;
// Pause after the montage finishes and before the genuinely new block drops
// in — a deliberate beat so it reads as the finale, not just another step.
export const MONTAGE_FINAL_BLOCK_DELAY_MS = 400;
