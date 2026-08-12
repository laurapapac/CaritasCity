// ─────────────────────────────────────────────────────────────────────────────
// City domain types
// ─────────────────────────────────────────────────────────────────────────────

export type BuildingCategory = "residential" | "school" | "hospital" | "food"

// ── Blueprint (raw JSON shape) ────────────────────────────────────────────────

export interface BlueprintVoxel {
  x: number
  y: number
  z: number
  type: string
  color: string
}

export interface Blueprint {
  name?: string
  voxelCount?: number
  voxels: BlueprintVoxel[]
}

// ── City building ─────────────────────────────────────────────────────────────

export interface CityBuilding {
  id: string
  category: BuildingCategory
  /** World-space position on the terrain (block units). Y is always 0 (ground). */
  position: { x: number; z: number }
  blueprint: Blueprint
  totalBlocks: number
  completedBlocks: number
}

// ── Construction queue ────────────────────────────────────────────────────────
// Maps each category to the id of the currently active building.
// undefined means the category has no pending construction.

export type ConstructionQueue = Partial<Record<BuildingCategory, string>>

// ── Processed block (world-space, ready for Three.js) ────────────────────────

export interface Block {
  x: number
  y: number
  z: number
  type: string
  color: string | number
}

// ── Environment decor (Phase 3: parks, lakes, roads, trees) ──────────────────
// Purely visual, non-voxel scenery layered on top of the building layout —
// no gameplay/DB tie-in. Positions are static design data (src/data/cityDecor.ts,
// src/data/cityRoads.ts), same "fixed decision, not runtime state" treatment
// as CityLayoutEntry.

export interface DecorZone {
  id: string
  x: number
  z: number
  radius: number
}

/** A park's silhouette: the union of BSP block tiles its reserved-zone circle
 *  overlaps (see parkTilesFor in generateCityLayout.ts) — follows the block
 *  grid instead of being a circle. */
export interface ParkShape {
  id: string
  tiles: { x0: number; z0: number; x1: number; z1: number }[]
}

/** A lake's organic outline (sampleBlobPolygon in generateCityLayout.ts): a
 *  circle perturbed by two sine waves, not a true circle. */
export interface LakeShape {
  id: string
  points: { x: number; z: number }[]
}

/** A plain rect (like a park tile) filling a lake's block minus road
 *  clearance, rendered under the lake so the lake's own (smaller, organic)
 *  shape covers its middle, leaving a visible ring — a placeholder "beach"
 *  until a real texture replaces the flat color (2026-08-12). */
export interface BeachShape {
  id: string
  x0: number
  z0: number
  x1: number
  z1: number
}

export interface RoadSegment {
  x1: number
  z1: number
  x2: number
  z2: number
}

export interface TreeMarker {
  x: number
  z: number
}

export interface OrientedMarker {
  x: number
  z: number
  angle: number
}

export interface CityDecor {
  parks: ParkShape[]
  lakes: LakeShape[]
  beaches?: BeachShape[]
  roads: RoadSegment[]
  roadWidth: number
  roadTrees: TreeMarker[]
  parkTrees: TreeMarker[]
  /** Block-interior filler decor (2026-08-11) — all optional so callers that
   *  build a CityDecor without them (none currently do, but keep it safe)
   *  don't break. */
  bushes?: TreeMarker[]
  lampPosts?: OrientedMarker[]
  benches?: OrientedMarker[]
  plazas?: DecorZone[]
}
