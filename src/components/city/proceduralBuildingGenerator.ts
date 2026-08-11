/**
 * Procedural building generator — produces a real architectural shape (hollow
 * shell: foundation, perimeter walls with windows, roof cap) instead of
 * generatePlaceholderBlueprint's solid box. A hollow shell gets far more
 * visual size for the same voxel budget than a solid fill — e.g. the current
 * 4,000-voxel placeholder is a cramped 16×16×16 solid cube, whereas a shell
 * with the same budget can be a proper multi-floor building footprint.
 *
 * Voxels are pushed foundation → walls (bottom-up) → roof, then hard-capped
 * (or padded, if the natural shape falls short) to hit `totalBlocks` exactly
 * — same constraint generatePlaceholderBlueprint already satisfies. Emission
 * order doesn't need to match reveal order: processBlueprint sorts every
 * blueprint's voxels (y, x, z) before building the reveal sequence anyway.
 */

import type { Blueprint, BlueprintVoxel } from "./types"
import { GLASS_HEX } from "./utils"

export interface BuildingPalette {
  base: string
  wall: string
  roof: string
}

export interface BuildingConfig {
  /** Footprint in voxels along X. */
  width: number
  /** Footprint in voxels along Z. */
  depth: number
  /** Voxel height of one floor's walls. */
  floorHeight: number
  /**
   * Place a window every N positions along each wall (measured from that
   * wall's own corner, so both walls of a perimeter get an even rhythm).
   */
  windowEvery: number
  palette: BuildingPalette
  /** Fraction of totalBlocks reserved for the roof cap. Defaults to 0.1. */
  roofBudgetFraction?: number
}

const GLASS_HEX_STRING = `0x${GLASS_HEX.toString(16)}`

// Solves for how many floors of perimeter wall fit in the voxel budget left
// over after the foundation and a reserved roof allowance — so per-variant
// configs only need to describe proportions (footprint, floor height), not
// hand-tune a floor count by trial and error against each totalBlocks target.
function computeFloors(
  footprintArea: number,
  perimeter: number,
  floorHeight: number,
  totalBlocks: number,
  roofBudgetFraction: number
): number {
  const roofBudget = totalBlocks * roofBudgetFraction
  const available = totalBlocks - footprintArea - roofBudget
  return Math.max(1, Math.floor(available / (perimeter * floorHeight)))
}

export function generateProceduralBuilding(config: BuildingConfig, totalBlocks: number): Blueprint {
  const { width, depth, floorHeight, windowEvery, palette } = config
  const roofBudgetFraction = config.roofBudgetFraction ?? 0.1
  const perimeter = 2 * (width + depth) - 4
  const floors = computeFloors(width * depth, perimeter, floorHeight, totalBlocks, roofBudgetFraction)

  const voxels: BlueprintVoxel[] = []
  const push = (x: number, y: number, z: number, type: string, color: string) => {
    if (voxels.length >= totalBlocks) return false
    voxels.push({ x, y, z, type, color })
    return true
  }

  build: {
    // Foundation slab — solid, y = 0.
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        if (!push(x, 0, z, "stone", palette.base)) break build
      }
    }

    // Walls — perimeter only, bottom-up, one floor's worth of rows at a time.
    const wallTop = floors * floorHeight
    for (let y = 1; y <= wallTop; y++) {
      const localY = (y - 1) % floorHeight
      // Skip the row right at the floor/ceiling line so windows read as
      // punched into the middle of each floor, not smeared across it.
      const inWindowBand = localY >= 1 && localY <= floorHeight - 2
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const onPerimeter = x === 0 || x === width - 1 || z === 0 || z === depth - 1
          if (!onPerimeter) continue
          const alongWall = x === 0 || x === width - 1 ? z : x
          const isCorner = (x === 0 || x === width - 1) && (z === 0 || z === depth - 1)
          const isWindow =
            inWindowBand && !isCorner && alongWall % windowEvery === Math.floor(windowEvery / 2)
          if (!push(x, y, z, isWindow ? "window" : "wall", isWindow ? GLASS_HEX_STRING : palette.wall)) {
            break build
          }
        }
      }
    }

    // Roof — solid cap, one layer at a time until the remaining budget (if
    // any) is used up. Usually just 1-2 layers given the roof budget reserved
    // above; if a config's proportions are off this grows instead of erroring,
    // which is a visible signal to fix the config rather than a hard failure.
    let roofY = wallTop + 1
    while (voxels.length < totalBlocks) {
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          if (!push(x, roofY, z, "roof", palette.roof)) break build
        }
      }
      roofY++
    }
  }

  return { name: "Procedural", voxelCount: voxels.length, voxels }
}
