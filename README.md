# Sitmap

A map editor for drawing Cold War briefing maps in the style of World in Conflict and Red Storm Rising.

![Interception over the Norwegian Sea](docs/screenshots/norway-intercept.png)

## Motivation

If you've played World in Conflict, you'll remember the mission briefing screens: a glowing tactical map, arrows sweeping across Europe, little red and
blue unit icons creeping towards each other, all lit up like a NORAD display in a Cold War thriller. 

It told you everything about the battle ahead without a single line of dialogue.

I really loved the aesthetic of this and wanted the ability to make my own maps like this.

So letting Claude loose with some screenshots and some interpretative guidance we have quite a fun little project.

## Features

Sitmap lets you illustrate a strategic map with BLUFOR (NATO) and OPFOR (Russia/China/PACT) units and other drawing tools.

You can then export those drawings as PNG images or save them for another time.

![An assault forming up near Murmansk](docs/screenshots/murmansk-assault.png)

![The Soviets have captured the UK and are pushing their assault on the North Sea and Channel](docs/screenshots/soviet-naval-capture-uk.png)

## Local Development

This uses plain old Javascript with Vue.js and Vite. 

```bash
npm install
npm run dev
```

Then open the printed local URL. 

`npm test` runs the geometry unit tests.

`npm run build` produces a static bundle in `dist/`.

### Adding new units

You can modify [units.js](src/lib/units.js)

Unit icons should ideally be SVG and dimensions of 700x700px, they are scaled down in the map to 50px
but increase in size as you zoom closer to the map.

## The tools

- **TERRITORY**: click out a rough polygon; on finish the edge is roughened
  into the jagged "radar contour" look and filled with the faction colour.
  When the cursor nears the start point a snap ring appears; click it to close.
- **SHADE**: click a country to flood it with the faction colour; click again
  with the same faction to unshade.
- **ARROW**: click a path; it renders as a tapered wedge (full width at the
  tail, narrowing towards a sharp barbed head) so it reads as motion towards a
  position rather than a bar with an arrowhead stuck on the end.
- **UNIT**: generic silhouettes (APC, rifleman, F-16, MiG-23, bomber, stealth
  bomber, transport, attack helicopter, generic ship/sub, battle burst) plus
  faction-locked real-world hulls — M1 Abrams, Arleigh Burke, Nimitz, Los
  Angeles-class and Type 23 Frigate for NATO only; T-80, Slava, Sovremenny,
  Grisha, Delta IV/Typhoon and Akula for PACT only.
- **LABEL**: click to drop a city-style dot with a name.
- **ERASE**: click anything (including a shaded country) to remove it.

Click a placed unit (in any tool) to select it — it gets a dashed outline —
then: hold **R** and drag, or tap **[ / ]**, to rotate; scroll the mouse wheel
over it, or press **- / =**, to scale; **F** flips it horizontally; **Delete**
or **Backspace** removes it; **Esc** deselects.

Finish a territory or arrow with double-click, right-click or Enter; Esc
cancels. Factions: PACT (red), NATO (cyan), ALLIED (tan).

**ERA** switches the whole map between the modern day and a hand-traced 1980s
Cold War political boundary (the USSR, Czechoslovakia, Yugoslavia and a split
Germany all rebuilt from today's country data). **COUNTRY NAMES** and
**STRATEGIC BASES** are toggleable overlays; US state borders are always on.
Major cities fade in by zoom level: capitals first, then major cities, then
regional ones.

**EXPORT PNG** composites the map, all markers, scanlines and vignette into a
single image. **SAVE** / **LOAD** round-trip the scenario as JSON. There's
also a looping background track, because it felt wrong not to have one.

## How the look is achieved

The base style is three line layers stroking Natural Earth coastlines: a wide
heavily blurred cyan underneath, a mid glow, and a sharp bright core on top.
Coastlines and borders are genuine LineStrings (topojson `mesh` output), not
stroked polygons; MapLibre clips polygons into internal tiles and stroking
them paints the clip edges as seams across the map. Land is near-black, sea
is deep navy, borders are dim. The CRT effect is a CSS overlay (repeating
scanline gradient plus a radial vignette) that never touches the WebGL canvas.

Detail is 1:50m Natural Earth, which suits theatre scale (continents down to
roughly regional zoom). For street-level drama, swap in 10m data or a vector
tile source; the drawing tools do not care where the basemap comes from.

Unit icons come from a few places. Standalone SVGs live in
`src/assets/military/` — some sourced from SVG Repo (check individual icon
licences there before publishing anything commercial), some hand-drawn
originals, and a handful of real vehicle/vessel silhouettes split out of a
single reference sheet. The rest are path data in `src/lib/icon-paths.js`,
extracted with `scripts/extract-icons.mjs` (install `react-icons` as a dev
dependency temporarily, run the script with `--emit`, remove it again).

Every icon, vector or bitmap, is tinted to the faction colour the same way:
rendered to an offscreen canvas, then recoloured with `source-in`
compositing. That is why SVGs wrapping embedded PNGs tint correctly despite
having no `fill` to override — the only requirement on a new icon file is a
transparent background. Drop a file in `src/assets/military/`, add one line
to `SOURCES` in `src/lib/units.js`, done.

## Licence

MIT 

## Sources 

Map data: Natural Earth and US Census Bureau boundaries (via `world-atlas` and
`us-atlas`), public domain. 

Icons: SVG Repo (per-icon licences), game-icons.net
(CC BY 3.0, by Lorc, Delapouite & contributors) and Font Awesome Free
(CC BY 4.0). 

Music: "Main Menu" from the World in Conflict soundtrack, by Ola
Strandh 