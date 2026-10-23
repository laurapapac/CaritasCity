import { useEffect, useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import { cameraPathDuration, cameraStateAt, easeInOut, type CameraKeyframe } from "../../components/city/cameraPath";
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
//
// Play also flies the camera through CAMERA_PATH (2026-10-23, user request):
// paste shots from the camera logger (/dev/city or /dev/build → Copy) in
// order and give every shot after the first a durationMs — the time to get
// there from the previous one. Play snaps to the first shot, then moves
// through the rest (see cameraPath.ts). Leave it empty to keep the camera
// where it is. Log shots at the same window size you'll play at — fov is
// vertical, so a different aspect shows more or less at the sides.

const BUILDING_ID = "house_4";
const FALLING_DELAY_MS = 1500;
const FALLING_BLOCKS = 30;
const FALLING_STAGGER_MS = 100;
const REST_DELAY_MS = 600;
const REST_STAGGER_MS = 1;

const CAMERA_PATH: CameraKeyframe[] = [
  // { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50 },
  // { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50, durationMs: 4000 },
];
// Gentle start and stop over the whole path; set to false for constant speed.
const CAMERA_EASE = true;

export default function DevBuildSequence() {
  const cityRef = useRef<CityHandle>(null);
  const [running, setRunning] = useState(false);
  const cameraFrame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(cameraFrame.current), []);

  function playCamera(city: CityHandle) {
    cancelAnimationFrame(cameraFrame.current);
    if (CAMERA_PATH.length === 0) return;
    const total = cameraPathDuration(CAMERA_PATH);
    const ease = CAMERA_EASE ? easeInOut : undefined;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      city.setCameraState(cameraStateAt(CAMERA_PATH, elapsed, ease));
      if (elapsed < total) cameraFrame.current = requestAnimationFrame(tick);
    };
    tick();
  }

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
    playCamera(city);
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
