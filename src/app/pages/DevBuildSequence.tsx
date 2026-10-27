import { useEffect, useMemo, useRef, useState } from "react";
import { City, type CityHandle } from "../../components/city/City";
import {
  cameraPathDuration,
  cameraStateAt,
  easeInOut,
  type CameraKeyframe,
  type CameraSpin,
} from "../../components/city/cameraPath";
import type { CityBuilding } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import {
  STATIC_CITY_DECOR,
  STATIC_LANDMARKS,
  STATIC_DECOR_BUILDINGS,
} from "../../components/city/staticCityData";
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

const BUILDING_ID = "house_25";
const FALLING_DELAY_MS = 1800;
const FALLING_BLOCKS = 0;
const FALLING_STAGGER_MS = 200;
const REST_DELAY_MS = 2700;
const REST_STAGGER_MS = 50;

const CAMERA_PATH: CameraKeyframe[] = [
  // Kadar 1
  /*{
    position: {
      x: -27.725,
      y: 3.089,
      z: 64.427,
    },
    target: {
      x: -32.5,
      y: 0.5,
      z: 69.5,
    },
    fov: 50,
  },
  {
    position: {
      x: -27.725,
      y: 3.089,
      z: 64.427,
    },
    target: {
      x: -32.5,
      y: 0.5,
      z: 69.5,
    },
    fov: 50,
    durationMs: 1500,
  },*/
  {
    position: {
      x: -37.374,
      y: 2.816,
      z: 64.39,
    },
    target: {
      x: -32.5,
      y: 0.5,
      z: 69.5,
    },
    fov: 50,
  },
  {
    position: {
      x: -37.374,
      y: 2.816,
      z: 64.39,
    },
    target: {
      x: -32.5,
      y: 0.5,
      z: 69.5,
    },
    fov: 50,
    durationMs: 2400,
  },

  // Kadar 2
  /*{
    position: {
      x: -19.232,
      y: 10.047,
      z: 83.834,
    },
    target: {
      x: -29.09,
      y: 0.5,
      z: 74.595,
    },
    fov: 50,
    durationMs: 5500,
  },*/
  {
    position: {
      x: -41.82,
      y: 14.807,
      z: 58.165,
    },
    target: {
      x: -21.651,
      y: 0.5,
      z: 85.453,
    },
    fov: 50,
    durationMs: 60000,
  },

  // Kadar 3
  /*{
    position: {
      x: -46.451,
      y: 12.958,
      z: 88.432,
    },
    target: {
      x: -29.093,
      y: 0.5,
      z: 74.598,
    },
    fov: 50,
    durationMs: 5500,
  },*/
  {
    position: {
      x: -38.422,
      y: 16.489,
      z: 50.685,
    },
    target: {
      x: -22.57,
      y: 0.5,
      z: 85.724,
    },
    fov: 50,
    durationMs: 4000,
  },

  // Kadar 4
  /*{
    position: {
      x: -38.518,
      y: 13.364,
      z: 47.479,
    },
    target: {
      x: -26.646,
      y: 0.5,
      z: 72.597,
    },
    fov: 50,
    durationMs: 5500,
  },*/
  {
    position: {
      x: -20.801,
      y: 17.887,
      z: 46.992,
    },
    target: {
      x: -30.859,
      y: 0.5,
      z: 86.469,
    },
    fov: 50,
    durationMs: 7000,
  },

  // Kadar 5
  /*{
    position: {
      x: -49.347,
      y: 19.58,
      z: 21.245,
    },
    target: {
      x: -17.795,
      y: 0.5,
      z: 94.454,
    },
    fov: 50,
    durationMs: 2000,
  },*/
  {
    position: {
      x: 1.036,
      y: 24.747,
      z: 48.814,
    },
    target: {
      x: -35.67,
      y: 0.5,
      z: 78.867,
    },
    fov: 50,
    durationMs: 8000,
  },

  // Kadar 6
  /*{
    position: {
      x: -159.813,
      y: 286.199,
      z: -250.271,
    },
    target: {
      x: -40.316,
      y: 0.5,
      z: -5.704,
    },
    fov: 50,
    durationMs: 11500,
  },*/
  {
    position: {
      x: 41.495,
      y: 48.007,
      z: 113.333,
    },
    target: {
      x: -27.765,
      y: 0.5,
      z: 61.689,
    },
    fov: 50,
    durationMs: 10000,
  },

  // Kadar 7
  {
    position: {
      x: 71.01,
      y: 303.352,
      z: 418.5,
    },
    target: {
      x: 5.179,
      y: 0.5,
      z: 113.639,
    },
    fov: 50,
    durationMs: 12000,
  },

  // { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50 },
  // { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50, durationMs: 4000 },
];
// Gentle start and stop over the whole path; set to false for constant speed.
const CAMERA_EASE = false;
// Turn direction between shots, as the city appears to spin on screen:
// "clockwise", "counterclockwise", or "shortest" (smallest turn each time,
// which can reverse direction between shots).
const CAMERA_SPIN: CameraSpin = "shortest";

// Buildings left out of the scene entirely, e.g. ones blocking the camera
// path. Any building id works: real ones ("house_12"), decoration-only
// ones ("deco_school_0") and the landmarks ("church", "fountain").
// BUILDING_ID is never hidden.
// const HIDDEN_BUILDINGS: string[] = ["school_21", "deco_school_4"];
const HIDDEN_BUILDINGS: string[] = ["school_21"];

export default function DevBuildSequence() {
  const cityRef = useRef<CityHandle>(null);
  const [building, setBuilding] = useState(false);
  const [cameraMoving, setCameraMoving] = useState(false);
  const cameraFrame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(cameraFrame.current), []);

  function playCamera(city: CityHandle) {
    cancelAnimationFrame(cameraFrame.current);
    if (CAMERA_PATH.length === 0) return;
    const total = cameraPathDuration(CAMERA_PATH);
    const ease = CAMERA_EASE ? easeInOut : undefined;
    const start = performance.now();
    setCameraMoving(true);
    const tick = () => {
      const elapsed = performance.now() - start;
      city.setCameraState(
        cameraStateAt(CAMERA_PATH, elapsed, ease, CAMERA_SPIN),
      );
      if (elapsed < total) cameraFrame.current = requestAnimationFrame(tick);
      else setCameraMoving(false);
    };
    tick();
  }

  const initialBuildings = useMemo<CityBuilding[]>(
    () =>
      [
        ...CITY_LAYOUT.map(
          (entry): CityBuilding => ({
            id: entry.buildingId,
            category: entry.category,
            position: { x: entry.x, z: entry.z },
            blueprint: blueprintForVariant(
              entry.variant,
              entry.category,
              entry.totalBlocks,
              entry.buildingId,
            ),
            totalBlocks: entry.totalBlocks,
            completedBlocks:
              entry.buildingId === BUILDING_ID ? 0 : entry.totalBlocks,
          }),
        ),
        ...STATIC_LANDMARKS,
        ...STATIC_DECOR_BUILDINGS,
      ].filter((b) => b.id === BUILDING_ID || !HIDDEN_BUILDINGS.includes(b.id)),
    [],
  );

  function play() {
    const city = cityRef.current;
    if (!city) return;
    city.stopAmbientCycle(BUILDING_ID);
    city.setVisibleCount(BUILDING_ID, 0);
    playCamera(city);
    setBuilding(true);
    const done = () => setBuilding(false);
    city.playBuildRun(
      BUILDING_ID,
      1,
      0,
      undefined,
      () =>
        city.playBuildRun(
          BUILDING_ID,
          FALLING_BLOCKS,
          FALLING_STAGGER_MS,
          undefined,
          () =>
            city.playBuildRun(
              BUILDING_ID,
              Infinity,
              REST_STAGGER_MS,
              undefined,
              done,
              {
                drop: "none",
                startDelayMs: REST_DELAY_MS,
              },
            ),
          { drop: "decor", startDelayMs: FALLING_DELAY_MS },
        ),
      { drop: "own" },
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
      {/* Hidden while playing so it stays out of the shot; back once both
          the build and the camera move have finished. */}
      {!building && !cameraMoving && (
        <Button
          size="lg"
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
          onClick={play}
        >
          Play
        </Button>
      )}
    </div>
  );
}
