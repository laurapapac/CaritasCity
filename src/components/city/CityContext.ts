import { createContext } from "react"
import type { Block, CityBuilding } from "./types"

/**
 * Injected by CityRenderer; consumed by Building components.
 * Building components call these to register/sync themselves with the
 * underlying Three.js scene without knowing about the renderer directly.
 */
export interface CityContextValue {
  /** Create or update a building's mesh in the scene. */
  syncBuilding(building: CityBuilding, blocks: Block[]): void
  /** Remove a building's mesh from the scene (called on unmount). */
  unregisterBuilding(id: string): void
}

export const CityContext = createContext<CityContextValue | null>(null)
