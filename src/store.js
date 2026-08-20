import { reactive } from 'vue'
import exampleScenario from './data/sitmap-example.json?raw'

export const scenario = reactive({
  territories: [], // { id, faction, ring: [[lng,lat],...] }
  arrows: [],      // { id, faction, path: [[lng,lat],...] }
  units: [],       // { id, faction, kind, lngLat: [lng,lat], rotation, scale, flipped }
  labels: [],      // { id, text, lngLat: [lng,lat] }
  shades: [],      // { gid, name, faction } — whole-country shading
})

export const ui = reactive({
  tool: 'pan', // pan | territory | shade | arrow | unit | label | erase
  faction: 'red',
  unitKind: 't80',
  showCountryLabels: true,
  showBases: false,
  mapEra: 'modern', // modern | coldwar — overridden by a loaded scenario's own mapEra, see below
  selectedUnitId: null,
})

export const uid = () => crypto.randomUUID()

export function clearScenario() {
  scenario.territories = []
  scenario.arrows = []
  scenario.units = []
  scenario.labels = []
  scenario.shades = []
}

export function removeFeature(id) {
  scenario.territories = scenario.territories.filter((f) => f.id !== id)
  scenario.arrows = scenario.arrows.filter((f) => f.id !== id)
  scenario.units = scenario.units.filter((f) => f.id !== id)
  scenario.labels = scenario.labels.filter((f) => f.id !== id)
  if (ui.selectedUnitId === id) ui.selectedUnitId = null
}

export function toggleShade(gid, name, faction) {
  const existing = scenario.shades.find((s) => s.gid === gid)
  if (existing && existing.faction === faction) {
    scenario.shades = scenario.shades.filter((s) => s.gid !== gid)
  } else if (existing) {
    existing.faction = faction
  } else {
    scenario.shades.push({ gid, name, faction })
  }
}

export function removeShade(gid) {
  scenario.shades = scenario.shades.filter((s) => s.gid !== gid)
}

export function serialiseScenario() {
  return JSON.stringify(
    {
      version: 2,
      mapEra: ui.mapEra,
      territories: scenario.territories,
      arrows: scenario.arrows,
      units: scenario.units,
      labels: scenario.labels,
      shades: scenario.shades,
    },
    null,
    2,
  )
}

export function loadScenarioJSON(text) {
  const data = JSON.parse(text)
  // Absent on older saves — leave the current era alone rather than assume.
  if (data.mapEra === 'modern' || data.mapEra === 'coldwar') ui.mapEra = data.mapEra
  scenario.territories = Array.isArray(data.territories) ? data.territories : []
  scenario.arrows = Array.isArray(data.arrows) ? data.arrows : []
  scenario.units = (Array.isArray(data.units) ? data.units : []).map((raw) => {
    let u = raw.kind === 'nuke' ? { ...raw, kind: 'battle' } : raw
    // The generic tank, APC and attack helicopter icons were retired in
    // favour of faction-specific hulls; route older saves to the closest
    // equivalent for their faction (falling back to infantry for the tan
    // faction, which has none of these).
    if (u.kind === 'tank') {
      u = { ...u, kind: u.faction === 'red' ? 't80' : u.faction === 'blue' ? 'm1-abrams' : 'infantry' }
    } else if (u.kind === 'apc') {
      u = { ...u, kind: u.faction === 'red' ? 'bmp2' : u.faction === 'blue' ? 'bradley' : 'infantry' }
    } else if (u.kind === 'heli') {
      u = { ...u, kind: u.faction === 'red' ? 'mi24-hind' : u.faction === 'blue' ? 'ah64-apache' : 'infantry' }
    }
    return { rotation: 0, scale: 1, flipped: false, ...u }
  })
  scenario.labels = Array.isArray(data.labels) ? data.labels : []
  scenario.shades = Array.isArray(data.shades) ? data.shades : []
}

// The app opens on a worked example rather than a blank map.
loadScenarioJSON(exampleScenario)
