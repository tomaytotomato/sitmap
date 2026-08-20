// Pure geometry for Sitmap: web-mercator maths, arrow polygon
// construction, and jagged "torn edge" territory rings. Everything works in
// normalised mercator space [0..1] so shapes stay visually consistent
// regardless of latitude.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

export function lngLatToMerc([lng, lat]) {
  const x = (lng + 180) / 360
  const s = Math.sin((lat * Math.PI) / 180)
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)
  return [x, y]
}

export function mercToLngLat([x, y]) {
  const lng = x * 360 - 180
  const n = Math.PI * (1 - 2 * y)
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n))
  return [lng, lat]
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const len = (a) => Math.hypot(a[0], a[1])
const dist = (a, b) => len(sub(a, b))

function norm(a) {
  const l = len(a)
  return l === 0 ? [0, 0] : [a[0] / l, a[1] / l]
}

// Perpendicular (left-hand normal) of a direction vector.
const perp = (d) => [-d[1], d[0]]

function dedupe(pts, eps = 1e-9) {
  const out = []
  for (const p of pts) {
    if (out.length === 0 || dist(out[out.length - 1], p) > eps) out.push(p)
  }
  return out
}

export function polylineLength(pts) {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i])
  return l
}

// Uniform Catmull-Rom smoothing. Endpoints are preserved.
export function catmullRom(pts, segs = 8) {
  if (pts.length < 3) return pts.slice()
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(i + 2, pts.length - 1)]
    for (let j = 0; j < segs; j++) {
      const t = j / segs
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}

// Cut a polyline at a given distance from the start, returning the points up
// to (and including) an interpolated end point.
function trimTo(pts, target) {
  if (target <= 0) return [pts[0]]
  const out = [pts[0]]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i])
    if (acc + d >= target) {
      const t = d === 0 ? 0 : (target - acc) / d
      out.push(add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), t)))
      return out
    }
    acc += d
    out.push(pts[i])
  }
  return out
}

// Offsets a polyline into a closed ribbon polygon whose width tapers evenly
// (by arc-length fraction) from widthStart at pts[0] to widthEnd at the last
// point. Each point's offset direction is the average of its incoming and
// outgoing segment normals, so the ribbon stays smooth through curves rather
// than kinking at every sample.
export function taperedRibbon(pts, widthStart, widthEnd) {
  const n = pts.length
  if (n < 2) return null

  const dists = [0]
  for (let i = 1; i < n; i++) dists.push(dists[i - 1] + dist(pts[i - 1], pts[i]))
  const total = dists[n - 1]
  if (total === 0) return null

  const left = []
  const right = []
  for (let i = 0; i < n; i++) {
    const inward = i > 0 ? norm(sub(pts[i], pts[i - 1])) : null
    const outward = i < n - 1 ? norm(sub(pts[i + 1], pts[i])) : null
    const tangent = norm(add(inward ?? outward, outward ?? inward))
    const normal = perp(tangent)
    const width = widthStart + (widthEnd - widthStart) * (dists[i] / total)
    left.push(add(pts[i], mul(normal, width / 2)))
    right.push(add(pts[i], mul(normal, -width / 2)))
  }

  const ring = [...left, ...right.reverse()]
  ring.push(ring[0])
  return ring
}

// Build an attack arrow from a clicked path. Both the shaft and the head are
// filled polygons: the shaft tapers from full width at the tail to a narrow
// neck at the head, which reads as directional motion rather than a bar with
// an arrowhead stuck on the end.
export function buildArrow(pathLngLat, widthFrac = 0.14) {
  const raw = dedupe(pathLngLat.map(lngLatToMerc))
  if (raw.length < 2) return null
  const pts = dedupe(catmullRom(raw, 10))
  const L = polylineLength(pts)
  if (L === 0) return null

  // w is otherwise purely proportional to L, so a very long arrow (spanning
  // most of a theatre) would grow an arrowhead hundreds of km wide. W_MAX is
  // an absolute ceiling in normalised mercator space (the whole world is
  // 1 unit wide), independent of L, so length stops being the only factor
  // once an arrow gets long enough to hit it.
  const W_MAX = 0.002
  const w = clamp(L * widthFrac, L * 0.02, Math.min(L * 0.5, W_MAX))
  const headLen = Math.min(w * 2.8, L * 0.45)
  const headW = w * 1.5

  const toBase = trimTo(pts, L - headLen)
  const base = toBase[toBase.length - 1]
  // Overlap the shaft slightly into the head so no seam shows at the joint.
  const shaftPts = trimTo(pts, L - headLen + w * 0.3)
  const shaft = taperedRibbon(shaftPts, w, w * 0.2)

  const tip = pts[pts.length - 1]
  const nEnd = perp(norm(sub(tip, base)))
  const barbL = add(base, mul(nEnd, headW / 2))
  const barbR = add(base, mul(nEnd, -headW / 2))
  const head = [barbL, tip, barbR, barbL]

  return {
    shaft: shaft.map(mercToLngLat),
    head: head.map(mercToLngLat),
  }
}

// world-atlas data is stitched across the antimeridian for spherical (d3)
// renderers. A planar renderer draws a +180 → -180 jump as a segment across
// the whole world, and fills triangulate into rogue wedges. Unwrapping keeps
// longitudes continuous past ±180, which MapLibre renders into the adjacent
// world copy.
export function unwrapLine(coords) {
  const out = [coords[0].slice()]
  let offset = 0
  for (let i = 1; i < coords.length; i++) {
    let lng = coords[i][0] + offset
    const prev = out[i - 1][0]
    if (lng - prev > 180) {
      offset -= 360
      lng -= 360
    } else if (lng - prev < -180) {
      offset += 360
      lng += 360
    }
    out.push([lng, coords[i][1]])
  }
  return out
}

// Unwrap a polygon ring. A ring that encircles a pole drifts a full 360°
// between start and end once unwrapped; close it along the pole instead.
export function unwrapRing(ring) {
  const out = unwrapLine(ring)
  const drift = out[out.length - 1][0] - out[0][0]
  if (Math.abs(drift) > 350) {
    const lat = ring[0][1] < 0 ? -85 : 85
    out.push([out[out.length - 1][0], lat], [out[0][0], lat], out[0].slice())
  }
  return out
}

export function unwrapGeometry(geometry) {
  switch (geometry.type) {
    case 'LineString':
      return { ...geometry, coordinates: unwrapLine(geometry.coordinates) }
    case 'MultiLineString':
      return { ...geometry, coordinates: geometry.coordinates.map(unwrapLine) }
    case 'Polygon':
      return { ...geometry, coordinates: geometry.coordinates.map(unwrapRing) }
    case 'MultiPolygon':
      return { ...geometry, coordinates: geometry.coordinates.map((rings) => rings.map(unwrapRing)) }
    default:
      return geometry
  }
}

function ringArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

function ringCentroid(ring, area) {
  if (area === 0) return ring[0]
  let cx = 0
  let cy = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    const cross = x1 * y2 - x2 * y1
    cx += (x1 + x2) * cross
    cy += (y1 + y2) * cross
  }
  return [cx / (6 * area), cy / (6 * area)]
}

// Label anchor for a country: the centroid of its largest exterior ring, so
// a scattered MultiPolygon (islands, exclaves) labels its mainland rather
// than an average point that can fall outside the shape entirely. Also
// returns that ring's area, so callers merging several countries into one
// historical bloc (e.g. USSR) can pick the biggest member to label.
export function polygonLabelPoint(geometry) {
  const rings =
    geometry.type === 'Polygon' ? [geometry.coordinates[0]]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates.map((poly) => poly[0])
    : null
  if (!rings) return null

  let best = null
  let bestArea = -1
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue
    const area = Math.abs(ringArea(ring))
    if (area > bestArea) {
      bestArea = area
      best = { point: ringCentroid(ring, ringArea(ring)), area }
    }
  }
  return best
}

export function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const crosses = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

function segmentIntersection(a1, a2, b1, b2) {
  const [x1, y1] = a1
  const [x2, y2] = a2
  const [x3, y3] = b1
  const [x4, y4] = b2
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(d) < 1e-12) return null
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / d
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { u, point: [x1 + t * (x2 - x1), y1 + t * (y2 - y1)] }
}

// Splits a closed ring into two closed rings along an open polyline that
// crosses its boundary exactly twice, with both cut endpoints outside the
// ring. Used to carve a historical internal border (e.g. the inner German
// border) out of a country polygon that predates it — the border doesn't
// exist as data anywhere, so it has to be hand-traced and cut in directly.
// Returns null if the cut doesn't cross the ring cleanly twice.
export function splitRingByLine(ring, cut) {
  const hits = []
  for (let i = 0; i < ring.length - 1; i++) {
    for (let j = 0; j < cut.length - 1; j++) {
      const hit = segmentIntersection(ring[i], ring[i + 1], cut[j], cut[j + 1])
      if (hit) hits.push({ ringIndex: i, cutIndex: j, cutT: hit.u, point: hit.point })
    }
  }
  if (hits.length !== 2) return null
  hits.sort((a, b) => a.cutIndex + a.cutT - (b.cutIndex + b.cutT))
  const [entry, exit] = hits

  const ringSpan = (from, to) => {
    const out = [from.point]
    const n = ring.length - 1
    for (let i = (from.ringIndex + 1) % n; i !== (to.ringIndex + 1) % n; i = (i + 1) % n) out.push(ring[i])
    out.push(to.point)
    return out
  }

  // The cut only has one walkable direction (its own point order, entry to
  // exit); the other ring is closed by reversing this same span rather than
  // re-deriving it, since slicing with the endpoints swapped yields nothing.
  const cutSegment = [entry.point, ...cut.slice(entry.cutIndex + 1, exit.cutIndex + 1), exit.point]

  const ringA = [...ringSpan(entry, exit), ...cutSegment.slice(0, -1).reverse()]
  const ringB = [...ringSpan(exit, entry), ...cutSegment.slice(1)]
  ringA.push(ringA[0])
  ringB.push(ringB[0])
  return { ringA, ringB, cutSegment }
}

// Roughen a polygon ring into the jagged "radar contour" edge of a WiC
// territory. Original vertices are kept in place; intermediate samples are
// displaced perpendicular to each edge. `rand` is injectable for tests.
export function jitterRing(ringLngLat, { rand = Math.random, roughness = 0.006, samples = 140 } = {}) {
  let pts = dedupe(ringLngLat.map(lngLatToMerc))
  if (pts.length >= 2 && dist(pts[0], pts[pts.length - 1]) < 1e-12) pts = pts.slice(0, -1)
  if (pts.length < 3) return null

  let perim = 0
  for (let i = 0; i < pts.length; i++) perim += dist(pts[i], pts[(i + 1) % pts.length])
  const step = perim / samples
  const amp = perim * roughness

  const out = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const edgeLen = dist(a, b)
    const n = perp(norm(sub(b, a)))
    const k = Math.max(1, Math.round(edgeLen / step))
    for (let j = 0; j < k; j++) {
      const p = add(a, mul(sub(b, a), j / k))
      const d = j === 0 ? 0 : (rand() * 2 - 1) * amp
      out.push(add(p, mul(n, d)))
    }
  }
  out.push(out[0])
  return out.map(mercToLngLat)
}
