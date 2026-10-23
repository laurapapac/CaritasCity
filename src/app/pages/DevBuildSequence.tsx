import { useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import { STATIC_CITY_DECOR, STATIC_LANDMARKS, STATIC_DECOR_BUILDINGS } from "../../components/city/staticCityData";
import { CITY_LAYOUT } from "../../data/cityLayout";
import { Button } from "../components/ui/button";

// Dev-only (2026-10-23, user request): the real city fully built except
// BUILDING_ID, which starts empty. Play builds it in three phases:
//   1. the first block, straight away, with a real placement's tall fall
//      (addBlock's DROP_HEIGHT_OWN);
//   2. FALLING_BLOCKS more, starting FALLING_DELAY_MS after the first, one
//      every FALLING_STAGGER_MS, with the decoration drop (DROP_HEIGHT);
//   3. every remaining block, starting REST_DELAY_MS after the last falling
//      one, one every REST_STAGGER_MS, popping in without animation.
// Each delay counts from when the previous block starts to fall. Values are
// meant to be edited here — no panel by design. Never touches the backend/DB.

const BUILDING_ID = "house_4";
const FALLING_DELAY_MS = 1500;
const FALLING_BLOCKS = 30;
const FALLING_STAGGER_MS = 100;
const REST_DELAY_MS = 600;
const REST_STAGGER_MS = 1;

export default function DevBuildSequence() {
  const cityRef = useRef<CityHandle>(null);
  const [running, setRunning] = useState(false);

  const initialBuildings = useMemo<CityBuilding[]>(
    () => [
      ...CITY_LAYOUT.map(
        (entry): CityBuilding => ({
          id: entry.buildingId,
          category: entry.category,
          position: { x: entry.x, z: entry.z },
          blueprint: blueprintForVariant(entry.variant, entry.category, entry.totalBlocks, entry.buildingId),
          totalBlocks: entry.totalBlocks,
          completedBlocks: entry.buildingId === BUILDING_ID ? 0 : entry.totalBlocks,
        })
      ),
      ...STATIC_LANDMARKS,
      ...STATIC_DECOR_BUILDINGS,
    ],
    []
  );

  function play() {
    const city = cityRef.current;
    if (!city) return;
    city.stopAmbientCycle(BUILDING_ID);
    city.setVisibleCount(BUILDING_ID, 0);
    setRunning(true);
    const done = () => setRunning(false);
    city.playBuildRun(BUILDING_ID, 1, 0, undefined, () =>
      city.playBuildRun(
        BUILDING_ID,
        FALLING_BLOCKS,
        FALLING_STAGGER_MS,
        undefined,
        () =>
          city.playBuildRun(BUILDING_ID, Infinity, REST_STAGGER_MS, undefined, done, {
            drop: "none",
            startDelayMs: REST_DELAY_MS,
          }),
        { drop: "decor", startDelayMs: FALLING_DELAY_MS }
      ),
      { drop: "own" }
    );
  }

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      <City
        ref={cityRef}
        initialBuildings={initialBuildings}
        decor={STATIC_CITY_DECOR}
        style={{ position: "absolute", inset: 0 }}
      />
      <Button size="lg" className="absolute bottom-6 left-1/2 -translate-x-1/2" onClick={play} disabled={running}>
        {running ? "Building…" : "Play"}
      </Button>
    </div>
  );
}
