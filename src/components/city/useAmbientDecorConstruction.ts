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
// User-specified (2026-08-26, raised from the original 5/7): 5 concurrent
// sites were too hard to spot in a city of ~300 buildings. Checked against
// the real STATIC_DECOR_BUILDINGS data (305 buildings as of this change,
// up from the 138 at 2026-08-19 — the city's grown since) before picking
// these: at MIN_SEPARATION=60, a random ordering achieves a spread-out pool
// of 60-68 citywide in every trial tested, comfortably above POOL_SIZE=65
// with real margin for CONCURRENT_SITES=50 + a reserve for rotation. This
// isn't CPU/GPU-bound at these numbers — each site only touches its own
// building's instance buffer once a second, and mesh count doesn't change
// with pool size (every building already has a pre-allocated mesh pair
// regardless of ambient state) — the real ceiling is geometric: how many of
// the city's decoration buildings can be spread MIN_SEPARATION apart.
const CONCURRENT_SITES = 50
const POOL_SIZE = 65

// User request (2026-08-26): scattered across the whole city, not
// clustered near one point (see ANCHOR's removal below) — the pool no
// longer needs each pick to be "a few city blocks" from a shared center,
// just spread from EACH OTHER. Checked empirically against the real
// STATIC_DECOR_BUILDINGS data (median nearest-neighbor distance ~22 units)
// — 60 is comfortably above that, so it actually spreads picks out instead
// of clustering, while still being loose enough to reach POOL_SIZE=65 (see
// above). Lower than the original 120, which was tuned for a single
// point-anchored pool of 7 and was already the reason a citywide pool of
// 50 wasn't reachable before this change.
const MIN_SEPARATION = 60

// One block per second (user request). REVEAL_COUNT controls DURATION (how
// many staggerMs ticks the visible activity lasts), not how many blocks get
// truncated — cityScene.ts's playAmbientCycle sizes the actual truncated
// span as a percentage of each building's own block count (so it reads as a
// real gap on an 8,000-block hospital and not just a 1,080-block house),
// batching multiple blocks into a tick when that span is bigger than
// REVEAL_COUNT, so duration stays consistent across building sizes
// regardless of how big the span ends up being. The truncation always
// reaches the true top of the blueprint (never an isolated mid-building
// window — see cityScene.ts's playAmbientCycle for why that doesn't render
// visibly from the kiosk's normal camera angle), with the truncation point
// randomized so the amount "already built" below the activity varies cycle
// to cycle instead of always starting from 0.
const STAGGER_MS = 1000
const REVEAL_COUNT_MIN = 20
const REVEAL_COUNT_MAX = 45

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
