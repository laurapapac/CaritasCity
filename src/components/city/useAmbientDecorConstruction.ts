/**
 * useAmbientDecorConstruction — purely cosmetic "the city feels alive"
 * effect (2026-08-25, user request). Picks a small local cluster of
 * decoration buildings (never backend-linked, deco_-prefixed ids — see
 * staticCityData.ts's own doc comment on why that's always safe to animate)
 * and cycles them through construction forever: rewind each building's last
 * few dozen blocks, replay them one a second, hold briefly once finished,
 * then hand the site off to a different nearby building. Never touches the
 * database or the 160 real QR-linked buildings' progress — this is client-
 * side-only, ephemeral state that resets every time the page reloads.
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
// size of the local candidate pool they're drawn from/rotated back into —
// user-specified starting values (2026-08-25), tune by feel like most of
// this project's other constants.
const CONCURRENT_SITES = 5
const POOL_SIZE = 7

// "A few city blocks" apart (user request) — generateCityLayout.ts's BSP
// leaves (ABSOLUTE_MIN_LEAF_AREA=2000, ~45 units/side) put a couple of
// leaf-widths in this range. Starting point, not derived.
const MIN_SEPARATION = 120

// One block per second (user request), skipping straight to a random point
// near the END of the blueprint rather than starting from the ground up —
// nobody's guaranteed to watch a full cycle, so there's no reason to ever
// render the boring early phase. REVEAL_COUNT is how many of the building's
// own last blocks get rewound-then-replayed each cycle, which (at 1/sec) is
// also how long the visible activity lasts — independent of the building's
// real size, so a 1,080-block house and an 8,000-block hospital both look
// like a similar-length "finishing touches" cycle.
const STAGGER_MS = 1000
const REVEAL_COUNT_MIN = 20
const REVEAL_COUNT_MAX = 45

// Pause after a cycle completes, before that site hands off to the next
// building — long enough to read as "finished," not so long the rotation
// feels sluggish.
const HOLD_MS_MIN = 5000
const HOLD_MS_MAX = 12000

// City-center-ish anchor, matching cityScene.ts's own DEFAULT_CAMERA_TARGET
// — picks the pool from buildings near the default establishing view rather
// than scattering it randomly across the whole city. Simple starting point;
// making this track the camera or the user's own active building is a
// natural follow-up, not done here.
const ANCHOR = { x: 0, z: 0 }

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
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

    // Greedily picks POOL_SIZE buildings nearest ANCHOR, skipping any
    // candidate closer than MIN_SEPARATION to one already picked — keeps
    // the whole pool spread out from the start instead of only enforcing
    // separation later when swapping in replacements.
    function pickPool(): CityBuilding[] {
      const candidates = [...decorBuildings].sort(
        (a, b) => dist(a.position, ANCHOR) - dist(b.position, ANCHOR)
      )
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
      const count = Math.round(randBetween(REVEAL_COUNT_MIN, REVEAL_COUNT_MAX))
      cityRef.current?.playAmbientCycle(building.id, count, STAGGER_MS, () => {
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
