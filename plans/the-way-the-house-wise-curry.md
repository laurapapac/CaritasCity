# Plan: Build house bottom-up

## Context

The blueprint JSON (`src/imports/house-blueprint.json`) stores voxels grouped by material type and building section — door frames first, then stone foundation, then interior wood, then brick walls, etc. Because `parseBlueprint()` passes the array straight through with no reordering, `completedBlocks` advances through those groups in that arbitrary order: door → windows → walls → roof.

The user wants the house to grow from the ground up, like a real building being constructed layer by layer.

## Root cause

`parseBlueprint()` in `src/app/App.tsx` does not sort blocks before returning them. Every downstream consumer — `BuildingRenderer.rebuild()`, `BuildingRenderer.addBlock()`, the `computeUpTo` index tables — operates on whatever order the array arrives in. Sorting the array at the source fixes the entire reveal chain with a single change.

## Change

**File:** `src/app/App.tsx` — `parseBlueprint()` function

After the `.map()` that centres coordinates, add a `.sort()`:

```ts
.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z)
```

- **Primary key `y` ascending** — each full layer is completed before the next starts.
- **Secondary keys `x`, then `z` ascending** — within each layer blocks sweep left-to-right, front-to-back, giving a natural bricklaying rhythm instead of a visually random scatter.

Full updated function:

```ts
function parseBlueprint(): Building {
  const blocks = (
    blueprintData.voxels as Array<{
      x: number; y: number; z: number; type: string; color: string
    }>
  ).map((v) => ({
    x: v.x - 7,
    y: v.y,
    z: v.z - 3.5,
    type: v.type,
    color: v.color,
  }))
  .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z)

  return { totalBlocks: blocks.length, completedBlocks: 0, blocks }
}
```

No other files need to change. `BuildingRenderer.tsx`, `computeUpTo`, `rebuild`, and `addBlock` all work on array order — they automatically get the sorted order.

## Verification

1. Open the preview and press **▶ Auto Build** at any speed.
2. Confirm the foundation (y = 0, stone floor) appears first across the entire ground level.
3. Confirm walls grow upward layer by layer.
4. Confirm the roof tiles appear last.
5. Confirm the yellow highlight still fires correctly on each new block and fades after 2 s.
6. Confirm **↺ Reset** followed by a fresh auto-build reproduces the same bottom-up order.
