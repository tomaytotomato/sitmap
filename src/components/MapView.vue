<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { feature, mesh } from 'topojson-client'
import countries50 from 'world-atlas/countries-50m.json'
import usStates10m from 'us-atlas/states-10m.json'
import { scenario, ui, uid, removeFeature, toggleShade, removeShade, serialiseScenario, loadScenarioJSON, clearScenario } from '../store.js'
import { baseStyle, addBaseLayers, addScenarioLayers, applyShades, applyEra, FACTION_COLOURS } from '../lib/mapstyle.js'
import { buildArrow, jitterRing, unwrapGeometry, polygonLabelPoint } from '../lib/geometry.js'
import { buildColdWarCountries, blocKeyOf } from '../lib/coldwar.js'
import { iconDataURL, unitIconSize, UNIT_ICON_MAX_SIZE } from '../lib/units.js'
import { exportPNG } from '../lib/export.js'
import { CITIES, cityVisible, TIER_MIN_ZOOM } from '../data/cities.js'
import { BASES, baseVisible } from '../data/bases.js'

const SNAP_PX = 14

const container = ref(null)
let map = null
const markers = new Map() // feature id -> maplibregl.Marker
const cityElements = [] // { el, city }
const baseElements = [] // { el }
const countryLabelElements = [] // { el, marker }
const stateLabelElements = [] // { el }
const draft = { points: [], cursor: null, snapped: false }
let rotateKeyDown = false
let rotateDrag = null // { unit, startX, startRotation }
let eraData = null // { modern: { countries, borders }, coldwar: { countries, borders, divide } }

// US territories excluded from the states layer — this is a "states" map,
// not a full list of everything the topology happens to include.
const US_TERRITORIES = new Set([
  'American Samoa', 'Guam', 'Commonwealth of the Northern Mariana Islands',
  'Puerto Rico', 'United States Virgin Islands',
])

// State names fade in well past the country-label handoff, once there's
// enough screen space for them alongside city names.
const STATE_LABEL_MIN_ZOOM = 4

// Country names hand off to city names at the exact zoom tier-1 cities
// appear, so the two label sets never show together.
const COUNTRY_LABEL_MAX_ZOOM = TIER_MIN_ZOOM[1]

function territoriesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: scenario.territories.map((t) => ({
      type: 'Feature',
      properties: { id: t.id, faction: t.faction },
      geometry: { type: 'Polygon', coordinates: [t.ring] },
    })),
  }
}

function arrowsGeoJSON() {
  const shafts = []
  const heads = []
  for (const a of scenario.arrows) {
    const arrow = buildArrow(a.path)
    if (!arrow) continue
    const properties = { id: a.id, faction: a.faction }
    shafts.push({
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [arrow.shaft] },
    })
    heads.push({
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [arrow.head] },
    })
  }
  return {
    shafts: { type: 'FeatureCollection', features: shafts },
    heads: { type: 'FeatureCollection', features: heads },
  }
}

function draftGeoJSON() {
  const features = []
  const shafts = []
  const pts = draft.cursor ? [...draft.points, draft.cursor] : draft.points

  if (ui.tool === 'territory' && pts.length >= 3) {
    features.push({
      type: 'Feature',
      properties: { faction: ui.faction },
      geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] },
    })
  } else if (ui.tool === 'arrow' && pts.length >= 2) {
    const arrow = buildArrow(pts)
    if (arrow) {
      shafts.push({
        type: 'Feature',
        properties: { faction: ui.faction },
        geometry: { type: 'Polygon', coordinates: [arrow.shaft] },
      })
      features.push({
        type: 'Feature',
        properties: { faction: ui.faction },
        geometry: { type: 'Polygon', coordinates: [arrow.head] },
      })
    }
  } else if (pts.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { faction: ui.faction },
      geometry: { type: 'LineString', coordinates: pts },
    })
  }

  for (const p of draft.points) {
    features.push({
      type: 'Feature',
      properties: { faction: ui.faction },
      geometry: { type: 'Point', coordinates: p },
    })
  }
  if (draft.snapped && draft.points.length > 0) {
    features.push({
      type: 'Feature',
      properties: { faction: ui.faction, snap: true },
      geometry: { type: 'Point', coordinates: draft.points[0] },
    })
  }
  return {
    draft: { type: 'FeatureCollection', features },
    shafts: { type: 'FeatureCollection', features: shafts },
  }
}

function refreshSource(id, data) {
  const src = map?.getSource(id)
  if (src) src.setData(data)
}

function refreshArrows() {
  const { shafts, heads } = arrowsGeoJSON()
  refreshSource('arrow-shafts', shafts)
  refreshSource('arrow-heads', heads)
}

function refreshDraft() {
  const { draft: draftFC, shafts } = draftGeoJSON()
  refreshSource('draft', draftFC)
  refreshSource('draft-shafts', shafts)
}

function cancelDraft() {
  draft.points = []
  draft.cursor = null
  draft.snapped = false
  refreshDraft()
}

function finishDraft() {
  const pts = dedupeClicks(draft.points)
  if (ui.tool === 'territory' && pts.length >= 3) {
    const ring = jitterRing([...pts, pts[0]])
    if (ring) scenario.territories.push({ id: uid(), faction: ui.faction, ring })
  } else if (ui.tool === 'arrow' && pts.length >= 2) {
    scenario.arrows.push({ id: uid(), faction: ui.faction, path: pts })
  }
  cancelDraft()
}

// Double-click fires two click events first, so the final vertex arrives twice.
function dedupeClicks(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-7) out.push(p)
  }
  return out
}

function eraseAt(point) {
  const hits = map.queryRenderedFeatures(point, {
    layers: ['territory-fill', 'arrow-shaft', 'arrow-head', 'country-shade'],
  })
  if (hits.length === 0) return
  const hit = hits[0]
  if (hit.layer.id === 'country-shade') {
    removeShade(hit.properties.gid)
  } else {
    removeFeature(hit.properties.id)
  }
}

function shadeAt(point) {
  const hits = map.queryRenderedFeatures(point, { layers: ['land'] })
  if (hits.length === 0) return
  const { gid, name } = hits[0].properties
  toggleShade(gid, name, ui.faction)
}

// Flip is a mirror of the icon's own (unrotated) local space, so it's
// composed innermost — otherwise flipping a rotated unit would mirror it
// across the wrong axis instead of just facing it the other way.
function unitTransformString(unit) {
  const scale = unit.scale ?? 1
  const flipX = unit.flipped ? -1 : 1
  return `rotate(${unit.rotation ?? 0}deg) scale(${flipX * scale}, ${scale})`
}

function makeUnitElement(unit) {
  const el = document.createElement('div')
  el.className = 'unit-marker'
  const colour = unit.kind === 'battle' ? '#ffffff' : FACTION_COLOURS[unit.faction]
  const img = document.createElement('img')
  // Always rendered at the max display size and scaled down via width/height
  // below — downscaling stays crisp, and it means one cached bitmap covers
  // every zoom level instead of regenerating one per size.
  const size = unitIconSize(map.getZoom())
  img.width = size
  img.height = size
  img.style.transform = unitTransformString(unit)
  iconDataURL(unit.kind, colour, UNIT_ICON_MAX_SIZE).then((src) => {
    img.src = src
  })
  el.append(img)
  el.style.filter = `drop-shadow(0 0 5px ${colour})`
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    if (ui.tool === 'erase') {
      removeFeature(unit.id)
    } else {
      ui.selectedUnitId = unit.id
    }
  })
  // Only the already-selected unit responds to scroll — otherwise scrolling
  // over an unselected unit still zooms the map, as expected everywhere else.
  el.addEventListener(
    'wheel',
    (e) => {
      if (ui.selectedUnitId !== unit.id) return
      e.preventDefault()
      e.stopPropagation()
      unit.scale = clampScale((unit.scale ?? 1) + (e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP))
      applyUnitTransform(unit)
    },
    { passive: false },
  )
  return el
}

function makeLabelElement(label) {
  const el = document.createElement('div')
  el.className = 'label-marker'
  const dot = document.createElement('span')
  dot.className = 'label-dot'
  const text = document.createElement('span')
  text.className = 'label-text'
  text.textContent = label.text
  el.append(dot, text)
  el.addEventListener('click', (e) => {
    if (ui.tool === 'erase') {
      e.stopPropagation()
      removeFeature(label.id)
    }
  })
  return el
}

function syncMarkers() {
  const wanted = new Map()
  for (const u of scenario.units) wanted.set(u.id, { feature: u, make: makeUnitElement })
  for (const l of scenario.labels) wanted.set(l.id, { feature: l, make: makeLabelElement })

  for (const [id, marker] of markers) {
    if (!wanted.has(id)) {
      marker.remove()
      markers.delete(id)
    }
  }
  for (const [id, { feature: f, make }] of wanted) {
    if (markers.has(id)) {
      markers.get(id).setLngLat(f.lngLat)
      continue
    }
    const marker = new maplibregl.Marker({ element: make(f), draggable: true })
      .setLngLat(f.lngLat)
      .addTo(map)
    marker.on('dragend', () => {
      const { lng, lat } = marker.getLngLat()
      f.lngLat = [lng, lat]
    })
    markers.set(id, marker)
  }
}

function updateUnitIconSizes() {
  const size = unitIconSize(map.getZoom())
  for (const marker of markers.values()) {
    const el = marker.getElement()
    if (!el.classList.contains('unit-marker')) continue
    const img = el.querySelector('img')
    if (!img) continue
    img.width = size
    img.height = size
  }
}

function addCityMarkers() {
  for (const city of CITIES) {
    const el = document.createElement('div')
    el.className = `city-marker tier-${city.tier}`
    const dot = document.createElement('span')
    dot.className = 'city-dot'
    const name = document.createElement('span')
    name.className = 'city-name'
    name.textContent = city.name
    el.append(dot, name)
    new maplibregl.Marker({ element: el, anchor: 'left', offset: [-4, 0] })
      .setLngLat(city.lngLat)
      .addTo(map)
    cityElements.push({ el, city })
  }
  updateCityVisibility()
}

function updateCityVisibility() {
  const zoom = map.getZoom()
  for (const { el, city } of cityElements) {
    el.style.display = cityVisible(city, zoom) ? '' : 'none'
  }
}

function addBaseMarkers() {
  for (const base of BASES) {
    const el = document.createElement('div')
    el.className = 'base-marker'
    el.style.setProperty('--faction', FACTION_COLOURS[base.faction])
    el.title = base.role
    const mark = document.createElement('span')
    mark.className = 'base-mark'
    const name = document.createElement('span')
    name.className = 'base-name'
    name.textContent = base.name
    el.append(mark, name)
    new maplibregl.Marker({ element: el, anchor: 'left', offset: [-5, 0] })
      .setLngLat(base.lngLat)
      .addTo(map)
    baseElements.push({ el, base })
  }
  updateBaseVisibility()
}

function updateBaseVisibility() {
  for (const { el, base } of baseElements) {
    el.style.display = ui.showBases && baseVisible(base, ui.mapEra) ? '' : 'none'
  }
}

function clearCountryLabelMarkers() {
  for (const { marker } of countryLabelElements) marker.remove()
  countryLabelElements.length = 0
}

function addCountryLabelMarkers(countries) {
  clearCountryLabelMarkers()

  // Cold War mode has several countries sharing one gid (e.g. every Soviet
  // republic under "USSR"); label only the largest member of each group.
  const biggestByGid = new Map()
  for (const country of countries.features) {
    const anchor = polygonLabelPoint(country.geometry)
    if (!anchor) continue
    const gid = country.properties.gid
    const existing = biggestByGid.get(gid)
    if (!existing || anchor.area > existing.area) {
      biggestByGid.set(gid, { point: anchor.point, area: anchor.area, name: country.properties.name })
    }
  }

  for (const { point, name } of biggestByGid.values()) {
    const el = document.createElement('div')
    el.className = 'country-label-marker'
    el.textContent = name
    const marker = new maplibregl.Marker({ element: el }).setLngLat(point).addTo(map)
    countryLabelElements.push({ el, marker })
  }
  updateCountryLabelVisibility()
}

function updateCountryLabelVisibility() {
  const visible = ui.showCountryLabels && map.getZoom() < COUNTRY_LABEL_MAX_ZOOM
  for (const { el } of countryLabelElements) {
    el.style.display = visible ? '' : 'none'
  }
}

function addStateLabelMarkers(states) {
  for (const state of states.features) {
    const anchor = polygonLabelPoint(state.geometry)
    if (!anchor) continue
    const el = document.createElement('div')
    el.className = 'state-label-marker'
    el.textContent = state.properties.name
    new maplibregl.Marker({ element: el }).setLngLat(anchor.point).addTo(map)
    stateLabelElements.push({ el })
  }
  updateStateLabelVisibility()
}

function updateStateLabelVisibility() {
  const visible = map.getZoom() >= STATE_LABEL_MIN_ZOOM
  for (const { el } of stateLabelElements) {
    el.style.display = visible ? '' : 'none'
  }
}

function snapCheck(e) {
  draft.snapped = false
  if (ui.tool !== 'territory' || draft.points.length < 3) return
  const first = map.project(draft.points[0])
  if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < SNAP_PX) {
    draft.cursor = draft.points[0]
    draft.snapped = true
  }
}

function onClick(e) {
  const lngLat = [e.lngLat.lng, e.lngLat.lat]
  ui.selectedUnitId = null
  switch (ui.tool) {
    case 'territory':
      if (draft.snapped) {
        finishDraft()
        break
      }
      draft.points.push(lngLat)
      refreshDraft()
      break
    case 'arrow':
      draft.points.push(lngLat)
      refreshDraft()
      break
    case 'shade':
      shadeAt(e.point)
      break
    case 'unit':
      scenario.units.push({ id: uid(), faction: ui.faction, kind: ui.unitKind, lngLat, rotation: 0, scale: 1, flipped: false })
      break
    case 'label': {
      const text = window.prompt('Label text:')
      if (text) scenario.labels.push({ id: uid(), text: text.trim(), lngLat })
      break
    }
    case 'erase':
      eraseAt(e.point)
      break
  }
}

const ROTATE_STEP = 15 // degrees, for the discrete [ / ] fallback
const ROTATE_DRAG_SENSITIVITY = 0.6 // degrees per pixel of horizontal drag
const SCALE_STEP = 0.1
const SCALE_MIN = 0.5
const SCALE_MAX = 3

function clampScale(value) {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, +value.toFixed(2)))
}

function endRotateDrag() {
  if (!rotateDrag) return
  rotateDrag = null
  map.dragPan.enable()
}

function onKeyDown(e) {
  if (e.key === 'r' || e.key === 'R') rotateKeyDown = true

  if (e.key === 'Escape') {
    cancelDraft()
    ui.selectedUnitId = null
  }
  if (e.key === 'Enter' && draft.points.length > 0) finishDraft()

  if (!ui.selectedUnitId) return
  const unit = scenario.units.find((u) => u.id === ui.selectedUnitId)
  if (!unit) return

  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    removeFeature(unit.id)
  } else if (e.key === '[' || e.key === ']') {
    e.preventDefault()
    const step = e.key === ']' ? ROTATE_STEP : -ROTATE_STEP
    unit.rotation = (((unit.rotation ?? 0) + step) % 360 + 360) % 360
    applyUnitTransform(unit)
  } else if (e.key === '-' || e.key === '_' || e.key === '=' || e.key === '+') {
    e.preventDefault()
    const step = e.key === '-' || e.key === '_' ? -SCALE_STEP : SCALE_STEP
    unit.scale = clampScale((unit.scale ?? 1) + step)
    applyUnitTransform(unit)
  } else if (e.key === 'f' || e.key === 'F') {
    e.preventDefault()
    unit.flipped = !unit.flipped
    applyUnitTransform(unit)
  }
}

function onKeyUp(e) {
  if (e.key === 'r' || e.key === 'R') {
    rotateKeyDown = false
    endRotateDrag()
  }
}

// Held-key focus can go astray (alt-tab, devtools) without a keyup ever
// firing — drop the held state so rotate-drag can't get stuck armed.
function onWindowBlur() {
  rotateKeyDown = false
  endRotateDrag()
}

function applyUnitTransform(unit) {
  const img = markers.get(unit.id)?.getElement().querySelector('img')
  if (img) img.style.transform = unitTransformString(unit)
}

function updateUnitSelectionHighlight() {
  for (const [id, marker] of markers) {
    const el = marker.getElement()
    if (el.classList.contains('unit-marker')) el.classList.toggle('selected', id === ui.selectedUnitId)
  }
}

function updateCursor() {
  if (!map) return
  const drawing = ['territory', 'arrow', 'unit', 'label', 'shade'].includes(ui.tool)
  map.getCanvas().style.cursor = drawing ? 'crosshair' : ui.tool === 'erase' ? 'not-allowed' : ''
}

defineExpose({
  exportImage: () => exportPNG(map, scenario),
  saveScenario: () => {
    const blob = new Blob([serialiseScenario()], { type: 'application/json' })
    const link = document.createElement('a')
    link.download = 'sitmap-scenario.json'
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  },
  loadScenario: async (file) => {
    loadScenarioJSON(await file.text())
  },
  clearAll: () => {
    if (window.confirm('Clear the entire scenario?')) clearScenario()
  },
})

onMounted(() => {
  map = new maplibregl.Map({
    container: container.value,
    style: baseStyle(),
    center: [10, 55],
    zoom: 3.4,
    minZoom: 2.5,
    // v5 moved this out of the top-level options and under here; passed
    // flat it's silently ignored, the GL buffer clears after every frame,
    // and exportPNG's drawImage(glCanvas, ...) captures blank.
    canvasContextAttributes: { preserveDrawingBuffer: true },
    doubleClickZoom: false,
    // MapLibre's own keyboard handler binds -/=/+ to zoom in/out, which fired
    // alongside our own unit-scale shortcuts on the same keys — this app
    // repurposes the keyboard entirely for scenario editing.
    keyboard: false,
    attributionControl: false,
  })

  map.on('load', () => {
    // Antarctica (id 010) is dropped: its south-polar ring defeats planar
    // rendering, and it is demilitarised anyway.
    const ANTARCTICA = '010'
    const countries = feature(countries50, countries50.objects.countries)
    countries.features = countries.features.filter((f) => String(f.id) !== ANTARCTICA)
    for (const f of countries.features) {
      f.properties = { gid: String(f.id), name: f.properties.name }
      f.geometry = unwrapGeometry(f.geometry)
    }
    const coast = unwrapGeometry(
      mesh(countries50, countries50.objects.countries, (a, b) => a === b && String(a.id) !== ANTARCTICA),
    )
    const borders = unwrapGeometry(mesh(countries50, countries50.objects.countries, (a, b) => a !== b))

    // Cold War borders drop the seams between countries now grouped into
    // the same historical bloc (e.g. Russia/Ukraine both become "USSR").
    // Germany's inner border isn't part of this mesh at all — it comes from
    // the hand-traced divide line in coldwar.js instead.
    const coldWar = buildColdWarCountries(countries)
    const coldWarBorders = unwrapGeometry(
      mesh(countries50, countries50.objects.countries, (a, b) => blocKeyOf(a.properties?.name) !== blocKeyOf(b.properties?.name)),
    )
    eraData = {
      modern: { countries, borders },
      coldwar: { countries: coldWar.countries, borders: coldWarBorders, divide: coldWar.divide },
    }

    const usStates = feature(usStates10m, usStates10m.objects.states)
    usStates.features = usStates.features.filter((f) => !US_TERRITORIES.has(f.properties.name))
    for (const f of usStates.features) f.geometry = unwrapGeometry(f.geometry)
    const usStateBorders = unwrapGeometry(mesh(usStates10m, usStates10m.objects.states, (a, b) => a !== b))

    addBaseLayers(map, { countries, coast, borders, usStateBorders })
    addScenarioLayers(map)
    applyShades(map, scenario.shades)
    refreshSource('territories', territoriesGeoJSON())
    refreshArrows()
    syncMarkers()
    addCityMarkers()
    addBaseMarkers()
    addCountryLabelMarkers(eraData[ui.mapEra].countries)
    addStateLabelMarkers(usStates)
  })

  map.on('click', onClick)
  map.on('dblclick', (e) => {
    e.preventDefault()
    if (draft.points.length > 0) finishDraft()
  })
  map.on('contextmenu', (e) => {
    e.preventDefault()
    if (draft.points.length > 0) finishDraft()
  })
  map.on('mousedown', (e) => {
    if (!rotateKeyDown || !ui.selectedUnitId) return
    const unit = scenario.units.find((u) => u.id === ui.selectedUnitId)
    if (!unit) return
    e.preventDefault()
    map.dragPan.disable()
    rotateDrag = { unit, startX: e.point.x, startRotation: unit.rotation ?? 0 }
  })
  map.on('mousemove', (e) => {
    if (rotateDrag) {
      const deltaX = e.point.x - rotateDrag.startX
      const raw = rotateDrag.startRotation + deltaX * ROTATE_DRAG_SENSITIVITY
      rotateDrag.unit.rotation = ((raw % 360) + 360) % 360
      applyUnitTransform(rotateDrag.unit)
      return
    }
    if (draft.points.length > 0) {
      draft.cursor = [e.lngLat.lng, e.lngLat.lat]
      snapCheck(e)
      refreshDraft()
    }
  })
  map.on('mouseup', endRotateDrag)
  map.on('zoom', () => {
    if (cityElements.length > 0) updateCityVisibility()
    if (countryLabelElements.length > 0) updateCountryLabelVisibility()
    if (stateLabelElements.length > 0) updateStateLabelVisibility()
    if (markers.size > 0) updateUnitIconSizes()
  })

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onWindowBlur)
  // Catches the mouse being released outside the map canvas, which
  // map.on('mouseup', ...) alone would miss.
  window.addEventListener('mouseup', endRotateDrag)
  updateCursor()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('mouseup', endRotateDrag)
  map?.remove()
})

watch(() => scenario.territories, () => refreshSource('territories', territoriesGeoJSON()), { deep: true })
watch(() => scenario.arrows, refreshArrows, { deep: true })
watch(() => scenario.shades, () => map && applyShades(map, scenario.shades), { deep: true })
watch(() => [scenario.units, scenario.labels], syncMarkers, { deep: true })
watch(() => ui.tool, () => {
  cancelDraft()
  updateCursor()
})
watch(() => ui.showCountryLabels, () => map && updateCountryLabelVisibility())
watch(() => ui.showBases, () => map && updateBaseVisibility())
watch(() => ui.mapEra, (era) => {
  if (!map || !eraData) return
  applyEra(map, era, eraData)
  addCountryLabelMarkers(eraData[era].countries)
  updateBaseVisibility()
})
watch(() => ui.selectedUnitId, () => map && updateUnitSelectionHighlight())
</script>

<template>
  <div ref="container" class="map-container"></div>
</template>
