// The Cold War look: near-black landmass, deep navy sea, glowing cyan
// coastlines, dim internal borders, faint graticule. All layers are built on
// bundled Natural Earth data, so no tile server and no API key.
//
// Coastlines and borders are LineString sources (topojson mesh output), not
// stroked polygons: MapLibre clips polygons into internal tiles and stroking
// them draws the clip edges as seams across the map. Lines clip cleanly.

export const FACTION_COLOURS = {
  red: '#ff2f36',
  blue: '#39e6ff',
  tan: '#d9a648',
}

export const factionMatch = (fallback = '#ffffff') => [
  'match',
  ['get', 'faction'],
  'red', FACTION_COLOURS.red,
  'blue', FACTION_COLOURS.blue,
  'tan', FACTION_COLOURS.tan,
  fallback,
]

export function shadeFilter(shades) {
  return ['in', ['get', 'gid'], ['literal', shades.map((s) => s.gid)]]
}

export function shadeColour(shades) {
  if (shades.length === 0) return '#000000'
  return [
    'match', ['get', 'gid'],
    ...shades.flatMap((s) => [s.gid, FACTION_COLOURS[s.faction] ?? '#ffffff']),
    '#ffffff',
  ]
}

export function baseStyle() {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'sea',
        type: 'background',
        paint: { 'background-color': '#0a1730' },
      },
    ],
  }
}

export function graticuleGeoJSON(stepDeg = 10) {
  const features = []
  for (let lng = -180; lng <= 180; lng += stepDeg) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[lng, -80], [lng, 80]] },
    })
  }
  for (let lat = -80; lat <= 80; lat += stepDeg) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-180, lat], [180, lat]] },
    })
  }
  return { type: 'FeatureCollection', features }
}

const emptyFeatureCollection = { type: 'FeatureCollection', features: [] }

export function addBaseLayers(map, { countries, coast, borders, usStateBorders }) {
  map.addSource('graticule', { type: 'geojson', data: graticuleGeoJSON() })
  map.addSource('countries', { type: 'geojson', data: countries })
  map.addSource('coast', { type: 'geojson', data: coast })
  map.addSource('borders', { type: 'geojson', data: borders })
  map.addSource('us-state-borders', { type: 'geojson', data: usStateBorders })
  map.addSource('coldwar-divide', { type: 'geojson', data: emptyFeatureCollection })

  map.addLayer({
    id: 'graticule',
    type: 'line',
    source: 'graticule',
    paint: { 'line-color': '#16294a', 'line-width': 0.7, 'line-opacity': 0.6 },
  })
  map.addLayer({
    id: 'land',
    type: 'fill',
    source: 'countries',
    paint: { 'fill-color': '#05080d' },
  })
  map.addLayer({
    id: 'country-shade',
    type: 'fill',
    source: 'countries',
    filter: shadeFilter([]),
    paint: { 'fill-color': shadeColour([]), 'fill-opacity': 0.3 },
  })
  map.addLayer({
    id: 'country-shade-line',
    type: 'line',
    source: 'countries',
    filter: shadeFilter([]),
    paint: {
      'line-color': shadeColour([]),
      'line-width': 5,
      'line-blur': 5,
      'line-opacity': 0.5,
    },
  })
  map.addLayer({
    id: 'borders',
    type: 'line',
    source: 'borders',
    paint: {
      'line-color': '#1e3f63',
      'line-width': 1,
      'line-opacity': 0.9,
    },
  })
  // Finer and dimmer than country borders — secondary detail that shouldn't
  // compete with them at a glance.
  map.addLayer({
    id: 'us-state-borders',
    type: 'line',
    source: 'us-state-borders',
    paint: {
      'line-color': '#1e3f63',
      'line-width': 0.6,
      'line-opacity': 0.55,
    },
  })
  // The inner German border: not part of the shared borders mesh (Germany
  // has no such arc in modern data), so it's its own source, empty except in
  // Cold War mode.
  map.addLayer({
    id: 'coldwar-divide',
    type: 'line',
    source: 'coldwar-divide',
    paint: {
      'line-color': '#1e3f63',
      'line-width': 1,
      'line-opacity': 0.9,
    },
  })
  // Coastline glow: three strokes of the coast lines, wide and blurred
  // underneath, sharp and bright on top.
  map.addLayer({
    id: 'coast-glow-outer',
    type: 'line',
    source: 'coast',
    paint: { 'line-color': 'rgba(57,230,255,0.16)', 'line-width': 9, 'line-blur': 8 },
  })
  map.addLayer({
    id: 'coast-glow-mid',
    type: 'line',
    source: 'coast',
    paint: { 'line-color': 'rgba(57,230,255,0.35)', 'line-width': 4, 'line-blur': 3 },
  })
  map.addLayer({
    id: 'coast-core',
    type: 'line',
    source: 'coast',
    paint: { 'line-color': '#7deeff', 'line-width': 1.4 },
  })
}

// `eraData` is { modern: { countries, borders }, coldwar: { countries, borders, divide } }
export function applyEra(map, era, eraData) {
  const active = eraData[era]
  map.getSource('countries')?.setData(active.countries)
  map.getSource('borders')?.setData(active.borders)
  map.getSource('coldwar-divide')?.setData(active.divide ?? emptyFeatureCollection)
}

export function applyShades(map, shades) {
  if (!map.getLayer('country-shade')) return
  for (const layer of ['country-shade', 'country-shade-line']) {
    map.setFilter(layer, shadeFilter(shades))
    map.setPaintProperty(layer, layer.endsWith('line') ? 'line-color' : 'fill-color', shadeColour(shades))
  }
}

export function addScenarioLayers(map) {
  const empty = { type: 'FeatureCollection', features: [] }
  map.addSource('territories', { type: 'geojson', data: empty })
  map.addSource('arrow-shafts', { type: 'geojson', data: empty })
  map.addSource('arrow-heads', { type: 'geojson', data: empty })
  map.addSource('draft', { type: 'geojson', data: empty })
  map.addSource('draft-shafts', { type: 'geojson', data: empty })

  map.addLayer({
    id: 'territory-glow',
    type: 'line',
    source: 'territories',
    paint: {
      'line-color': factionMatch(),
      'line-width': 11,
      'line-blur': 9,
      'line-opacity': 0.55,
    },
  })
  map.addLayer({
    id: 'territory-fill',
    type: 'fill',
    source: 'territories',
    paint: { 'fill-color': factionMatch(), 'fill-opacity': 0.22 },
  })
  map.addLayer({
    id: 'territory-line',
    type: 'line',
    source: 'territories',
    paint: { 'line-color': factionMatch(), 'line-width': 2 },
  })

  // Shaft and head are both filled polygons now (the shaft tapers from full
  // width at the tail to a narrow neck at the head), so they get the same
  // glow/outline/fill treatment: a blurred stroke underneath, a crisp dark
  // stroke on top of that, then the solid faction-coloured fill.
  map.addLayer({
    id: 'arrow-shaft-glow',
    type: 'line',
    source: 'arrow-shafts',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': factionMatch(),
      'line-width': 9,
      'line-blur': 8,
      'line-opacity': 0.45,
    },
  })
  map.addLayer({
    id: 'arrow-head-glow',
    type: 'line',
    source: 'arrow-heads',
    paint: {
      'line-color': factionMatch(),
      'line-width': 8,
      'line-blur': 7,
      'line-opacity': 0.45,
    },
  })
  map.addLayer({
    id: 'arrow-shaft-outline',
    type: 'line',
    source: 'arrow-shafts',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#0a0d12', 'line-width': 2 },
  })
  map.addLayer({
    id: 'arrow-head-outline',
    type: 'line',
    source: 'arrow-heads',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#0a0d12', 'line-width': 3 },
  })
  map.addLayer({
    id: 'arrow-shaft',
    type: 'fill',
    source: 'arrow-shafts',
    paint: { 'fill-color': factionMatch() },
  })
  map.addLayer({
    id: 'arrow-head',
    type: 'fill',
    source: 'arrow-heads',
    paint: { 'fill-color': factionMatch() },
  })

  map.addLayer({
    id: 'draft-shaft',
    type: 'fill',
    source: 'draft-shafts',
    paint: { 'fill-color': factionMatch(), 'fill-opacity': 0.4 },
  })
  map.addLayer({
    id: 'draft-fill',
    type: 'fill',
    source: 'draft',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': factionMatch(), 'fill-opacity': 0.12 },
  })
  map.addLayer({
    id: 'draft-line',
    type: 'line',
    source: 'draft',
    filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'Polygon']],
    paint: {
      'line-color': factionMatch(),
      'line-width': 1.5,
      'line-dasharray': [2, 2],
    },
  })
  map.addLayer({
    id: 'draft-points',
    type: 'circle',
    source: 'draft',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'snap']]],
    paint: {
      'circle-radius': 3.5,
      'circle-color': factionMatch(),
      'circle-stroke-color': '#05080d',
      'circle-stroke-width': 1,
    },
  })
  map.addLayer({
    id: 'draft-snap',
    type: 'circle',
    source: 'draft',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['has', 'snap']],
    paint: {
      'circle-radius': 9,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  })
}
