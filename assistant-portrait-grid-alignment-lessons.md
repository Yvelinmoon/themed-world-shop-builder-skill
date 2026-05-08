# Assistant Portrait Grid Alignment Lessons

## Problem

The assistant portrait pipeline (`generateAssistantPortraitAsset` in `local-asset-pipeline.mjs`) was calling `remove_background` on the whole 2×2 sheet before splitting it into 4 individual portrait tiles. This destroyed grid alignment and produced visually broken portrait tiles that still passed QA.

### How it happened

1. **Neta `make_image`** generates a raw 2×2 portrait sheet at 2752×1536 with solid white background. The 4 portraits sit in clean grid quadrants (1376×768 each).

2. **`remove_background`** strips the white background, but crops the whole sheet to its global alpha bounding box — producing a cutout at 2528×1429. This is NOT evenly divisible by 2 rows (1429/2 = 714.5). The 4 portraits are no longer at clean grid boundaries.

3. **`fitImageContainToCanvas`** proportionally resizes the cutout to 1592×900 and pads it onto a 1600×900 canvas at offset (4, 0). Portrait content starts at x=4 instead of x=0.

4. **`splitSheetToTiles`** splits the 1600×900 canvas at blind grid boundaries (800×450). The grid lines cut through portrait bodies instead of through the clean white-space borders between them.

5. **`trimPngToAlphaBounds`** auto-trims each tile to its alpha bounds, masking the misalignment — tiles look like they "worked" but one portrait may have a missing shoulder or part of another portrait's arm.

### Why QA didn't catch it

- `qa-static-shop.mjs` only checked: manifest exists, files exist, URLs resolve, no 1×1 empty files
- It did NOT check that portrait tile pixel area was reasonable (a 626×450 tile with only 36% fill was passing)
- It did NOT check that the normalized sheet's alpha offset was grid-aligned (offset=4 vs expected ≤2)
- It did NOT check that portrait tile aspect ratios were consistent (the clipped `smile` had a noticeably different ratio)
- The `trim` step hid the visual misalignment by cropping tiles to alpha bounds

## Fix

### Pipeline fix (local-asset-pipeline.mjs)

Changed `generateAssistantPortraitAsset` to:

1. Download the raw sheet (white background intact)
2. Still run Neta `remove_background` for build evidence, but do NOT use the cutout for the grid split
3. Normalize the raw sheet to 1600×900 (grid-aligned by definition — white background fills the full canvas)
4. Split the normalized raw sheet at 800×450 grid boundaries (perfect alignment guaranteed)
5. Per-tile: flood-fill white/near-white pixels to transparent alpha, then trim to alpha bounds

This is the same principle as the AGENTS.md rule: "Never crop first and remove background later." The assistant sheet was the one asset board that violated this rule.

Added `floodFillWhiteToAlpha()` function: iterates all pixels, sets alpha=0 for opaque pixels within tolerance of (255,255,255). This replaces sheet-level `remove_background` for portrait background removal while preserving grid alignment.

### QA fix (qa-static-shop.mjs)

Added three new checks:

1. **Portrait tile pixel area check**: Each portrait must have at least 30% of its grid cell's pixel area as opaque pixels. A clipped portrait from grid misalignment will fall below this threshold (the `smile` portrait had only 101,515 opaque pixels vs the 108,000 minimum for a 800×450 cell).

2. **Portrait tile aspect ratio consistency check**: All 4 portraits from the same sheet should have similar width/height ratios. If one portrait deviates more than 0.3 from the median ratio, it's likely clipped by grid misalignment.

3. **Assistant sheet alpha offset check**: If the normalized assistant sheet exists in the export or build artifacts, check that its alpha content starts within 2px of the grid origin (0,0). A sheet-level `remove_background` cutout produces offsets like +4px; the correct split-raw-first pipeline produces offset=0 because the raw sheet has perfect grid alignment.

### Export fix (export-static-shop.mjs)

Changed the exporter to always include the assistant portrait sheet (`assistant_sheet_2x2.png`) in the static export (not only as optional evidence). This ensures QA can access the sheet for alpha offset verification even in published static exports.

## Test evidence

Old (broken) ramen export QA results with the new checks:
- `portrait-tile-too-small`: smile portrait had 101,515 opaque pixels < 108,000 minimum → **FAIL**
- `assistant-sheet-alpha-offset-misaligned`: normalized sheet alpha starts at x=4, y=0 > maxAllowed=2 → **FAIL** (when sheet is accessible)

With the fixed pipeline, the normalized sheet will have alpha offset at (0,0) because the raw sheet (white background) is grid-aligned, and all portrait tiles will have sufficient pixel area and consistent aspect ratios.

## Prevention

- Any asset board that requires a fixed-grid split (2×2, 4×8, 1×5, 2×3) must NOT be `remove_background`'d before the grid split. The grid split must happen on the raw sheet or on a normalized raw sheet, and per-tile background removal must happen after.
- QA must check not just "file exists and is non-empty" but also "file has plausible pixel content for a complete asset" and "the normalized sheet is grid-aligned before splitting."
- `trimPngToAlphaBounds` after grid split can mask misalignment; QA must look at the sheet-level alpha offset, not just the trimmed tile sizes.