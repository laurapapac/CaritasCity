import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  ApiError,
  enterCode,
  getBuildings,
  getSchools,
  placeBlock,
  type BlockInfo,
  type BuildingCategory,
  type BuildingState,
  type School,
} from "../../lib/api";
import { City, type CityHandle } from "../../components/city/City";
import type { CityBuilding, ConstructionQueue } from "../../components/city/types";
import { blueprintForVariant } from "../../components/city/blueprintForVariant";
import {
  MONTAGE_BLOCK_COUNT,
  MONTAGE_STAGGER_MS,
  MONTAGE_FINAL_BLOCK_DELAY_MS,
} from "../../components/city/constructionMontageConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";

// Matches server/src/lib/codes.ts DESKTOP_CODE_ALPHABET.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// input-otp tests raw keystrokes against this pattern *before* onChange ever runs
// (see its native input handler), so lowercase has to be allowed here too, not just
// handled by the onChange's .toUpperCase() below — otherwise it's rejected outright.
const CODE_PATTERN = `^[${CODE_ALPHABET}${CODE_ALPHABET.toLowerCase()}]*$`;
const CODE_LENGTH = 6;

const CATEGORY_LABEL: Record<BuildingCategory, string> = {
  residential: "Residential",
  hospital: "Hospital",
  food: "Food",
  school: "School",
};

const PLOTS: Record<BuildingCategory, { x: number; z: number }> = {
  residential: { x: -30, z: -20 },
  hospital: { x: 30, z: -20 },
  food: { x: -30, z: 20 },
  school: { x: 30, z: 20 },
};

function buildCityBuilding(b: BuildingState): CityBuilding {
  return {
    id: b.id,
    category: b.category,
    position: PLOTS[b.category],
    blueprint: blueprintForVariant(b.variant, b.category, b.totalBlocks),
    totalBlocks: b.totalBlocks,
    // One behind the server — the boot-reveal effect plays the last block's
    // animation to catch back up, instead of just appearing already-there.
    completedBlocks: Math.max(0, b.completedBlocks - 1),
  };
}

type Phase =
  | { phase: "loading" }
  | { phase: "load_error" }
  | { phase: "entry"; error?: string }
  | { phase: "needs_school"; code: string; category: BuildingCategory; error?: string }
  | { phase: "constructing" }
  | { phase: "placed"; block: BlockInfo }
  | { phase: "existing"; block: BlockInfo };

function ProgressBlock({ block }: { block: BlockInfo }) {
  const pct = block.totalBlocks > 0 ? (block.completedBlocks / block.totalBlocks) * 100 : 0;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        {CATEGORY_LABEL[block.category]} — {block.buildingVariant}
      </p>
      <Progress value={pct} />
      <p className="text-muted-foreground text-xs">
        {block.completedBlocks}/{block.totalBlocks} placed
      </p>
    </div>
  );
}

function EntryStep({ error, onSubmit }: { error?: string; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState("");

  return (
    <Card className="pointer-events-auto w-full max-w-sm bg-card/95 backdrop-blur">
      <CardHeader>
        <CardTitle>Enter your code</CardTitle>
        <CardDescription>Type the code shown on your phone</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <InputOTP
          value={code}
          onChange={(v) => setCode(v.toUpperCase())}
          maxLength={CODE_LENGTH}
          pattern={CODE_PATTERN}
          onComplete={onSubmit}
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button disabled={code.length !== CODE_LENGTH} onClick={() => onSubmit(code)}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function SchoolStep({
  category,
  error,
  onConfirm,
  onBack,
}: {
  category: BuildingCategory;
  error?: string;
  onConfirm: (schoolId: number) => void;
  onBack: () => void;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<number | undefined>();
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSchools()
      .then(setSchools)
      .catch(() => setLoadError(true));
  }, []);

  const selected = schools.find((s) => s.id === schoolId);

  return (
    <Card className="pointer-events-auto w-full max-w-sm bg-card/95 backdrop-blur">
      <CardHeader>
        <CardTitle>Which school?</CardTitle>
        <CardDescription>
          Placing a {CATEGORY_LABEL[category]} block — pick the school to credit
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="justify-between">
              {selected ? selected.name : "Select a school"}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command>
              <CommandInput placeholder="Search schools…" />
              <CommandList>
                <CommandEmpty>No school found.</CommandEmpty>
                <CommandGroup>
                  {schools.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      onSelect={() => {
                        setSchoolId(s.id);
                        setOpen(false);
                      }}
                    >
                      <Check className={s.id === schoolId ? "opacity-100" : "opacity-0"} />
                      {s.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {loadError && (
          <p className="text-destructive text-sm">Couldn't load the school list. Try reloading.</p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button disabled={!schoolId} onClick={() => schoolId && onConfirm(schoolId)}>
            Enter the game
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Kiosk() {
  const cityRef = useRef<CityHandle>(null);
  const [cityData, setCityData] = useState<{
    rows: BuildingState[];
    buildings: CityBuilding[];
    queue: ConstructionQueue;
  } | null>(null);
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const revealedOnLoad = useRef(false);

  useEffect(() => {
    getBuildings()
      .then((rows) => {
        const buildings = rows.map(buildCityBuilding);
        const queue: ConstructionQueue = {};
        for (const row of rows) queue[row.category] = row.id;
        setCityData({ rows, buildings, queue });
        setState({ phase: "entry" });
      })
      .catch(() => setState({ phase: "load_error" }));
  }, []);

  // Boot animation: replay the most recent real block per category so the
  // kiosk always opens with a "here's what's been built" reveal.
  useEffect(() => {
    if (!cityData || revealedOnLoad.current) return;
    revealedOnLoad.current = true;
    for (const row of cityData.rows) {
      if (row.completedBlocks > 0) cityRef.current?.addBlock(row.category);
    }
  }, [cityData]);

  function handleEnter(code: string) {
    enterCode(code)
      .then((res) => {
        if (res.status === "existing") {
          cityRef.current?.focusOnBlock(res.block.buildingId, res.block.blockIndex, { highlight: true });
          setState({ phase: "existing", block: res.block });
        } else {
          setState({ phase: "needs_school", code, category: res.category });
        }
      })
      .catch((err) => {
        const message =
          err instanceof ApiError && err.code === "invalid_or_expired_code"
            ? "That code is invalid or has expired."
            : "Something went wrong — try again.";
        setState({ phase: "entry", error: message });
      });
  }

  function handleConfirm(code: string, category: BuildingCategory, schoolId: number) {
    placeBlock(code, schoolId)
      .then((res) => {
        setState({ phase: "constructing" });
        // Frame the block *before* the montage starts, not after — otherwise the
        // staggered reveal plays out at the wide establishing shot, where
        // individual voxels are sub-pixel and the stagger is imperceptible.
        cityRef.current?.focusOnBlock(res.block.buildingId, res.block.blockIndex);
        cityRef.current?.playConstructionMontage(
          res.block.buildingId,
          MONTAGE_BLOCK_COUNT,
          MONTAGE_STAGGER_MS,
          () => {
            setTimeout(() => {
              cityRef.current?.addBlock(category);
              setState({ phase: "placed", block: res.block });
            }, MONTAGE_FINAL_BLOCK_DELAY_MS);
          }
        );
      })
      .catch((err) => {
        const message =
          err instanceof ApiError
            ? {
                unknown_school: "That school isn't recognized.",
                category_complete: "This category is already complete!",
                block_already_placed: "This block was already placed.",
                invalid_or_expired_code: "That code is invalid or has expired.",
              }[err.code] ?? "Something went wrong — try again."
            : "Something went wrong — try again.";
        setState({ phase: "needs_school", code, category, error: message });
      });
  }

  const showsModal = state.phase === "entry" || state.phase === "needs_school";

  return (
    <div className="relative min-h-screen w-screen overflow-hidden bg-background">
      {cityData && (
        <City ref={cityRef} initialBuildings={cityData.buildings} initialQueue={cityData.queue} style={{ position: "absolute", inset: 0 }} />
      )}

      {state.phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      )}

      {state.phase === "load_error" && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Couldn't load the city</CardTitle>
              <CardDescription>Try refreshing the page.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {showsModal && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/40 p-4 backdrop-blur-sm">
          {state.phase === "entry" && <EntryStep error={state.error} onSubmit={handleEnter} />}
          {state.phase === "needs_school" && (
            <SchoolStep
              category={state.category}
              error={state.error}
              onBack={() => setState({ phase: "entry" })}
              onConfirm={(schoolId) => handleConfirm(state.code, state.category, schoolId)}
            />
          )}
        </div>
      )}

      {(state.phase === "placed" || state.phase === "existing") && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
          <Card className="w-full max-w-lg bg-card/90 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="font-medium">
                  {state.phase === "placed" ? "Block placed!" : "Already placed"}
                </p>
                <ProgressBlock block={state.block} />
              </div>
              <Button
                onClick={() => {
                  cityRef.current?.resetCamera();
                  setState({ phase: "entry" });
                }}
              >
                Scan next block
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
