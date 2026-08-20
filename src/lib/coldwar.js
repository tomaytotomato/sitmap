// Turns the modern countries FeatureCollection (see MapView's map load
// handler) into its 1980s equivalent: Warsaw Pact / Soviet successor states
// regrouped into their historical union, and Germany split along a
// hand-traced inner border. See src/data/cold-war.js for the source data.

import { pointInRing, splitRingByLine, unwrapRing } from './geometry.js'
import {
  BLOC_GROUPS,
  EAST_GERMANY,
  EAST_GERMANY_REFERENCE_POINT,
  GERMAN_ISLAND_BLOCS,
  INNER_GERMAN_BORDER,
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

// Returns { features: [east, west], divide }, or { features: [feature],
// divide: null } if the hand-traced border ever fails to cross the mainland
// ring cleanly (e.g. after a world-atlas update reshapes it).
function splitGermany(feature) {
  const rings = feature.geometry.coordinates.map((poly) => poly[0])
  const mainland = rings.reduce((a, b) => (b.length > a.length ? b : a))
  const islands = rings.filter((r) => r !== mainland)

  const split = splitRingByLine(mainland, INNER_GERMAN_BORDER)
  if (!split) return { features: [feature], divide: null }

  const [eastMainland, westMainland] = pointInRing(EAST_GERMANY_REFERENCE_POINT, split.ringA)
    ? [split.ringA, split.ringB]
    : [split.ringB, split.ringA]

  const eastIslands = islands.filter((r) => islandSide(r) === 'east')
  const westIslands = islands.filter((r) => islandSide(r) === 'west')

  const toMultiPolygon = (mainRing, islandRings) => ({
    type: 'MultiPolygon',
    coordinates: [mainRing, ...islandRings].map((r) => [unwrapRing(r)]),
  })

  return {
    features: [
      { type: 'Feature', properties: EAST_GERMANY, geometry: toMultiPolygon(eastMainland, eastIslands) },
      { type: 'Feature', properties: WEST_GERMANY, geometry: toMultiPolygon(westMainland, westIslands) },
    ],
    divide: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: split.cutSegment } },
  }
}

export function buildColdWarCountries(countries) {
  const features = []
  let divide = null

  for (const country of countries.features) {
    if (country.properties.name === 'Germany') {
      const split = splitGermany(country)
      features.push(...split.features)
      divide = split.divide
      continue
    }
    const bloc = BLOC_BY_NAME.get(country.properties.name)
    features.push(bloc ? { ...country, properties: { gid: bloc.gid, name: bloc.name } } : country)
  }

  return { countries: { type: 'FeatureCollection', features }, divide }
}
