/**
 * City — top-level component responsible for managing all buildings.
 *
 * Owns:
 *   - buildings[] state (completedBlocks per building)
 *   - construction queue (which building is currently active per category)
 *   - addBlock(category) — finds the active building, increments it by 1,
 *     animates the newly placed block, and auto-advances the queue when a
 *     building reaches totalBlocks.
 *
 * Renders:
 *   <CityRenderer>          ← shared Three.js scene
 *     <Building key="…" />  ← one per building (registers with scene via context)
 *     …
 *   </CityRenderer>
 *
 * Usage:
 *   const ref = useRef<CityHandle>(null)
 *
 *   <City
 *     ref={ref}
 *     initialBuildings={[...]}
 *     initialQueue={{ residential: "house-1" }}
 *     onStateChange={(buildings, queue) => { ... }}
 *   />
 *
 *   ref.current?.addBlock("residential")
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
} from "react"
import type { BuildingCategory, CityBuilding, CityDecor, ConstructionQueue } from "./types"
import { CityRenderer, type CityRendererHandle } from "./CityRenderer"
import { Building } from "./Building"

// ─────────────────────────────────────────────────────────────────────────────
// State management
// ─────────────────────────────────────────────────────────────────────────────

interface CityState {
  buildings: CityBuilding[]
  queue: ConstructionQueue
}

type CityAction =
  | { type: "BLOCK_ADDED"; buildingId: string; completedBlocks: number }
  | { type: "RESET";        buildings: CityBuilding[]; queue: ConstructionQueue }

function cityReducer(state: CityState, action: CityAction): CityState {
  if (action.type === "RESET") {
    return { buildings: action.buildings, queue: action.queue }
  }

  if (action.type === "BLOCK_ADDED") {
    const buildings = state.buildings.map((b) =>
      b.id === action.buildingId ? { ...b, completedBlocks: action.completedBlocks } : b
    )

    const updated = buildings.find((b) => b.id === action.buildingId)!

    // Building not yet complete — just update count
    if (action.completedBlocks < updated.totalBlocks) {
      return { ...state, buildings }
    }

    // Building complete → advance queue to next incomplete building in category
    const { category } = updated
    const next = buildings.find(
      (b) => b.category === category && b.id !== action.buildingId && b.completedBlocks < b.totalBlocks
    )
    return {
      buildings,
      queue: { ...state.queue, [category]: next?.id }, // undefined = no more pending
    }
  }

  return state
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CityHandle {
  /**
   * Find the active building for `category`, reveal its next block with a
   * yellow highlight, and fire onStateChange.
   * If the building just completed, the queue advances automatically.
   */
  addBlock(category: BuildingCategory): void
  /**
   * Reveal one more block directly on a specific building, bypassing the
   * category/queue lookup and its completedBlocks-vs-totalBlocks gate —
   * for dev/preview tooling managing a single synthetic building outside
   * the normal queue model. Real placement flow should use addBlock(category).
   */
  addBlockToBuilding(buildingId: string): void
  /** Purely visual "under construction" replay. See CitySceneHandle. */
  playConstructionMontage(
    buildingId: string,
    count: number,
    staggerMs: number,
    onComplete?: () => void
  ): void
  /** Ambient decoration-building construction loop. See CitySceneHandle. */
  playAmbientCycle(
    buildingId: string,
    staggerMs: number,
    onComplete?: () => void
  ): void
  /** Cancels a building's pending ambient cycle, if any. */
  stopAmbientCycle(buildingId: string): void
  /** Snap the camera close to a specific already-placed block. See CitySceneHandle. */
  focusOnBlock(buildingId: string, blockIndex: number, opts?: { highlight?: boolean }): void
  /** Snap the camera back to the wide establishing shot. */
  resetCamera(): void
  /** Instantly set a building's visible block count. See CitySceneHandle. */
  setVisibleCount(buildingId: string, count: number): void
  /** Reset all buildings to completedBlocks = 0 and restore the initial queue. */
  reset(): void
  /** Read current buildings (for HUD rendering outside the component). */
  getBuildings(): CityBuilding[]
  /** Read current queue. */
  getQueue(): ConstructionQueue
}

export interface CityProps {
  initialBuildings: CityBuilding[]
  /** Initial construction queue; defaults to empty (no category active). */
  initialQueue?: ConstructionQueue
  /** Static parks/lakes/roads/trees, built once at scene creation. See CityDecor. */
  decor?: CityDecor
  /** Skips scene.fog — see CitySceneOptions.disableFog. Built once at scene creation. */
  disableFog?: boolean
  /**
   * Notified after every state change (block added, building completed, reset).
   * Use this to drive external HUD components.
   */
  onStateChange?: (buildings: CityBuilding[], queue: ConstructionQueue) => void
  style?: React.CSSProperties
  className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const City = forwardRef<CityHandle, CityProps>(function City(
  { initialBuildings, initialQueue = {}, decor, disableFog, onStateChange, style, className },
  ref
) {
  const [state, dispatch] = useReducer(cityReducer, {
    buildings: initialBuildings,
    queue: initialQueue,
  })

  const rendererRef = useRef<CityRendererHandle>(null)

  // Stable refs so imperative handle always sees the latest state
  const stateRef           = useRef(state)
  stateRef.current         = state
  const initialBuildingsRef = useRef(initialBuildings)
  const initialQueueRef     = useRef(initialQueue)

  // Notify parent after every state change
  const onStateChangeRef = useRef(onStateChange)
  onStateChangeRef.current = onStateChange
  useEffect(() => {
    onStateChangeRef.current?.(state.buildings, state.queue)
  }, [state.buildings, state.queue])

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    addBlock(category: BuildingCategory) {
      const { queue, buildings } = stateRef.current
      const activeId = queue[category]
      if (!activeId) return

      const active = buildings.find((b) => b.id === activeId)
      if (!active || active.completedBlocks >= active.totalBlocks) return

      // Delegate the actual mesh update to CityRenderer; onBlockAdded keeps
      // React state in sync via dispatch.
      rendererRef.current?.addBlock(activeId)
    },

    addBlockToBuilding(buildingId: string) {
      // Same underlying call as addBlock(category) makes once it's resolved
      // activeId — onBlockAdded still fires and keeps React state in sync.
      rendererRef.current?.addBlock(buildingId)
    },

    playConstructionMontage(buildingId, count, staggerMs, onComplete) {
      rendererRef.current?.playConstructionMontage(buildingId, count, staggerMs, onComplete)
    },

    playAmbientCycle(buildingId, staggerMs, onComplete) {
      rendererRef.current?.playAmbientCycle(buildingId, staggerMs, onComplete)
    },

    stopAmbientCycle(buildingId) {
      rendererRef.current?.stopAmbientCycle(buildingId)
    },

    focusOnBlock(buildingId, blockIndex, opts) {
      rendererRef.current?.focusOnBlock(buildingId, blockIndex, opts)
    },

    resetCamera() {
      rendererRef.current?.resetCamera()
    },

    setVisibleCount(buildingId, count) {
      rendererRef.current?.setVisibleCount(buildingId, count)
    },

    reset() {
      dispatch({
        type: "RESET",
        buildings: initialBuildingsRef.current.map((b) => ({ ...b, completedBlocks: 0 })),
        queue: initialQueueRef.current,
      })
    },

    getBuildings() { return stateRef.current.buildings },
    getQueue()     { return stateRef.current.queue },
  }))

  // When CityRenderer fires addBlock's progress callback, update React state.
  // Building's useEffect will detect the new completedBlocks and call
  // ctx.syncBuilding, which cityScene handles as a no-op (counts already match).
  function handleBlockAdded(buildingId: string, completedBlocks: number) {
    dispatch({ type: "BLOCK_ADDED", buildingId, completedBlocks })
  }

  return (
    <CityRenderer
      ref={rendererRef}
      onBlockAdded={handleBlockAdded}
      decor={decor}
      disableFog={disableFog}
      style={style}
      className={className}
    >
      {state.buildings.map((building) => (
        <Building key={building.id} building={building} />
      ))}
    </CityRenderer>
  )
})
