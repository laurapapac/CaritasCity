/**
 * Building — React component responsible for rendering a single building.
 *
 * Renders nothing in the DOM.  On mount it registers itself with the city
 * scene via CityContext; whenever `building.completedBlocks` changes it syncs
 * the Three.js mesh; on unmount it removes itself from the scene.
 *
 * This mirrors how react-three-fiber components work (no DOM output, scene
 * side-effects through context) but uses pure Three.js under the hood.
 *
 * Usage (always inside <CityRenderer>):
 *   <Building building={cityBuilding} />
 */

import { useContext, useEffect, useMemo } from "react"
import { CityContext } from "./CityContext"
import type { CityBuilding } from "./types"
import { processBlueprint } from "./utils"

interface BuildingProps {
  building: CityBuilding
}

export function Building({ building }: BuildingProps) {
  const ctx = useContext(CityContext)

  // Convert blueprint voxels to world-space Block[] once per building.
  // blueprint and position are stable references (state uses immutable updates
  // that only touch completedBlocks), so this only recomputes when a building
  // is actually replaced.
  const blocks = useMemo(
    () => processBlueprint(building.blueprint, building.position),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building.id] // re-process only if the building is swapped out entirely
  )

  // Remove from scene when this Building component unmounts
  useEffect(() => {
    return () => { ctx?.unregisterBuilding(building.id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.id])

  // Sync completedBlocks to the Three.js scene after every change.
  // CityRenderer uses useLayoutEffect so the scene exists before this fires.
  useEffect(() => {
    ctx?.syncBuilding(building, blocks)
  // ctx is a stable object (only references scene refs), safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building.completedBlocks, building.id, blocks])

  return null // No DOM output — visual lives in the shared Three.js canvas
}
