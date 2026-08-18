// Typed client for the QR scan / kiosk backend (server/src/routes). All paths are
// relative — the Vite dev proxy and same-origin production deploy both just work.

export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? "unknown_error", res.status);
  }
  return res.json();
}

export type ScanResponse = {
  code: string;
  expiresAt: string;
};

export function scanQr(token: string): Promise<ScanResponse> {
  return request<ScanResponse>(`/scan/${encodeURIComponent(token)}`, { method: "POST" });
}

export type BuildingCategory = "residential" | "hospital" | "food" | "school";

export type BlockInfo = {
  buildingId: string;
  buildingVariant: string;
  blockIndex: number;
  schoolId: number;
  placedAt: string;
  totalBlocks: number;
  completedBlocks: number;
  category: BuildingCategory;
};

export type EnterResponse =
  | { status: "existing"; block: BlockInfo }
  | { status: "needs_school"; category: BuildingCategory };

export function enterCode(code: string): Promise<EnterResponse> {
  return request<EnterResponse>("/enter", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export type PlaceBlockResponse = {
  status: "placed";
  block: BlockInfo;
};

export function placeBlock(code: string, schoolId: number): Promise<PlaceBlockResponse> {
  return request<PlaceBlockResponse>("/place-block", {
    method: "POST",
    body: JSON.stringify({ code, schoolId }),
  });
}

export type School = { id: number; name: string };

export function getSchools(): Promise<School[]> {
  return request<School[]>("/schools");
}

export type BuildingStatus = "queued" | "in_progress" | "completed";

export type BuildingState = {
  id: string;
  category: BuildingCategory;
  variant: string;
  /** 0-indexed within variant — combined with `variant` as `${variant}_${orderIndex}`,
   *  this is the stable key that matches src/data/cityLayout.ts's `buildingId`
   *  (generateCityLayout.ts's doc comment: "matches server/src/scripts/seed.ts's
   *  (variant, order_index) natural key"). Used to join real DB progress onto
   *  each building's real city position client-side — see Kiosk.tsx. */
  orderIndex: number;
  totalBlocks: number;
  completedBlocks: number;
  status: BuildingStatus;
};

export function getBuildings(): Promise<BuildingState[]> {
  return request<BuildingState[]>("/buildings");
}
