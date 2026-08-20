import { describe, it, expect } from 'vitest'
import { feature } from 'topojson-client'
import countries50 from 'world-atlas/countries-50m.json'
import { pointInRing, unwrapGeometry } from './geometry.js'
import { buildColdWarCountries } from './coldwar.js'

function square(name, [x, y], size = 1) {
  return {
    type: 'Feature',
    properties: { gid: name, name },
    geometry: {
      type: 'Polygon',
      coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]],
    },
  }
}

describe('buildColdWarCountries: bloc regrouping', () => {
  const countries = {
    type: 'FeatureCollection',
    features: [
      square('Russia', [0, 0]),
      square('Ukraine', [2, 0]),
      square('Czechia', [4, 0]),
      square('Slovakia', [6, 0]),
      square('France', [8, 0]),
    ],
  }

  it('relabels bloc members to their historical union, leaving others untouched', () => {
    const { countries: result } = buildColdWarCountries(countries)
    const byName = new Map(result.features.map((f) => [f.properties.name, f]))

    expect(byName.get('France')).toBe(countries.features[4])
    expect(result.features.find((f) => f.properties.name === 'Russia')).toBeUndefined()

    const ussr = result.features.filter((f) => f.properties.gid === 'USSR')
    expect(ussr).toHaveLength(2)
    expect(ussr.every((f) => f.properties.name === 'Union of Soviet Socialist Republics')).toBe(true)

    const czechoslovakia = result.features.filter((f) => f.properties.gid === 'TCH')
    expect(czechoslovakia).toHaveLength(2)
    expect(czechoslovakia.every((f) => f.properties.name === 'Czechoslovakia')).toBe(true)
  })

  it('keeps the original geometry of merged members (no unioning needed)', () => {
    const { countries: result } = buildColdWarCountries(countries)
    const russia = result.features.find((f) => f.properties.gid === 'USSR' && f.geometry.coordinates[0][0][0] === 0)
    expect(russia.geometry).toEqual(countries.features[0].geometry)
  })
})

describe('buildColdWarCountries: Germany split (real world-atlas data)', () => {
  const fc = feature(countries50, countries50.objects.countries)
  for (const f of fc.features) {
    f.properties = { gid: String(f.id), name: f.properties.name }
    f.geometry = unwrapGeometry(f.geometry)
  }
  const { countries: result, divide } = buildColdWarCountries(fc)

  const east = result.features.find((f) => f.properties.gid === 'DDR')
  const west = result.features.find((f) => f.properties.gid === 'BRD')

  it('produces exactly one East and one West Germany, and drops unified Germany', () => {
    expect(east).toBeDefined()
    expect(west).toBeDefined()
    expect(result.features.some((f) => f.properties.name === 'Germany')).toBe(false)
  })

  it('returns the crossed border segment for rendering the divide', () => {
    expect(divide.geometry.type).toBe('LineString')
    expect(divide.geometry.coordinates.length).toBeGreaterThan(1)
  })

  const eastRing = east.geometry.coordinates[0][0]
  const westRing = west.geometry.coordinates[0][0]

  it.each([
    ['Berlin', [13.4, 52.52], 'east'],
    ['Leipzig', [12.37, 51.34], 'east'],
    ['Dresden', [13.74, 51.05], 'east'],
    ['Munich', [11.58, 48.14], 'west'],
    ['Hamburg', [10.0, 53.55], 'west'],
    ['Frankfurt', [8.68, 50.11], 'west'],
    ['Cologne', [6.96, 50.94], 'west'],
  ])('places %s on the %s side', (_name, point, side) => {
    expect(pointInRing(point, eastRing)).toBe(side === 'east')
    expect(pointInRing(point, westRing)).toBe(side === 'west')
  })
})
