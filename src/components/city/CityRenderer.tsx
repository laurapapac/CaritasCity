/**
 * CityRenderer — React component responsible for rendering all buildings.
 *
 * - Owns the shared Three.js scene (one renderer, one camera, one canvas).
 * - Provides CityContext so child <Building> components can register themselves.
 * - Exposes addBlock(buildingId) via ref for the construction queue.
 *
 * Initialization uses useLayoutEffect so the scene is ready before any child
 * Building component's useEffect fires — they need to call syncBuilding on
 * mount, and syncBuilding calls into the scene.
 */

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { createCityScene, type CitySceneHandle } from "./cityScene"
import { CityContext, type CityContextValue } from "./CityContext"
import type { Block, CityBuilding, CityDecor } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CityRendererHandle {
  /** Reveal one block for the given building (drops in), fire onBlockAdded. */
  addBlock(buildingId: string): void
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
  focusOnBlock(buildingId: string, blockIndex: number): void
  /** Marks a block as "this is your block" with a persistent lit-up glow. See CitySceneHandle. */
  markOwnBlock(buildingId: string, blockIndex: number): void
  /** Snap the camera back to the wide establishing shot. */
  resetCamera(): void
  /** Instantly set a building's visible block count. See CitySceneHandle. */
  setVisibleCount(buildingId: string, count: number): void
}

export interface CityRendererProps {
  /**
   * Called after each incremental block is placed.
   * Provides the building id and new completedBlocks count so the parent can
   * update its state (which flows back down via <Building> props to sync the mesh).
   */
  onBlockAdded?: (buildingId: string, completedBlocks: number) => void
  /** Static parks/lakes/roads/trees, built once at scene creation. See CityDecor. */
  decor?: CityDecor
  /** Skips scene.fog — see CitySceneOptions.disableFog. Built once at scene creation. */
  disableFog?: boolean
  style?: React.CSSProperties
  className?: string
  /** <Building> components — rendered into React tree but produce no DOM. */
  children?: ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const CityRenderer = forwardRef<CityRendererHandle, CityRendererProps>(
  function CityRenderer({ onBlockAdded, decor, disableFog, style, className, children }, ref) {
    const containerRef   = useRef<HTMLDivElement>(null)
    const sceneRef       = useRef<CitySceneHandle | null>(null)
    // Keep onBlockAdded in a ref so the addBlock closure never goes stale
    const onBlockAddedRef = useRef(onBlockAdded)
    onBlockAddedRef.current = onBlockAdded
    // Decor/disableFog are applied once at scene creation, like
    // initialBuildings — refs (not deps) so a later re-render with new values
    // doesn't tear down and rebuild the whole scene.
    const decorRef = useRef(decor)
    decorRef.current = decor
    const disableFogRef = useRef(disableFog)
    disableFogRef.current = disableFog

    // useLayoutEffect runs synchronously after DOM mutations, before useEffect.
    // This guarantees the scene exists when child Building useEffects fire.
    useLayoutEffect(() => {
      const el = containerRef.current
      if (!el) return
      const s = createCityScene(el, { decor: decorRef.current, disableFog: disableFogRef.current })
      sceneRef.current = s
      return () => { s.dispose(); sceneRef.current = null }
    }, [])

    useImperativeHandle(ref, () => ({
      addBlock(buildingId: string) {
        sceneRef.current?.addBlock(buildingId, (n) => {
          onBlockAddedRef.current?.(buildingId, n)
        })
      },
      playConstructionMontage(buildingId, count, staggerMs, onComplete) {
        sceneRef.current?.playConstructionMontage(buildingId, count, staggerMs, onComplete)
      },
      playAmbientCycle(buildingId, staggerMs, onComplete) {
        sceneRef.current?.playAmbientCycle(buildingId, staggerMs, onComplete)
      },
      stopAmbientCycle(buildingId) {
        sceneRef.current?.stopAmbientCycle(buildingId)
      },
      focusOnBlock(buildingId, blockIndex) {
        sceneRef.current?.focusOnBlock(buildingId, blockIndex)
      },
      markOwnBlock(buildingId, blockIndex) {
        sceneRef.current?.markOwnBlock(buildingId, blockIndex)
      },
      resetCamera() {
        sceneRef.current?.resetCamera()
      },
      setVisibleCount(buildingId, count) {
        sceneRef.current?.setVisibleCount(buildingId, count)
      },
    }))

    // Stable context value — only references scene via sceneRef, so it never
    // changes identity between renders and won't trigger Building re-renders.
    const ctxValue = useMemo<CityContextValue>(
      () => ({
        syncBuilding(building: CityBuilding, blocks: Block[]) {
          sceneRef.current?.syncBuilding(building, blocks)
        },
        unregisterBuilding(id: string) {
          sceneRef.current?.unregisterBuilding(id)
        },
      }),
      [] // truly stable — sceneRef never changes reference
    )

    return (
      <CityContext.Provider value={ctxValue}>
        {/* Canvas lives here; Building children render null in the DOM */}
        <div
          ref={containerRef}
          style={{ width: "100%", height: "100%", ...style }}
          className={className}
        />
        {children}
      </CityContext.Provider>
    )
  }
)
