/**
 * Shared "what does this building variant look like" logic — used by both the
 * real kiosk (Kiosk.tsx) and the dev-only block-count preview page
 * (DevPreview.tsx) so they can't drift out of sync.
 */

import type { Blueprint } from "./types";
import type { BuildingCategory } from "../../lib/api";
import { generateHouseBlueprint, generateNeighbourhoodStyles, type HouseStyle, type StylePreset } from "./houseGenerator";
import { generatePlaceholderBlueprint } from "./placeholderGenerator";
import { HAND_AUTHORED_DESIGNS } from "./buildingGenerators";
import blueprintData from "../../imports/house-blueprint.json";

// Variants with no real design yet still fall back to a flat-colored
// placeholder box sized to the building's real block count.
export const CATEGORY_COLOR: Record<BuildingCategory, string> = {
  residential: "0xc05030",
  hospital: "0xd7dee2",
  food: "0xd98c3d",
  school: "0x4a72c9",
};

const SOURCE_BLUEPRINT = blueprintData as unknown as {
  name?: string;
  voxelCount?: number;
  voxels: Array<{ x: number; y: number; z: number; type: string; color: string }>;
};

// Every house used to share one single HOUSE_STYLE (2026-08-11: preset
// "classic" only, 1 style total — every house rendered as the exact same red
// brick). User request (2026-08-12): a wide variety of colors, doubled from
// 5 to 10 style presets in a same-day follow-up. Pooled across all 10 presets
// (WALL_PALETTES in houseGenerator.ts), 4 style variations per preset = 40
// total, so neighbouring houses can differ in color family too, not just
// shade within one family. Picked per building instance via hashSeed(buildingId)
// below, not randomly at render time — same "fixed design decision" pattern
// the rest of the city's layout uses (a house's look shouldn't change on
// re-render/re-login).
const HOUSE_PRESETS: StylePreset[] = [
  "classic", "nordic", "adobe", "modern", "cottage",
  "coastal", "sunny", "burgundy", "lavender", "charcoal",
];
const HOUSE_STYLE_POOL: HouseStyle[] = HOUSE_PRESETS.flatMap((preset, i) =>
  generateNeighbourhoodStyles(preset, "medium", "normal", 42 + i * 17, 4)
);

// Deterministic string → uint32 hash (djb2-ish), used to turn a stable
// buildingId into a stable pick from HOUSE_STYLE_POOL / a variantIndex passed
// to HAND_AUTHORED_DESIGNS generators (2026-08-12) — same building always
// looks the same across renders/sessions, without needing a stored per
// -building "style" column in the DB.
function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function blueprintForVariant(
  variant: string,
  category: BuildingCategory,
  totalBlocks: number,
  buildingId: string = variant
): Blueprint {
  const variantIndex = hashSeed(buildingId);
  if (variant === "house") {
    const style = HOUSE_STYLE_POOL[variantIndex % HOUSE_STYLE_POOL.length];
    return generateHouseBlueprint(SOURCE_BLUEPRINT, style);
  }
  const handAuthored = HAND_AUTHORED_DESIGNS[variant];
  if (handAuthored) {
    const voxels = handAuthored(variantIndex);
    return { name: variant, voxelCount: voxels.length, voxels };
  }
  return generatePlaceholderBlueprint(totalBlocks, CATEGORY_COLOR[category]);
}
