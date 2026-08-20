// 1980s political geography, derived from the same modern Natural Earth
// boundaries as the present-day map. The USSR, Czechoslovakia and Yugoslavia
// are recreated by regrouping their modern successor states — their combined
// territory hasn't changed since. Germany is the one exception: reunification
// erased the internal border entirely, so it isn't recoverable by regrouping
// and is instead hand-traced in INNER_GERMAN_BORDER below.
//
// Country names below must match `name` exactly as it appears in
// world-atlas/countries-50m.json.

export const BLOC_GROUPS = [
  {
    gid: 'USSR',
    name: 'Union of Soviet Socialist Republics',
    members: [
      'Russia', 'Ukraine', 'Belarus', 'Moldova', 'Estonia', 'Latvia', 'Lithuania',
      'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan',
      'Tajikistan', 'Kyrgyzstan',
    ],
  },
  {
    gid: 'TCH',
    name: 'Czechoslovakia',
    members: ['Czechia', 'Slovakia'],
  },
  {
    gid: 'YUG',
    name: 'Yugoslavia',
    members: ['Serbia', 'Croatia', 'Bosnia and Herz.', 'Slovenia', 'Macedonia', 'Montenegro', 'Kosovo'],
  },
]

export const WEST_GERMANY = { gid: 'BRD', name: 'West Germany' }
export const EAST_GERMANY = { gid: 'DDR', name: 'East Germany' }

// Hand-traced approximation of the inner German border. Deliberately
// overshoots into the Baltic Sea at the north end and past the Czech border
// at the south end, so it crosses Germany's mainland outline cleanly.
export const INNER_GERMAN_BORDER = [
  [10.95, 54.15],
  [10.80, 53.85],
  [10.70, 53.55],
  [10.75, 53.25],
  [11.15, 53.05],
  [11.05, 52.65],
  [11.05, 52.30],
  [10.60, 51.85],
  [10.20, 51.50],
  [10.05, 51.05],
  [10.10, 50.65],
  [10.65, 50.40],
  [11.25, 50.35],
  [12.70, 49.90],
]

// A reference point known to sit in East Germany, used to work out which of
// the two rings produced by splitRingByLine is which — more robust than
// assuming a fixed winding order out of the source data.
export const EAST_GERMANY_REFERENCE_POINT = [13.4, 52.52] // Berlin

// Germany's mainland ring is cut by INNER_GERMAN_BORDER, but its handful of
// coastal islands sit outside that ring and have to be assigned by
// longitude instead — Fehmarn (Baltic side but politically West) is why this
// can't just be "east of the cut line goes East".
export const GERMAN_ISLAND_BLOCS = [
  { lng: [12.9, 13.8], side: 'east' }, // Rügen
  { lng: [13.8, 14.3], side: 'east' }, // Usedom
  { lng: [10.9, 11.4], side: 'west' }, // Fehmarn
  { lng: [8.1, 8.7], side: 'west' }, // Sylt / Amrum / Föhr
]

// Berlin sat entirely inside East Germany but was itself split: the Western
// Allies administered the western sectors as an island enclave (West
// Berlin), while the Soviet sector doubled as East Germany's capital. Both
// are carved out of the East German mainland as their own facets.
export const EAST_BERLIN = { gid: 'BER-E', name: 'East Berlin' }
export const WEST_BERLIN = { gid: 'BER-W', name: 'West Berlin' }

// Hand-drawn approximation of Greater Berlin's outer boundary with
// surrounding East Germany.
export const GREATER_BERLIN_BOUNDARY = [
  [13.09, 52.54],
  [13.15, 52.59],
  [13.30, 52.63],
  [13.50, 52.60],
  [13.60, 52.53],
  [13.58, 52.44],
  [13.45, 52.38],
  [13.28, 52.34],
  [13.13, 52.40],
  [13.09, 52.54],
]

// Hand-traced approximation of the Berlin Wall's path through the city,
// deliberately overshooting past the Greater Berlin boundary at each end so
// it crosses cleanly (same technique as INNER_GERMAN_BORDER, just at city
// scale).
export const BERLIN_WALL = [
  [13.40, 52.66],
  [13.38, 52.60],
  [13.36, 52.56],
  [13.35, 52.52],
  [13.36, 52.48],
  [13.38, 52.44],
  [13.40, 52.40],
  [13.42, 52.36],
]

// Brandenburg Gate — known to sit in East Berlin, same purpose as
// EAST_GERMANY_REFERENCE_POINT above.
export const EAST_BERLIN_REFERENCE_POINT = [13.377, 52.516]
