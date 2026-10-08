# 3D town models: design

Status: draft for review. Date: 2026-10-08.

## Goal

The 3D world should look like a small town instead of a bar chart. Every household is a house, every firm is a building whose type shows its industry, and Government is a civic building. Today's data view (cash pillars, market territories) stays available as an overlay over the town, switched on and off from the map tools.

The day-0 intro card is removed at the same time. Its content already appears elsewhere or moves to a better place.

This is a presentation change only. No simulation behaviour changes, and nothing under `src/sim/` is modified.

### Success criteria

- The app opens on a town of procedural low-poly buildings, with no intro card and the overlay off.
- Houses show the household's wealth in four discrete tiers. Firm buildings show their industry by shape and their firm slot by accent colour.
- One switch adds today's territory tiles and household cash pillars over the town, with the same heights and colours as today.
- Picking, hover tooltips, the inspector, relationship lines, Locate and the panel view inset all keep working.
- `scripts/validate-fast-mode.mjs` and `npm run agent:check` pass.

### Out of scope

- Animation (smoke, moving vehicles), day and night, and textures.
- Instanced rendering. About 110 meshes do not need it, and it can come later behind the same `syncEntities` interface.
- A react-three-fiber rewrite, and typing the `any` fields in `Runtime`.
- glTF or other external model assets.

## Current state

- `src/ui/world/scene.ts` draws every entity as a `BoxGeometry` scaled vertically to `WorldEntity.height`: household pillars sized by cash, and fixed-height blocks for firms (2.4), Transport (2.8) and Government (3.2).
- Territory tiles are always drawn for the focused industry. Relationship lines start and end at `position.y * 2 + 0.25`, the top of each box.
- `WorldFocus` (in `src/ui/shell/navigation.ts`) holds `selectedId`, `industry`, `linkMode` and `measure`. `focusForPanel('government')` sets `measure: 'after'`.
- `IntroCard` in `src/ui/shell/Hud.tsx` floats over the world on day 0 with a headline, an explanation and a "Run the economy" button.
- The live economy has 100 households, eight consumer firms (two in each of four industries), Transport and Government on a 20×20 grid.

## Approach

Each entity is one `Mesh`. Its geometry is shared by everything of the same building type, and its material is its own.

A new module builds each building type once from boxes, cylinders and cones, merges the parts into a single `BufferGeometry` with vertex colours, and caches it. `syncEntities` keeps its current shape: picking still reads `userData.entityId`, highlighting still uses `emissive`, and a household that changes wealth tier swaps its geometry reference.

Alternatives considered:

- **Instanced meshes per building type.** Rejected. It scales to thousands of entities, but picking moves to `instanceId`, per-entity glow needs a separate highlight mesh, and tier changes move entities between instance pools. That is too much complexity for about 110 entities.
- **A `Group` of primitive meshes per entity.** Rejected. It means 5–15 meshes per building and over 1,000 draw calls, picking has to walk up from child meshes, and shadows get expensive. Merging is cheap and avoids all three.
- **glTF asset packs.** Rejected in favour of procedural geometry: no asset files, no licensing, and full control over tinting and wealth tiers.

## The town

### Houses

Households are houses in four tiers. The tier is set by the cash figure the current measure selects (before or after Government's tax and transfers), relative to the $50 every household starts with:

| Tier | Building | Cash relative to the start |
| --- | --- | --- |
| 0 | Shack | below 50% |
| 1 | Cottage | 50% up to 110% |
| 2 | Two-storey house | 110% up to 200% |
| 3 | Villa | 200% and above |

Each lower bound is inclusive. Zero and negative cash give tier 0. Discrete tiers keep the town readable; the overlay pillars show exact cash. Houses use the household palette colour (`palette.household`) for walls and darker roofs, and have no accent colour.

### Firms

Each industry has its own building:

| Industry | Building |
| --- | --- |
| Food | Market hall with an awning |
| Utilities | Plant with a chimney and a tank |
| Healthcare | Clinic with a cross on the roof |
| Entertainment | Cinema with a marquee |
| Transport | Depot with a garage door and a bus on the forecourt |

Walls are neutral. The accent (roof, awning, marquee or cross) takes the firm's slot colour, Firm A cyan and Firm B orange, through `firmColor`. Firms outside the focused industry get a grey accent, as their pillars are dimmed today. Transport's accent is its existing neutral grey.

### Government

A civic building with columns and a dome. Its accent is `palette.government`.

### Footprints and ground

- Firm and Government buildings fit a 0.8 × 0.8 tile footprint, houses a 0.5 × 0.5 footprint. Every building sits on the ground at y = 0, so neighbours never overlap.
- Each building geometry includes a thin base slab that anchors it on the dark ground.
- The ground plane and grid are unchanged.

### Selection

Selected and related buildings glow and scale up exactly as today: emissive in the accent colour, and a scale of 1.25 for the selection and 1.15 for related entities. The scale now applies to all three axes from the ground, since height no longer encodes data.

## The data overlay

### Toggle

`WorldFocus` gains `overlay: boolean`, which is false in `INITIAL_FOCUS`. The map tools' legend bar gets a "Data overlay" switch.

### When the overlay is on

- **Territory tiles** draw on the ground exactly as today, under the buildings' base slabs.
- **Cash pillars** draw for households only. Each is today's pillar: the same `householdWealthHeight` and the same measure, in the household colour. They are translucent (opacity about 0.55, with `depthWrite` off) and slightly wider than the house (0.56) so they wrap it. Pillars carry `userData.entityId` and can be picked.
- **The firm legend** (slot swatches, prices and tile counts) shows.

Firm and Government pillars are dropped, because their heights were fixed and carried no data.

### When the overlay is off

The territory tiles, pillars and firm legend are hidden. The town alone is shown.

### Always

- **The cash measure control** stays visible, because the measure also sets house tiers. It is relabelled "Cash shown", with the options "Before tax" and "After tax".
- **Relationship lines** (purchases, jobs, transfers) draw whenever something is selected, because they explain the selection. A line ends at the top of the entity's pillar when one is drawn, and otherwise at the building's rooftop (`userData.top`).

### Panels

`focusForPanel('government')` sets `measure: 'after'` and `overlay: true`, because redistribution is only readable as pillar heights. No other panel changes `overlay`. Like every panel focus, it is applied once, and the user can switch the overlay off again.

## The intro card

`IntroCard` is removed:

| Content | Where it goes |
| --- | --- |
| "100 households, 9 firms and a government share a fixed $5,000" | The HUD status chip, which already shows the households and the money, also shows the firm count: "Seed … · 100 households · 9 firms · $5,000 in circulation". The count comes from `state.firms.length`. |
| "Run the economy" | Dropped; the top bar's Run button does the same. |
| The explanation ("Firms learn their prices…") | A lead paragraph at the top of the Overview panel, where it stays reachable after day 0. |

The `.intro--start`, `.intro-title`, `.intro-cta` and `.intro-card` CSS rules, the narrow-screen `.intro--start` rule, and the intro-card mention in `MapTools`' comment are removed. `.intro` and `.intro--plain` stay, because Experiments and Ensembles use them.

## Technical design

### Modules

**`src/ui/world/buildings.ts`** is new. Apart from Three.js it is pure.

- `buildingArchetype(entity: WorldEntity): ArchetypeId`. The IDs are `house-0` to `house-3`, `food`, `utilities`, `healthcare`, `entertainment`, `transport` and `government`.
- `createBuildingKit(THREE)` returns `{ geometry(id), material(), dispose() }`.
  - `geometry(id)` builds the building type on first use from primitives, merges the parts with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`, and caches the result. Each geometry has a `color` attribute (vertex colours for walls, roof, windows and the base) and an `accent` attribute (1 on accent vertices, 0 elsewhere), and sets `userData.top` to its height.
  - `material()` returns a new `MeshStandardMaterial` with `vertexColors: true` and a `uAccent` uniform. An `onBeforeCompile` hook mixes `uAccent` into the diffuse colour wherever `accent` is 1. It stays one material per entity with no textures. All instances share one shader program through `customProgramCacheKey`.
  - `dispose()` disposes every cached geometry and clears the cache.

**`src/ui/world/scene.ts`** changes:

- `Runtime` gains `kit`, `pillars: Map<string, Mesh>` and `overlay: boolean`.
- `syncEntities` creates each mesh from `kit.geometry(buildingArchetype(descriptor))` and `kit.material()`. On every sync it:
  - swaps the geometry when the type changes, which happens when a house changes tier;
  - sets the position at ground level, the accent uniform, the emissive glow and the uniform scale;
  - stores the rooftop height times the scale in `userData.top`.
- `syncPillars(runtime, state, view, related)` is new. While `view.overlay` is on, it keeps one translucent pillar per household, highlighted by the same rules as buildings. While it is off, it removes and disposes them all.
- `syncTerritory` takes the overlay flag. When the overlay is off it clears the tiles and resets `territoryKey`.
- `syncLinks` takes each endpoint height from the household's pillar when one exists, and otherwise from `userData.top`. The overlay state is part of the link cache key.
- Picking raycasts against buildings and pillars.
- `disposeRuntime` also disposes the pillars and the kit. Building meshes dispose only their own material, never the shared geometry.

**`src/ui/worldViewModel.ts`:** `WorldEntity` gains `tier?: HouseTier`. It is set for households from the same measure as `height`, and left unset for firms and Government. `height` keeps its meaning, the household pillar height, so `householdWealthHeight` is unchanged. It also exports `houseTier(cashCents, startingCashCents): HouseTier`, which returns 0–3 using the table in [Houses](#houses). It lives here rather than in `buildings.ts`, so the view model never imports Three.js.

**`src/ui/shell/navigation.ts`:** `WorldFocus.overlay`, `INITIAL_FOCUS.overlay = false`, and the Government rule in [Panels](#panels).

**`src/ui/world/WorldStage.tsx`:** passes `overlay` into `SceneView`, calls `syncPillars`, and depends on `overlay` in the sync effect.

**`src/ui/world/MapTools.tsx`:** adds the "Data overlay" switch, relabels the measure control, and shows the firm legend only while the overlay is on.

**`src/ui/shell/Hud.tsx`, `src/App.tsx`, `src/ui/views/OverviewView.tsx` and `src/styles/app.css`:** the changes in [The intro card](#the-intro-card), plus styles for the switch.

**`README.md`:** describes the town and the overlay instead of pillars. `docs/images/overview.png` is refreshed if it can be recaptured the same way; otherwise the change notes that it is stale.

### Data flow

1. `App` holds the world focus, including `overlay`.
2. The map tools' switch, or opening Government, updates `overlay`.
3. `WorldStage` syncs the ground, the territory (only with the overlay on), the buildings, the pillars (only with the overlay on) and the links.
4. Picking a building or a pillar selects its entity through the existing `focusForSelection`.

### Performance

- About 110 meshes, 10 cached geometries and one shader program.
- The render-only-when-changed loop, the device pixel ratio cap and the 1024 shadow map are unchanged.
- Buildings cast and receive shadows. Pillars do neither, so the overlay does not darken the town.
- Geometry is built once per building type, never per day.

### Accessibility

The overlay switch is a native button with `aria-pressed` and a visible label. The canvas's `aria-label` changes from pillars to buildings, and keeps its keyboard instructions.

### Failure handling

Unchanged. If Three.js or WebGL fails to load, the stage shows today's error and the Overview panel opens.

## Testing

### Unit tests (vitest)

Three.js geometry runs in Node without WebGL, so the kit is tested directly.

`buildings.test.ts` (new):

- `buildingArchetype` covers every industry, every tier and Government. Transport maps to the depot.
- For every building type, the geometry:
  - sits on the ground: `boundingBox.min.y` is 0 within a small tolerance;
  - fits its footprint: at most 0.8 in x and z for firms and Government, and 0.5 for houses;
  - is no taller than 3.5;
  - has `position`, `normal`, `color` and `accent` attributes;
  - has accent vertices for firms and Government, and none for houses.
- `geometry(id)` returns the same instance twice. After `dispose()`, it returns a new instance.

`worldViewModel.test.ts`:

- `houseTier` at each boundary: just under and exactly 50%, 110% and 200% of starting cash. Zero and negative cash give tier 0.
- Households carry the expected `tier` under both measures.
- Firms and Government carry no tier.
- Existing heights are unchanged.

`navigation.test.ts`:

- `INITIAL_FOCUS` includes `overlay: false`.
- `focusForPanel('government')` gives `measure: 'after'` and `overlay: true`.
- No other panel changes `overlay`.
- No panel changes the selection or the industry.

The existing tests stay unchanged apart from the `INITIAL_FOCUS` and Government focus expectations above.

### Behaviour preservation

- `git diff --stat` shows no changes under `src/sim/`. The canonical-trajectory and money-conservation tests pass.
- `scripts/validate-fast-mode.mjs` still finds "100 households" in `.scenario-summary`.

### Checking it in the real app

Run the dev server and use the browser to check:

- The town renders on load with no intro card.
- The overlay switch shows and hides the territories, pillars and firm legend.
- Clicking a house, a firm or a pillar selects it, and hovering shows the tooltip.
- Purchase, job and transfer lines land on rooftops, and on pillar tops while the overlay is on.
- Locate flies the camera to the entity.
- Opening Government switches the overlay on.
- The layout works at 375px wide.
- The console shows no errors.
