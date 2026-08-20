// Hand-curated strategic military installations. Faction reflects Cold War
// alignment (red = Warsaw Pact, blue = NATO/US, tan = other/non-aligned).
//
// `era` marks when a base is relevant: 'both' if it operated through the
// Cold War and still does today, 'coldwar' if it closed or lost its
// strategic role after ~1991, 'modern' if it postdates the Cold War
// entirely. Filtered by mapEra in MapView so each map only shows bases
// that actually meant something in that period.

const B = (name, role, faction, lng, lat, era = 'both') => ({ name, role, faction, lngLat: [lng, lat], era })

export const BASES = [
  // Warsaw Pact / Soviet — fleet and launch sites Russia still operates today
  B('Murmansk', 'Naval & submarine base', 'red', 33.08, 68.97),
  B('Severomorsk', 'Northern Fleet HQ', 'red', 33.42, 69.07),
  B('Vladivostok', 'Pacific Fleet HQ', 'red', 131.89, 43.12),
  B('Kaliningrad', 'Baltic Fleet HQ', 'red', 20.51, 54.71),
  B('Plesetsk Cosmodrome', 'ICBM & space launch site', 'red', 40.58, 62.93),
  B('Baikonur Cosmodrome', 'ICBM & space launch site', 'red', 63.34, 45.96),
  B('Novaya Zemlya', 'Nuclear & missile test site', 'red', 54.6, 73.5),

  // Warsaw Pact occupation HQs — gone once Soviet forces withdrew from the
  // Eastern Bloc by 1994
  B('Zossen-Wünsdorf', 'HQ, Group of Soviet Forces Germany', 'red', 13.45, 52.183, 'coldwar'),
  B('Legnica', 'HQ, Soviet Northern Group of Forces, Poland', 'red', 16.156, 51.207, 'coldwar'),

  // NATO / US — still active today
  B('Andrews AFB', 'Presidential & VIP airlift', 'blue', -76.87, 38.81),
  B('Norfolk Naval Base', 'Largest US naval base', 'blue', -76.33, 36.94),
  B('Cheyenne Mountain', 'NORAD command bunker', 'blue', -104.85, 38.74),
  B('RAF Lakenheath', 'USAF fighter wing, UK', 'blue', 0.56, 52.41),
  B('RAF Mildenhall', 'USAF air refuelling, UK', 'blue', 0.49, 52.36),
  B('Ramstein Air Base', 'USAF HQ, West Germany', 'blue', 7.6, 49.44),
  B('Incirlik Air Base', 'NATO air base, Turkey', 'blue', 35.43, 37.0),
  B('Rota Naval Station', 'US/Spanish naval base', 'blue', -6.35, 36.62),
  B('Yokosuka', 'US 7th Fleet HQ, Japan', 'blue', 139.67, 35.29),
  B('Osan Air Base', 'USAF fighter wing, South Korea', 'blue', 127.03, 37.09),
  B('Guantanamo Bay', 'US naval base, Cuba', 'blue', -75.15, 19.9),
  B('Diego Garcia', 'US/UK naval & air base', 'blue', 72.41, -7.31),
  B('RAF Fylingdales', 'Ballistic missile early warning radar', 'blue', -0.67, 54.361),
  B('RAF Menwith Hill', 'NSA/GCHQ signals intelligence', 'blue', -1.69, 54.014),
  B('Faslane (HMNB Clyde)', 'UK Trident submarine base', 'blue', -4.816, 56.056),
  B('Spangdahlem Air Base', 'USAF fighter wing, Germany', 'blue', 6.692, 49.973),
  B('Aviano Air Base', 'USAF southern flank, Italy', 'blue', 12.596, 46.031),
  B('Sigonella Naval Air Station', 'US Navy, Mediterranean, Italy', 'blue', 14.922, 37.401),
  B('Thule Air Base', 'Ballistic missile early warning radar', 'blue', -68.703, 76.531),

  // Northern flank / GIUK gap — guarded the sea routes Soviet submarines and
  // Bear bombers used to reach the Atlantic from the Kola Peninsula. Bodø,
  // Andøya and Keflavik all lost this role after the Cold War as forces
  // consolidated elsewhere (Bodø's QRA fighters moved to Ørland in 2022,
  // Andøya's patrol aircraft to Evenes, and the US left Keflavik in 2006).
  B('Bodø Main Air Station', 'NATO QRA interceptors, N. Norway', 'blue', 14.365, 67.269, 'coldwar'),
  B('Andøya Air Station', 'Maritime patrol, GIUK gap watch', 'blue', 16.144, 69.293, 'coldwar'),
  B('Keflavik Naval Air Station', 'GIUK gap ASW & interceptors', 'blue', -22.605, 63.985, 'coldwar'),

  // Other bases that closed with the Cold War
  B('RAF Greenham Common', 'Nuclear cruise missile base', 'blue', -1.298, 51.373, 'coldwar'),
  B('Holy Loch', 'US Navy Polaris submarine base', 'blue', -4.95, 55.98, 'coldwar'),
  B('Rhein-Main Air Base', 'USAF airlift hub, West Germany', 'blue', 8.543, 50.05, 'coldwar'),

  // Post-Cold War NATO — the eastward shift that replaced the above
  B('Ørland Air Station', "Norway's main QRA fighter base", 'blue', 9.604, 63.699, 'modern'),
  B('Redzikowo (Aegis Ashore)', 'US ballistic missile defence site, Poland', 'blue', 17.06, 54.48, 'modern'),
  B('Ämari Air Base', 'NATO Baltic Air Policing, Estonia', 'blue', 24.208, 59.264, 'modern'),
]

export function baseVisible(base, era) {
  return base.era === 'both' || base.era === era
}
