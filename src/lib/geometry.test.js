import { describe, it, expect } from 'vitest'
import {
  lngLatToMerc,
  mercToLngLat,
  catmullRom,
  polylineLength,
  buildArrow,
  taperedRibbon,
  jitterRing,
  unwrapLine,
  unwrapRing,
  unwrapGeometry,
  pointInRing,
  splitRingByLine,
} from './geometry.js'

describe('mercator projection', () => {
  it('round-trips a coordinate', () => {
    const [lng, lat] = mercToLngLat(lngLatToMerc([12.57, 55.68]))
    expect(lng).toBeCloseTo(12.57, 6)
    expect(lat).toBeCloseTo(55.68, 6)
  })

  it('maps the origin to the centre of mercator space', () => {
    const [x, y] = lngLatToMerc([0, 0])
    expect(x).toBeCloseTo(0.5, 9)
    expect(y).toBeCloseTo(0.5, 9)
  })
})

describe('catmullRom', () => {
  it('preserves endpoints', () => {
    const pts = [[0, 0], [0.3, 0.5], [1, 0.2]]
    const smoothed = catmullRom(pts, 8)
    expect(smoothed[0]).toEqual([0, 0])
    expect(smoothed[smoothed.length - 1]).toEqual([1, 0.2])
  })

  it('produces more points than it was given', () => {
    const smoothed = catmullRom([[0, 0], [1, 1], [2, 0]], 8)
    expect(smoothed.length).toBeGreaterThan(3)
  })
})

describe('taperedRibbon', () => {
  it('tapers from widthStart at the first point to widthEnd at the last', () => {
    const ring = taperedRibbon([[0, 0], [10, 0]], 4, 1)
    // For a straight 2-point line: ring = [tailLeft, headLeft, headRight, tailRight, tailLeft].
    const [tailLeft, headLeft, headRight, tailRight] = ring
    expect(Math.hypot(tailLeft[0] - tailRight[0], tailLeft[1] - tailRight[1])).toBeCloseTo(4, 6)
    expect(Math.hypot(headLeft[0] - headRight[0], headLeft[1] - headRight[1])).toBeCloseTo(1, 6)
  })

  it('returns a closed ring', () => {
    const ring = taperedRibbon([[0, 0], [5, 5], [10, 0]], 3, 1)
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('rejects degenerate input', () => {
    expect(taperedRibbon([[0, 0]], 2, 1)).toBeNull()
    expect(taperedRibbon([[0, 0], [0, 0]], 2, 1)).toBeNull()
  })
})

describe('buildArrow', () => {
  const path = [[0, 0], [10, 0]]

  it('returns a closed tapered shaft ring and a closed head ring', () => {
    const arrow = buildArrow(path)
    expect(arrow.shaft.length).toBeGreaterThan(3)
    expect(arrow.shaft[0]).toEqual(arrow.shaft[arrow.shaft.length - 1])
    expect(arrow.head).toHaveLength(4)
    expect(arrow.head[0]).toEqual(arrow.head[3])
  })

  it('places the arrow tip at the end of the clicked path', () => {
    const arrow = buildArrow(path)
    const tip = arrow.head[1]
    expect(tip[0]).toBeCloseTo(10, 4)
    expect(tip[1]).toBeCloseTo(0, 4)
  })

  it('keeps the shaft short of the tip and narrower near the head than at the tail', () => {
    const arrow = buildArrow(path)
    for (const p of arrow.shaft) {
      expect(p[0]).toBeLessThan(10)
      expect(p[0]).toBeGreaterThanOrEqual(0)
    }
    // Ring layout is [...left, ...right.reversed, left[0]]: index 0 pairs
    // with the second-to-last point (the tail), and the two points either
    // side of the halfway mark pair up at the neck, where it meets the head.
    const pointsPerSide = (arrow.shaft.length - 1) / 2
    const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
    const tailWidth = dist2d(arrow.shaft[0], arrow.shaft[arrow.shaft.length - 2])
    const neckWidth = dist2d(arrow.shaft[pointsPerSide - 1], arrow.shaft[pointsPerSide])
    expect(neckWidth).toBeLessThan(tailWidth)
  })

  it('has a head symmetric about a horizontal path', () => {
    const arrow = buildArrow(path)
    const [barbL, , barbR] = arrow.head
    expect(barbL[1]).toBeCloseTo(-barbR[1], 4)
    expect(barbL[0]).toBeCloseTo(barbR[0], 4)
  })

  it('rejects degenerate input', () => {
    expect(buildArrow([[5, 5]])).toBeNull()
    expect(buildArrow([[5, 5], [5, 5]])).toBeNull()
  })
})

describe('jitterRing', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]

  it('returns a closed ring with more points than the input', () => {
    const ring = jitterRing(square, { rand: () => 0.5 })
    expect(ring.length).toBeGreaterThan(square.length)
    expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 9)
    expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 9)
  })

  it('keeps the original vertices in place', () => {
    const ring = jitterRing(square, { rand: () => 1 })
    for (const v of square.slice(0, 4)) {
      const hit = ring.some((p) => Math.abs(p[0] - v[0]) < 1e-4 && Math.abs(p[1] - v[1]) < 1e-4)
      expect(hit).toBe(true)
    }
  })

  it('rejects degenerate rings', () => {
    expect(jitterRing([[0, 0], [1, 1]])).toBeNull()
  })
})

describe('antimeridian unwrapping', () => {
  it('continues a line eastwards across +180', () => {
    expect(unwrapLine([[179, 60], [-179, 60], [-170, 61]])).toEqual([[179, 60], [181, 60], [190, 61]])
  })

  it('continues a line westwards across -180', () => {
    expect(unwrapLine([[-179, 60], [179, 60]])).toEqual([[-179, 60], [-181, 60]])
  })

  it('leaves a line clear of the antimeridian untouched', () => {
    const line = [[10, 50], [20, 55], [30, 60]]
    expect(unwrapLine(line)).toEqual(line)
  })

  it('keeps a non-polar crossing ring closed', () => {
    const ring = [[170, 60], [179, 60], [-179, 60], [-170, 60], [-170, 65], [170, 65], [170, 60]]
    const out = unwrapRing(ring)
    expect(out[0]).toEqual(out[out.length - 1])
    expect(out.map((p) => p[0])).toEqual([170, 179, 181, 190, 190, 170, 170])
  })

  it('closes a polar ring along the pole', () => {
    const ring = [[0, -70], [120, -70], [-120, -70], [0, -70]]
    const out = unwrapRing(ring)
    expect(out[0]).toEqual(out[out.length - 1])
    expect(out).toContainEqual([360, -85])
    expect(out).toContainEqual([0, -85])
  })

  it('unwraps every ring of a MultiPolygon', () => {
    const geometry = {
      type: 'MultiPolygon',
      coordinates: [[[[179, 10], [-179, 10], [-179, 12], [179, 12], [179, 10]]]],
    }
    const out = unwrapGeometry(geometry)
    expect(out.coordinates[0][0].map((p) => p[0])).toEqual([179, 181, 181, 179, 179])
  })
})

describe('polylineLength', () => {
  it('sums segment lengths', () => {
    expect(polylineLength([[0, 0], [3, 4], [3, 4]])).toBeCloseTo(5, 9)
  })
})

describe('pointInRing', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]

  it('finds a point inside the ring', () => {
    expect(pointInRing([5, 5], square)).toBe(true)
  })

  it('rejects a point outside the ring', () => {
    expect(pointInRing([15, 5], square)).toBe(false)
  })
})

describe('splitRingByLine', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]

  it('splits a square into two halves along a line crossing it twice', () => {
    const cut = [[5, -1], [5, 11]]
    const result = splitRingByLine(square, cut)
    expect(result).not.toBeNull()
    const { ringA, ringB } = result
    expect(ringA[0]).toEqual(ringA[ringA.length - 1])
    expect(ringB[0]).toEqual(ringB[ringB.length - 1])

    const leftPoint = [2, 5]
    const rightPoint = [8, 5]
    const leftInA = pointInRing(leftPoint, ringA)
    const rightInA = pointInRing(rightPoint, ringA)
    // Each side of the cut belongs to exactly one of the two output rings.
    expect(leftInA).not.toBe(rightInA)
    expect(pointInRing(leftPoint, ringB)).toBe(!leftInA)
    expect(pointInRing(rightPoint, ringB)).toBe(!rightInA)
  })

  it('returns the crossed segment of the cut line', () => {
    const cut = [[5, -1], [5, 11]]
    const { cutSegment } = splitRingByLine(square, cut)
    expect(cutSegment[0]).toEqual([5, 0])
    expect(cutSegment[cutSegment.length - 1]).toEqual([5, 10])
  })

  it('partitions the original area exactly for a bent (non-chord) cut', () => {
    // A cut that bows out to x=7 partway through: if the far side were ever
    // closed with a straight chord instead of retracing this bend, the
    // wedge between the chord and the real cut would be missing from both
    // output rings.
    const cut = [[5, -1], [7, 5], [5, 11]]
    const { ringA, ringB } = splitRingByLine(square, cut)
    const area = (ring) => {
      let a = 0
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i]
        const [x2, y2] = ring[i + 1]
        a += x1 * y2 - x2 * y1
      }
      return Math.abs(a / 2)
    }
    expect(area(ringA) + area(ringB)).toBeCloseTo(area(square), 9)
  })

  it('returns null when the cut does not cross the ring twice', () => {
    expect(splitRingByLine(square, [[20, -1], [20, 11]])).toBeNull()
    expect(splitRingByLine(square, [[5, 2], [5, 8]])).toBeNull()
  })
})
