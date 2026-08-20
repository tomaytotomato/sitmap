// Turns the modern countries FeatureCollection (see MapView's map load
// handler) into its 1980s equivalent: Warsaw Pact / Soviet successor states
// regrouped into their historical union, and Germany split along a
// hand-traced inner border. See src/data/cold-war.js for the source data.

import { pointInRing, splitRingByLine, unwrapRing } from './geometry.js'
import {
  BERLIN_WALL,
  BLOC_GROUPS,
  EAST_BERLIN,
  EAST_BERLIN_REFERENCE_POINT,
  EAST_GERMANY,
  EAST_GERMANY_REFERENCE_POINT,
  GERMAN_ISLAND_BLOCS,
  GREATER_BERLIN_BOUNDARY,
  INNER_GERMAN_BORDER,
  WEST_BERLIN,
  WEST_GERMANY,
} from '../data/cold-war.js'

const BLOC_BY_NAME = new Map(BLOC_GROUPS.flatMap((group) => group.members.map((name) => [name, group])))

export function blocKeyOf(name) {
  return BLOC_BY_NAME.get(name)?.gid ?? name
}

function islandSide(ring) {
  const lngs = ring.map((p) => p[0])
  const centre = (Math.min(...lngs) + Math.max(...lngs)) / 2
  return GERMAN_ISLAND_BLOCS.find((b) => centre >= b.lng[0] && centre <= b.lng[1])?.side ?? 'west'
}

function signedArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    sum += x1 * y2 - x2 * y1
  }
  return sum
}

// GeoJSON/earcut interior rings (holes) need the opposite winding order from
// their exterior ring, or the tessellator fills the "hole" solid instead of
// punching it out.
function asHoleOf(ring, exteriorRing) {
  return Math.sign(signedArea(ring)) === Math.sign(signedArea(exteriorRing)) ? [...ring].reverse() : ring
}

// Splits Greater Berlin along the Wall. Returns null if the hand-drawn wall
// ever fails to cross the boundary cleanly.
function splitBerlin() {
  const split = splitRingByLine(GREATER_BERLIN_BOUNDARY, BERLIN_WALL)
  if (!split) return null
  const [eastBerlinRing, westBerlinRing] = pointInRing(EAST_BERLIN_REFERENCE_POINT, split.ringA)
    ? [split.ringA, split.ringB]
    : [split.ringB, split.ringA]
  return { eastBerlinRing, westBerlinRing, wall: split.cutSegment }
}

// Returns { features, divideLines }. features is [east, west] or
// [east, west, eastBerlin, westBerlin] when the Berlin carve also succeeds;
// falls back to [feature] with no divide lines if the hand-traced border
// ever fails to cross the mainland ring cleanly (e.g. after a world-atlas
// update reshapes it).
function splitGermany(feature) {
  const rings = feature.geometry.coordinates.map((poly) => poly[0])
  const mainland = rings.reduce((a, b) => (b.length > a.length ? b : a))
  const islands = rings.filter((r) => r !== mainland)

  const split = splitRingByLine(mainland, INNER_GERMAN_BORDER)
  if (!split) return { features: [feature], divideLines: [] }

  const [eastMainland, westMainland] = pointInRing(EAST_GERMANY_REFERENCE_POINT, split.ringA)
    ? [split.ringA, split.ringB]
    : [split.ringB, split.ringA]

  const eastIslands = islands.filter((r) => islandSide(r) === 'east')
  const westIslands = islands.filter((r) => islandSide(r) === 'west')
  const berlin = splitBerlin()

  const toMultiPolygon = (mainRing, islandRings, holeRing) => {
    const mainPart = holeRing
      ? [unwrapRing(mainRing), unwrapRing(asHoleOf(holeRing, mainRing))]
      : [unwrapRing(mainRing)]
    return { type: 'MultiPolygon', coordinates: [mainPart, ...islandRings.map((r) => [unwrapRing(r)])] }
  }

  const features = [
    { type: 'Feature', properties: EAST_GERMANY, geometry: toMultiPolygon(eastMainland, eastIslands, berlin && GREATER_BERLIN_BOUNDARY) },
    { type: 'Feature', properties: WEST_GERMANY, geometry: toMultiPolygon(westMainland, westIslands, null) },
  ]
  const divideLines = [split.cutSegment]

  if (berlin) {
    features.push(
      { type: 'Feature', properties: EAST_BERLIN, geometry: { type: 'Polygon', coordinates: [unwrapRing(berlin.eastBerlinRing)] } },
      { type: 'Feature', properties: WEST_BERLIN, geometry: { type: 'Polygon', coordinates: [unwrapRing(berlin.westBerlinRing)] } },
    )
    divideLines.push(GREATER_BERLIN_BOUNDARY, berlin.wall)
  }

  return { features, divideLines }
}

export function buildColdWarCountries(countries) {
  const features = []
  let divideLines = []

  for (const country of countries.features) {
    if (country.properties.name === 'Germany') {
      const split = splitGermany(country)
      features.push(...split.features)
      divideLines = split.divideLines
      continue
    }
    const bloc = BLOC_BY_NAME.get(country.properties.name)
    features.push(bloc ? { ...country, properties: { gid: bloc.gid, name: bloc.name } } : country)
  }

  const divide = {
    type: 'FeatureCollection',
    features: divideLines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })),
  }

  return { countries: { type: 'FeatureCollection', features }, divide }
}
