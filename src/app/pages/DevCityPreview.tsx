import { useMemo, useRef } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, CityDecor } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS, STATIC_DECOR_BUILDINGS } from "../../components/city/staticCityData";
import { CITY_LAYOUT } from "../../data/cityLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

// Dev-only preview of the full Phase 2/3 static layout: all 160 real
// buildings (src/data/cityLayout.ts) placed inside a block grid, fully
// built, at their generated positions, plus the decoration-only buildings
// (src/data/cityDecorBuildings.ts), the full decor/terrain, and the two
// hand-placed landmarks (church, fountain) — src/components/city/staticCityData.ts,
// shared with the live kiosk (2026-08-13) so both render the exact same
// city. Purely client-side, never touches the real backend/DB, never
// reachable in a production build (see main.tsx).
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

    return [...realBuildings, ...STATIC_LANDMARKS, ...STATIC_DECOR_BUILDINGS];
  }, []);

  const decor: CityDecor = STATIC_CITY_DECOR;

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        ref={cityRef}
        initialBuildings={buildings}
        decor={decor}
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
