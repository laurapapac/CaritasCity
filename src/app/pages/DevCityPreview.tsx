import { useMemo, useRef } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, CityDecor } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { CITY_LAYOUT } from "../../data/cityLayout";
import { PARKS, LAKES, BEACHES, PARK_TREES, BUSHES } from "../../data/cityDecor";
import { ROADS, ROAD_WIDTH, ROAD_TREES } from "../../data/cityRoads";
import { LAMP_POSTS, BENCHES, PLAZAS } from "../../data/cityFurniture";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

// Dev-only preview of the full Phase 2/3 static layout: all 158 buildings
// (src/data/cityLayout.ts) placed inside a block grid, fully built, at their
// generated positions, plus parks/lakes/roads/trees (src/data/cityDecor.ts +
// src/data/cityRoads.ts) — for reviewing the layout before treating it as
// final. Purely client-side, never touches the real backend/DB, never
// reachable in a production build (see main.tsx).
//
// Plus one hand-placed church (2026-08-11, user request) — purely aesthetic,
// not one of the 158 real QR-linked buildings, so it's added here directly
// rather than through src/data/cityLayout.ts. Positioned in the buffer leaf
// just east of park_north (rect roughly x:[-26.6,45.3] z:[92.8,195.3] —
// excluded from both buildings and roads by generateCityLayout.ts since a
// park/lake zone overlaps it, so it's open ground with nothing else placed
// there), safely clear of park_north's own circle (center -40,175, radius
// 20; distance from the church's center below is ~41).

const CHURCH_POSITION = { x: 0, z: 165 };

// Second hand-placed landmark (2026-08-12, user request) — also purely
// aesthetic, not one of the 158 real QR-linked buildings, added the same way
// as the church. Positioned south of the church within the same buffer leaf
// (see the CHURCH_POSITION comment above for its bounds), clear of the
// church's own footprint, the leaf's real roads on every side, and the
// zone-buffer/road tree clearances.
const FOUNTAIN_POSITION = { x: 25, z: 110 };

export default function DevCityPreview() {
  const cityRef = useRef<CityHandle>(null);

  const buildings = useMemo<CityBuilding[]>(() => {
    const realBuildings = CITY_LAYOUT.map((entry) => ({
      id: entry.buildingId,
      category: entry.category,
      position: { x: entry.x, z: entry.z },
      blueprint: blueprintForVariant(entry.variant, entry.category, entry.totalBlocks, entry.buildingId),
      totalBlocks: entry.totalBlocks,
      completedBlocks: entry.totalBlocks,
    }));

    const churchBlueprint = blueprintForVariant("church", "school", 0);
    const churchBlockCount = churchBlueprint.voxelCount ?? churchBlueprint.voxels.length;
    const church: CityBuilding = {
      id: "church",
      category: "school", // unused — "church" is hand-authored, category only matters for the placeholder fallback
      position: CHURCH_POSITION,
      blueprint: churchBlueprint,
      totalBlocks: churchBlockCount,
      completedBlocks: churchBlockCount,
    };

    const fountainBlueprint = blueprintForVariant("fountain", "school", 0);
    const fountainBlockCount = fountainBlueprint.voxelCount ?? fountainBlueprint.voxels.length;
    const fountain: CityBuilding = {
      id: "fountain",
      category: "school", // unused — "fountain" is hand-authored, same as church
      position: FOUNTAIN_POSITION,
      blueprint: fountainBlueprint,
      totalBlocks: fountainBlockCount,
      completedBlocks: fountainBlockCount,
    };

    return [...realBuildings, church, fountain];
  }, []);

  const decor = useMemo<CityDecor>(
    () => ({
      parks: PARKS,
      lakes: LAKES,
      beaches: BEACHES,
      roads: ROADS,
      roadWidth: ROAD_WIDTH,
      roadTrees: ROAD_TREES,
      parkTrees: PARK_TREES,
      bushes: BUSHES,
      lampPosts: LAMP_POSTS,
      benches: BENCHES,
      plazas: PLAZAS,
    }),
    []
  );

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        ref={cityRef}
        initialBuildings={buildings}
        decor={decor}
        disableFog
        style={{ position: "absolute", inset: 0 }}
      />

      <Card className="absolute left-4 top-4 w-80 bg-card/95 backdrop-blur">
        <CardHeader>
          <CardTitle>Whole-city layout preview</CardTitle>
          <CardDescription>
            Dev-only — {buildings.length} buildings, {decor.parks.length} parks,{" "}
            {decor.lakes.length} lakes, {decor.roads.length} road segments,{" "}
            {(decor.plazas ?? []).length} plazas. Scroll out to see the whole terrain.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
