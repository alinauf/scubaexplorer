# AGENTS.md

Guidance for AI coding agents working on Scuba Explorer, a browser-based 3D underwater explorer set in the Maldives. Live at https://alinauf.github.io/scubaexplorer/ (GitHub Pages).

## Project layout

No build step, no package.json, no dependencies to install. Three files make up the game:

| File | What it holds |
| --- | --- |
| `index.html` | All markup and CSS: HUD, overlays (fish guide, photo log, research station, settings, gear viewer, touch controls). Loads `data.js` then `game.js` as classic scripts. |
| `data.js` | `REEF_DATA` — the Maldives blurb, dive `sites` and every `species`. Pure data; also exported via `module.exports` for Node. |
| `game.js` | The whole game in one async IIFE: three.js scene, terrain, procedural creature meshes, diver, camera/photography, sound, research station, badges, goals, input, touch. |
| `check.js` | Sanity check for `data.js`. |

`game.js` is split into sections marked `// ---------- name ----------` (helpers, terrain, renderer, body builders, textures, creatures, currents, diver, main loop, HUD, fact card, fish guide, underwater camera, sound, photo log, research station, goals, input, gear viewer, touch controls, site picker). Search those markers to find your way around rather than reading the file top to bottom.

## Running and testing

- Open `index.html` directly (it works from `file://`) or serve the folder, e.g. `python3 -m http.server`.
- three.js is loaded at runtime from `https://cdn.jsdelivr.net/npm/three@0.170.0` (ESM), so the page needs network access.
- After any change to `data.js`, run `node check.js`. It must print `ok: …`. It checks species types, habitats, depth ranges, regions, IUCN codes, moods, abundance and site references.
- To exercise the game headlessly, Playwright with the preinstalled Chromium works. `window.scuba` is a debug handle exposing `step(n, dt)`, `setCam`, `startDive`, `summon`, `diver`, `live()`, `SP`, `fps()` and more. Use it to advance frames and take screenshots without keyboard input.
- There is no test suite or linter beyond `check.js`. Before committing JS changes, at least run `node --check game.js` and load the page to confirm there are no console errors.

## Code conventions

- Plain modern JavaScript, no frameworks, no modules. `game.js` must stay loadable as a classic script (three.js is pulled in with a dynamic `import()`).
- Dense, compact style: short helper names (`$`, `lerp`, `clamp`, `smooth`, `mix`, `rng`, `hash`), arrow functions, one-line objects. Match the surrounding density rather than expanding code.
- Everything is procedural. Creature bodies, textures, terrain and all sound (Web Audio synthesis) are generated in code. There are no image or audio asset files, so don't add any.
- Keep randomness deterministic where it already is (seeded `rng`, `hash`, `h2`, `vnoise`) so reefs and creatures look the same on every visit.
- Persistence is `localStorage` only, through the `store` helper, under the keys `scuba-settings` and `scuba-progress`. Add new saved fields with defaults in the `Object.assign` calls so old saves keep working.
- Touch and phone support matter. New controls need a touch equivalent (see the touch controls section and `#touch` in `index.html`), and new overlays must be closable with `Esc` and a visible close button.

## Adding content

**Species** (`data.js`, `species` array). Required fields are `id`, `name`, `sci`, `type`, `hab` (`pelagic` | `reef` | `benthic`), `depth: [min, max]` in metres, `size` in metres, `iucn`, `regions`, `c` (colours), `fact`, and either `ab` (abundance) or `host`. Optional fields: `typ` (typical depth, must sit inside `depth`), `sizeTxt`, `f` (body-shape flags used by the builders), `pred`, `school: [min, max]`, `mood` (`curious` | `puff` | `hide`), `lift`, `glow`, `kind`, `tints`, `range` (required when `regions: 'world'`), `bait`. The comment block at the top of `data.js` explains the units and codes. `type` must be one of the types listed in `check.js`. A new type also needs a body builder in `game.js`.

**Sites** (`data.js`, `sites` array). Fields are `id`, `country`, `name`, `area`, `desc`, `current: [speed m/s, bearing]`, `target: { id, hint }` and `featured: { speciesId: weight }`. Every featured id must exist.

**Badges and photo challenges** live in `BADGES` and `GOALS` in `game.js`. A goal's `test(photo, creature)` receives the analysed photo (`subject`, `others`, `stars`, `night`, …) and the live creature.

## Accuracy

The game is educational and uses real dive sites and real species. Keep scientific names, depth ranges, sizes, IUCN status and distribution accurate, and write facts in plain, friendly British English (for example "colour", "metres"). Don't invent species or behaviours.

## Design decisions to respect

- Realistic mode (air, no-deco limits, safety stops) was deliberately removed. Don't reintroduce survival or air mechanics unless asked.
- Equipment changes automatically with depth (`GEAR`): recreational scuba to 40 m, trimix to 330 m, atmospheric diving suit to 700 m, the Alvin-style sub to 6,500 m, then a full-ocean-depth sub down to the trench floor (`FLOOR = 10935`).

## Git

- Commit messages use a short imperative subject line (e.g. "Add 360° gear viewer, minimizable dive info panel and README"), with a body explaining what changed and why when it isn't obvious.
- `main` is what GitHub Pages serves. Work on feature branches.
