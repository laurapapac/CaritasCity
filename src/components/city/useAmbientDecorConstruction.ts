/**
 * useAmbientDecorConstruction — purely cosmetic "the city feels alive"
 * effect (2026-08-25, user request; scattered citywide + highlighted +
 * top-anchored reveals added 2026-08-26/27 after several earlier designs
 * proved impossible to spot — see cityScene.ts's playAmbientCycle for the
 * 2026-08-27 root-cause writeup on why the reveal has to reach the true top
 * of the blueprint, not an isolated window). Picks a pool of decoration
 * buildings (never backend-linked, deco_-prefixed ids — see
 * staticCityData.ts's own doc comment on why that's always safe to animate)
 * spread across the whole city and cycles them through construction forever:
 * truncate each building down to a random point partway up, then rebuild it
 * the rest of the way to the roof one block a second with the same highlight
 * flash a real placement gets, hold briefly once finished, then hand the
 * site off to a different building far enough from it. Never touches the
 * database or the 160 real QR-linked buildings' progress — this is
 * client-side-only, ephemeral state that resets every time the page reloads.
 *
 * Deliberately NOT synced across browser sessions/kiosks — there is no
 * shared store or channel for it, so two simultaneous /kiosk tabs will each
 * run their own independent rotation and will generally show different
 * buildings under construction (any overlap is coincidence, not design).
 * Real building progress, by contrast, IS synced for everyone via the
 * backend — this effect is only ever the unsynced cosmetic layer on top.
 */

import { useEffect, type RefObject } from "react"
import type { CityHandle } from "./City"
import type { CityBuilding } from "./types"

// How many decoration buildings are actively mid-cycle at once, and the
// size of the candidate pool they're drawn from/rotated back into.
// Raised a third time (2026-08-27, same-day follow-up, user request: 90
// concurrent still wasn't noticeable enough) — checked first whether this
// was even geometrically possible: only 305 decoration buildings exist in
// the whole city (see the "how many deco buildings" answer earlier this
// session), and a standalone script running pickPool's exact greedy
// algorithm found a sharp cliff in the real STATIC_DECOR_BUILDINGS position
// data right around the buildings' own median nearest-neighbor spacing
// (~22 units, previously only estimated, now confirmed by the cliff itself):
// MIN_SEPARATION 23 reliably reached 209-219 over 200 trials, but 22 jumped
// straight to 286-287 — meaning 22 and below barely enforces separation at
// all (most of the city's buildings already qualify), so 200+ concurrent
// sites was reachable but would mean most active/nearby sites sitting right
// next to each other, defeating the point of a spread-out pool. 180
// concurrent (this value) fits well inside the real 23-separation ceiling
// with genuine reserve to spare. Still isn't CPU/GPU-bound at these
// numbers — each site only touches its own building's instance buffer once
// a second, and mesh count doesn't change with pool size (every building
// already has a pre-allocated mesh pair regardless of ambient state) — the
// real ceiling is geometric: how many of the city's decoration buildings
// can be spread MIN_SEPARATION apart without exhausting the real 305.
const CONCURRENT_SITES = 180
const POOL_SIZE = 200

// User request (2026-08-26): scattered across the whole city, not
// clustered near one point (see ANCHOR's removal below) — the pool no
// longer needs each pick to be "a few city blocks" from a shared center,
// just spread from EACH OTHER. Dropped 35->23 (2026-08-27, alongside
// CONCURRENT_SITES/POOL_SIZE both rising above — see their own comment for
// the actual measured trial numbers, including the real cliff found right
// below this value) to fit the bigger pool: 35 only supports ~110-125
// total, nowhere near the 200 now needed. This is close to the buildings'
// own real median nearest-neighbor distance, so it's near the practical
// floor for "still a real separation, not just every building qualifying."
const MIN_SEPARATION = 23

// One block per second, literally (user request, 2026-08-27 — an earlier
// version took a caller-supplied duration and had cityScene.ts batch
// multiple blocks into a tick to hit it, which read as "a handful of blocks
// per second" once the truncated span grew large enough to be visible; see
// cityScene.ts's playAmbientCycle doc comment). cityScene.ts sizes the
// truncated span as a percentage of each building's own block count (so it
// reads as a real gap on an 8,000-block hospital and not just a 1,080-block
// house) and reveals it strictly one block per STAGGER_MS, so duration is
// simply span seconds — bigger buildings now take proportionally longer to
// "finish," rather than being sped up to fit a fixed window. The truncation
// always reaches the true top of the blueprint (never an isolated
// mid-building window — see cityScene.ts's playAmbientCycle for why that
// doesn't render visibly from the kiosk's normal camera angle), with the
// truncation point randomized so the amount "already built" below the
// activity varies cycle to cycle instead of always starting from 0.
const STAGGER_MS = 1000

// Pause after a cycle completes, before that site hands off to the next
// building — long enough to read as "finished," not so long the rotation
// feels sluggish.
const HOLD_MS_MIN = 5000
const HOLD_MS_MAX = 12000

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

// Fisher-Yates — used to randomize candidate order before pickPool's greedy
// separation pass, so which buildings end up picked (and therefore where
// they sit) varies run to run instead of always favoring the same corner of
// decorBuildings' declaration order.
function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * @param decorBuildings Expected to be a referentially-stable array (e.g.
 *   STATIC_DECOR_BUILDINGS) — a fresh array literal every render would
 *   restart the whole rotation.
 * @param enabled Gate on the city scene actually being mounted (e.g. once
 *   the buildings list has loaded and <City> is rendering).
 */
export function useAmbientDecorConstruction(
  cityRef: RefObject<CityHandle>,
  decorBuildings: CityBuilding[],
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    const holdTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
    let reserve: CityBuilding[] = []
    let active: CityBuilding[] = []

    // Greedily picks up to POOL_SIZE buildings from a randomized candidate
    // order, skipping any candidate closer than MIN_SEPARATION to one
    // already picked — keeps the whole pool spread out across the whole
    // city (user request, 2026-08-26: scattered, not anchored to one point)
    // from the start, instead of only enforcing separation later when
    // swapping in replacements. Random order (rather than sorting by
    // distance from a point) is what actually produces citywide scatter —
    // a distance-sort just reproduces a point anchor.
    function pickPool(): CityBuilding[] {
      const candidates = shuffled(decorBuildings)
      const picked: CityBuilding[] = []
      for (const c of candidates) {
        if (picked.every((p) => dist(p.position, c.position) >= MIN_SEPARATION)) {
          picked.push(c)
          if (picked.length >= POOL_SIZE) break
        }
      }
      return picked
    }

    function startCycle(building: CityBuilding) {
      if (cancelled) return
      cityRef.current?.playAmbientCycle(building.id, STAGGER_MS, () => {
        if (cancelled) return
        const t = setTimeout(() => {
          if (cancelled) return
          holdTimeouts.delete(building.id)
          advance(building)
        }, randBetween(HOLD_MS_MIN, HOLD_MS_MAX))
        holdTimeouts.set(building.id, t)
      })
    }

    // Swaps `finished` out for whichever reserve member sits farthest from
    // it — avoids a just-completed building sitting right next to a
    // half-built one (user request: no jarring adjacent finished/unfinished
    // jump). `finished` goes back into reserve, waiting its own next turn.
    function advance(finished: CityBuilding) {
      if (reserve.length === 0) { startCycle(finished); return }
      let bestIdx = 0
      let bestDist = -Infinity
      reserve.forEach((r, i) => {
        const d = dist(r.position, finished.position)
        if (d > bestDist) { bestDist = d; bestIdx = i }
      })
      const next = reserve[bestIdx]
      reserve[bestIdx] = finished
      active = active.map((b) => (b.id === finished.id ? next : b))
      startCycle(next)
    }

    // Small delay before the first cycle starts — gives CityRenderer's scene
    // and every decoration Building's own mount effect (which registers it
    // with the scene via syncBuilding) time to settle. playAmbientCycle
    // no-ops harmlessly on a not-yet-registered building, but starting this
    // immediately could cascade through the whole pool instantly instead of
    // settling into a real rotation.
    const startTimer = setTimeout(() => {
      if (cancelled) return
      const pool = pickPool()
      active = pool.slice(0, CONCURRENT_SITES)
      reserve = pool.slice(CONCURRENT_SITES)
      for (const b of active) startCycle(b)
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      for (const t of holdTimeouts.values()) clearTimeout(t)
      for (const b of active) cityRef.current?.stopAmbientCycle(b.id)
    }
  }, [enabled, cityRef, decorBuildings])
}
