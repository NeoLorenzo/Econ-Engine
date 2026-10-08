# 3D-first UI: design

Status: draft for review. Date: 2026-10-08.

## Goal

Opening Econ Engine should show the 3D simulation first. The world fills the screen and stays live. Markets, Households, Government, Overview and Experiments remain fully explorable, as panels over the world rather than separate pages.

This is a presentation change only. No simulation behaviour changes, and nothing under `src/sim/` is modified.

### Success criteria

- With no URL hash, the app loads straight into a full-screen 3D world with a stats HUD and the run controls. No panel is open.
- Every current tab is reachable and shows the same information it shows today.
- The world stays visible and interactive while a docked panel is open.
- Opening a panel sets a sensible world focus, and "Locate" from a panel selects the entity and flies the camera to it without closing the panel.
- The app works at 375px wide, using a bottom sheet instead of a docked panel.
- `scripts/validate-fast-mode.mjs` and `npm run agent:check` pass.

### Out of scope

- New 3D visuals for individual panels, such as animated tax flows or wealth-decile colouring.
- A react-three-fiber rewrite of the scene.
- Typing the Three.js runtime (the `any` fields in `Runtime` stay as they are).
- Removing the 2D `MarketMap` from Markets. It stays.

## Current state

- `src/ui/WorldView.tsx` (921 lines) holds a working Three.js scene: household pillars sized by cash, firm blocks, market territories, purchase and job links, picking, hover tooltips, search, a household/firm inspector and orbit/pan/zoom controls. It renders only when something has changed.
- The scene is a card inside `OverviewView`, below a row of four stat cards, beside "Where the money went today" and "What's happening".
- `App.tsx` renders exactly one tab at a time (`tab === 'overview' && …`), so the world, and its WebGL context, unmounts whenever the user leaves Overview.
- `industry` and `selectedId` are lifted into `App`. `linkMode` (purchases or jobs) and `measure` (cash before or after tax) are local to `WorldView`.
- "Show on map" in Markets and Households switches to Overview and scrolls to the card. Nothing moves the camera to an entity. The only camera action is a reset.
- Three.js is loaded at runtime from `https://cdn.jsdelivr.net/npm/three@0.180.0/+esm`.

## Approach

Lift the world into the application shell. `App` always renders one full-viewport `WorldStage` behind everything else. The top bar, HUD, map tools, inspector and a single panel container are overlays on top of it. The existing views become panel contents with few changes.

Alternatives considered:

- **react-three-fiber rewrite.** Rejected for now. It would rewrite about 900 lines of working imperative code and add dependencies, and none of that is needed to make the app 3D first.
- **Making the Overview card full-screen with CSS.** Rejected. The world would still unmount on every tab change, and it could not stay visible behind other content.

## Layout

### Always-mounted world

`WorldStage` is a fixed layer (`position: fixed; inset: 0`) that never unmounts. The scene, camera position and WebGL context survive every panel change. The canvas always fills the viewport and is never resized when a panel opens. Panels report their size as an inset instead (see [Camera](#camera)).

### Overlays

| Overlay | Position | Contents |
| --- | --- | --- |
| Top bar | Top, translucent | Brand, the five section buttons, and today's run/pause, step, speed, restart and settings controls, unchanged |
| HUD | Top left, under the bar | Four compact stat chips (needs met, inequality, wealth tax, wages paid) with sparklines, plus a status chip carrying the scenario summary (`.scenario-summary`) and the money-conserved indicator, which replaces today's footer |
| Map tools | Over the world | Search, industry picker, purchases/jobs links, before/after-tax height, legend and reset camera |
| Inspector | Floating card, bottom left | Today's household and firm inspectors |
| Day-0 intro | Floating card over the world | Today's intro text and "Run the economy" button, shown only on day 0 |

### Panels

Panels open over the world:

- **Docked panel** for Overview, Markets, Households and Government: right side, `min(560px, 42vw)` wide, scrolling on its own.
- **Wide sheet** for Experiments: `min(1100px, 92vw)` wide, because its tables and charts need the room.
- **Bottom sheet** for every panel below 860px wide: about 60% of the viewport tall. The HUD collapses to a single row that scrolls sideways.

A panel closes with Esc, its close button, or by clicking its section button again. Closing returns to the plain world.

The Overview panel holds what remains of today's Overview page once the stat row moves to the HUD and the map card moves to the stage: "Where the money went today", "What's happening", the full event log and "Markets at a glance". The "All markets" button and the market rows open the Markets panel.

Panel contents keep their information. Layouts that assume full page width, mainly the Markets and Households grids, are adjusted to fit a 560px panel.

### URL hash

- An empty or unrecognised hash shows the world with no panel.
- `#overview`, `#markets`, `#households`, `#government` and `#experiments` open that panel, so existing links keep working.
- Opening and closing panels updates the hash with `history.replaceState`, as navigation does today.

## World and panel synchronisation

### World focus

`linkMode` and `measure` move from `WorldView` into `App`. Together with `industry` and `selectedId` they form the world focus. `WorldStage`, the map tools and the panels all read and update this one piece of state. Nothing else drives the scene.

### Focus on opening a panel

Opening a panel applies a starting focus once. It is not a lock: if the user changes a map tool afterwards, the change holds until another panel is opened.

| Panel | Focus applied on open |
| --- | --- |
| Overview | None |
| Markets | `linkMode = 'purchases'`. Territories already follow the shared `industry`, and changing the industry in the panel updates the world live |
| Households | `linkMode = 'purchases'` |
| Government | `measure = 'after'`, so pillar heights show the effect of redistribution |
| Experiments | None. Experiments run on separate seeds in a worker and do not relate to the live world |

`focusForPanel` never changes `selectedId` or `industry`.

### Locate

"Show on map" becomes "Locate" on household rows, firm cards and firms clicked in the 2D market map. Locate selects the entity and flies the camera to it. The panel stays open. As today, locating a firm outside the transport industry also sets `industry` to that firm's industry.

### Selecting in the world

Clicking an entity while a panel is open selects it and shows the floating inspector, as now. Clicking a firm in another industry switches `industry`, so an open Markets panel follows.

### Escape

With the canvas focused, Esc clears the selection, as today. Anywhere else, Esc closes the open panel.

## Camera

- **Fly-to.** The camera target eases to the entity over about 600 ms. The radius shrinks to a comfort distance of 30 units only if the camera is further out than that, and it never grows. For reference, the default view sits at 46 and the zoom limits are 14 and 95. With `prefers-reduced-motion: reduce`, the camera jumps straight to the target.
- **View inset.** While a panel is open, `camera.setViewOffset` shifts the projection so the camera target sits in the middle of the uncovered area. A docked panel gives a horizontal offset and a bottom sheet a vertical one. Reset camera respects the same offset.
- **Rendering.** The tween runs inside the existing render-only-when-changed loop, so an idle scene still costs nothing.

## Technical design

### Dependencies

- Add `three@0.180.0`, the version loaded from the CDN today, as a dependency, and `@types/three` as a dev dependency.
- Replace the CDN import with `import('three')`. It stays dynamic, so Vite puts Three.js in its own lazy-loaded chunk and the shell paints before the world is ready.
- `THREE_MODULE_URL` and the runtime dependency on jsDelivr are removed.

### Modules

| File | Responsibility |
| --- | --- |
| `src/ui/world/scene.ts` | The imperative Three.js runtime moved from `WorldView.tsx`: create and dispose, `syncGround`, `syncEntities`, `syncTerritory`, `syncLinks` and pointer controls. New: `flyTo(position)` and `setViewInset({ right, bottom })` |
| `src/ui/world/cameraMath.ts` | Pure functions: easing and interpolation for the tween, the view offset from an inset, and the fly-to radius clamp |
| `src/ui/world/WorldStage.tsx` | Full-viewport canvas host. Owns the runtime lifecycle and loading/error states, and gives `App` a controller with `locate(id)` and `resetCamera()` |
| `src/ui/world/MapTools.tsx` | Search, industry picker, links, height switch and legend |
| `src/ui/world/Inspector.tsx` | `HouseholdInspector` and `FirmInspector`, moved as they are |
| `src/ui/shell/Panel.tsx` | One container with docked, wide and bottom-sheet layouts. Reports its size with a `ResizeObserver` |
| `src/ui/shell/Hud.tsx` | The stat chips and the status chip. Reuses `Stat` with a compact variant |
| `src/ui/shell/navigation.ts` | Pure functions: hash ↔ panel, and `focusForPanel(panel, focus)` |

Changes to existing files:

- `src/ui/WorldView.tsx` is removed once its contents have moved.
- `src/ui/worldViewModel.ts` is unchanged.
- `src/App.tsx` composes the shell, owns the world focus and the open panel, and passes the panel inset to `WorldStage`.
- `src/ui/views/OverviewView.tsx` loses its stat row and its world card, and becomes the Overview panel.
- `src/ui/views/MarketsView.tsx` and `src/ui/views/HouseholdsView.tsx`: `onShowOnMap` becomes `onLocate`, the button label becomes "Locate", and the grids are adjusted for panel width.
- `src/styles/app.css`: shell, HUD, panel and stage styles are added. The `.overview-grid` and world-card rules are removed. The file stays as the single stylesheet, as now.

### Data flow

1. `App` holds the simulation state, the world focus and the open panel.
2. Opening a panel sets the panel and applies `focusForPanel`.
3. `Panel` reports its inset, and `App` passes it to `WorldStage`, which calls `setViewInset`.
4. "Locate" in a panel calls the `WorldStage` controller, which updates the focus and calls `flyTo`.
5. Picking in the canvas updates `selectedId`, and `industry` too when the pick is a firm.

### Performance

- The existing caps stay: device pixel ratio at most 2, a 1024 shadow map, and frames drawn only when something changed.
- Scene syncing and drawing pause while the Experiments wide sheet covers the world or `document.visibilityState` is `hidden`. The latest state is applied when the world becomes visible again.
- If fast mode regresses (see [Testing](#testing)), the scene syncs at most once per animation frame, however many simulated days arrive in between. This is added only if measurement shows it is needed.

### Accessibility

- The section buttons stop being a `tablist`, because a tablist with nothing selected is invalid. They become buttons with `aria-expanded` and `aria-controls`, and keep left/right, Home and End keyboard navigation.
- The panel is a non-modal `<aside>` labelled by its heading. Opening a panel moves focus to its heading, and closing returns focus to the section button.
- The canvas keeps its current `aria-label` and keyboard controls.

### Failure handling

If the `three` import or WebGL initialisation fails, the stage shows today's error message and the Overview panel opens automatically, so all data stays reachable.

### Compatibility

`scripts/validate-fast-mode.mjs` finds elements by the `Speed`, `Run simulation` and `Pause` labels and the `.scenario-summary` and `.control-day` classes. All of these keep their names. `.scenario-summary` moves into the HUD status chip.

## Testing

### Unit tests (vitest)

`navigation.ts`:

- An empty or unknown hash gives no panel.
- Every panel ID round-trips through the hash, and `#overview` opens Overview.
- `focusForPanel` produces exactly the table in [Focus on opening a panel](#focus-on-opening-a-panel), and never changes `selectedId` or `industry`.

`cameraMath.ts`:

- Zero inset gives no view offset.
- With a right inset or a bottom inset, the target projects to the centre of the uncovered area.
- The tween returns the start exactly at t = 0 and the target exactly at t = 1.
- Reduced motion jumps straight to the target.
- Fly-to shrinks the radius only when it exceeds the comfort distance.

The existing tests stay unchanged and must pass, including `worldViewModel`, `appPresentation` and all the simulation suites.

### Behaviour preservation

`git diff --stat` shows no changes under `src/sim/`. The canonical-trajectory and money-conservation tests pass.

### Automated browser check

`scripts/validate-fast-mode.mjs` passes unchanged against `npm run preview`.

Risk: the check measures responsiveness at 100× speed, and a full-viewport WebGL canvas in headless Chromium costs more than today's card. Measure first, and add the once-per-frame sync limit only if the check regresses.

### Manual browser pass

Run at desktop width and at 375px:

1. Landing: the world shows with no panel open, the HUD is visible, and the day-0 intro card is visible.
2. Panels:
   - Each section button opens its panel.
   - Esc, the close button and clicking the active section all return to the world.
   - Hash deep links work.
   - Narrow screens use the bottom sheet.
3. Synchronisation:
   - Locate from a household row and from a firm card flies the camera, and the target ends up visible beside the panel.
   - Government switches heights to after tax.
   - Changing the industry in Markets updates the territories.
4. Running: at 100× with a panel open, the app stays responsive and the conservation chip stays green.
5. Fallbacks:
   - Forcing the `three` import to fail in development shows the error message and opens Overview.
   - With reduced motion on, the camera jumps instead of tweening.

### Final validation

`npm run agent:check` passes.

## Documentation

- Retake `docs/images/overview.png`, which the README uses as its showcase screenshot, from the new world-first landing view.
- Add a `CHANGELOG.md` entry.
