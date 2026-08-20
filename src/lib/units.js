// Unit silhouettes: hand-picked SVGs in src/assets/military (sourced from
// SVG Repo) plus path data from game-icons.net (CC BY 3.0) and Font Awesome
// Free (CC BY 4.0). All icons are tinted per faction by rendering to a
// canvas and recolouring the pixels (source-in), which works identically for
// pure vectors and for SVGs wrapping embedded bitmaps (mig23, transport).

import f16Svg from '../assets/military/f16.svg?raw'
import mig23Svg from '../assets/military/mig23.svg?raw'
import bomberSvg from '../assets/military/bomber.svg?raw'
import b2Svg from '../assets/military/b2spirit.svg?raw'
import transportSvg from '../assets/military/transport.svg?raw'
import warshipSvg from '../assets/military/warship.svg?raw'
import submarineSvg from '../assets/military/submarine.svg?raw'
import riflemanSvg from '../assets/military/rifleman.svg?raw'
import battleSvg from '../assets/military/battle.svg?raw'
import artillerySvg from '../assets/military/artillery.svg?raw'
import arleighBurkeSvg from '../assets/military/arleigh-burke-destroyer.svg?raw'
import slavaSvg from '../assets/military/slava-cruiser.svg?raw'
import type23Svg from '../assets/military/type-23-frigate.svg?raw'
import sovremennySvg from '../assets/military/sovremenny-destroyer.svg?raw'
import nimitzSvg from '../assets/military/nimitz-carrier.svg?raw'
import grishaSvg from '../assets/military/grisha-corvette.svg?raw'
import deltaIvSvg from '../assets/military/delta-iv-typhoon-ssbn.svg?raw'
import akulaSvg from '../assets/military/akula-submarine.svg?raw'
import losAngelesSvg from '../assets/military/los-angeles-submarine.svg?raw'
import abramsSvg from '../assets/military/abrams.svg?raw'
import t80Svg from '../assets/military/t80.svg?raw'
import bradleySvg from '../assets/military/bradley.svg?raw'
import bmp2Svg from '../assets/military/bmp2.svg?raw'
import ah64ApacheSvg from '../assets/military/ah64-apache.svg?raw'
import ch47ChinookSvg from '../assets/military/ch47-chinook.svg?raw'
import uh60BlackhawkSvg from '../assets/military/uh60-blackhawk.svg?raw'
import rah66ComancheSvg from '../assets/military/rah66-comanche.svg?raw'
import mi24HindSvg from '../assets/military/mi24-hind.svg?raw'
import mv22OspreySvg from '../assets/military/mv22-osprey.svg?raw'
import eurocopterTigerSvg from '../assets/military/eurocopter-tiger.svg?raw'
import oh58KiowaSvg from '../assets/military/oh58-kiowa.svg?raw'
import seaKingSvg from '../assets/military/sea-king.svg?raw'
import ah1CobraSvg from '../assets/military/ah1-cobra.svg?raw'

const SOURCES = {
  infantry: riflemanSvg,
  fighter: f16Svg,
  mig: mig23Svg,
  bomber: bomberSvg,
  stealth: b2Svg,
  transport: transportSvg,
  ship: warshipSvg,
  sub: submarineSvg,
  battle: battleSvg,
  artillery: artillerySvg,
  'arleigh-burke-destroyer': arleighBurkeSvg,
  'slava-cruiser': slavaSvg,
  'type-23-frigate': type23Svg,
  'sovremenny-destroyer': sovremennySvg,
  'nimitz-carrier': nimitzSvg,
  'grisha-corvette': grishaSvg,
  'delta-iv-typhoon-ssbn': deltaIvSvg,
  'akula-submarine': akulaSvg,
  'los-angeles-submarine': losAngelesSvg,
  'm1-abrams': abramsSvg,
  't80': t80Svg,
  bradley: bradleySvg,
  bmp2: bmp2Svg,
  'ah64-apache': ah64ApacheSvg,
  'ch47-chinook': ch47ChinookSvg,
  'uh60-blackhawk': uh60BlackhawkSvg,
  'rah66-comanche': rah66ComancheSvg,
  'mi24-hind': mi24HindSvg,
  'mv22-osprey': mv22OspreySvg,
  'eurocopter-tiger': eurocopterTigerSvg,
  'oh58-kiowa': oh58KiowaSvg,
  'sea-king': seaKingSvg,
  'ah1-cobra': ah1CobraSvg,
}

export const UNIT_KINDS = Object.keys(SOURCES)

// All units render into the same square box (see unitIconSize below), so a
// silhouette cropped tighter to its vehicle than its neighbours ends up
// looking oversized next to them — Bradley/BMP-2 have much less padding
// around the hull than the tank icons. This tunes the default placement
// scale rather than the box itself, so it stays adjustable per-instance.
const UNIT_DEFAULT_SCALE = {
  bradley: 0.7,
  bmp2: 0.7,
  mig: 1.4,
}

export function unitDefaultScale(kind) {
  return UNIT_DEFAULT_SCALE[kind] ?? 1
}

// Units read fine as small ticks across a whole theatre, but at close zoom
// there's both room and reason to make them easier to read. Ramps between
// these two zoom levels and holds steady outside that range.
const UNIT_ICON_MIN_SIZE = 50
export const UNIT_ICON_MAX_SIZE = 100
const UNIT_ICON_ZOOM_RANGE = [6, 10]

export function unitIconSize(zoom) {
  const [z0, z1] = UNIT_ICON_ZOOM_RANGE
  const t = Math.min(1, Math.max(0, (zoom - z0) / (z1 - z0)))
  return UNIT_ICON_MIN_SIZE + t * (UNIT_ICON_MAX_SIZE - UNIT_ICON_MIN_SIZE)
}

// Real-world hulls belong to one side historically; anything absent from
// this map (the generic silhouettes) stays available to every faction, as
// it always has been.
const UNIT_FACTIONS = {
  fighter: ['blue', 'tan'],
  'arleigh-burke-destroyer': ['blue'],
  'nimitz-carrier': ['blue'],
  'los-angeles-submarine': ['blue'],
  'type-23-frigate': ['blue'],
  'slava-cruiser': ['red'],
  'sovremenny-destroyer': ['red'],
  'grisha-corvette': ['red'],
  'delta-iv-typhoon-ssbn': ['red'],
  'akula-submarine': ['red'],
  'm1-abrams': ['blue'],
  't80': ['red'],
  bradley: ['blue'],
  bmp2: ['red'],
  'ah64-apache': ['blue'],
  'ch47-chinook': ['blue'],
  'uh60-blackhawk': ['blue'],
  'rah66-comanche': ['blue'],
  'mi24-hind': ['red'],
  'mv22-osprey': ['blue'],
  'eurocopter-tiger': ['blue'],
  'oh58-kiowa': ['blue'],
  'sea-king': ['blue'],
  'ah1-cobra': ['blue'],
}

// A handful of hulls postdate the Cold War outright (the Comanche never even
// left prototype stage before 1991, let alone entered service); anything
// absent from this map is period-appropriate for both eras.
const UNIT_ERAS = {
  'rah66-comanche': ['modern'],
  'mv22-osprey': ['modern'],
  'eurocopter-tiger': ['modern'],
}

export function unitAvailable(kind, faction, era) {
  const allowedFactions = UNIT_FACTIONS[kind]
  const allowedEras = UNIT_ERAS[kind]
  return (!allowedFactions || allowedFactions.includes(faction)) && (!allowedEras || allowedEras.includes(era))
}

const images = new Map()
function sourceImage(kind) {
  if (!images.has(kind)) {
    images.set(
      kind,
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SOURCES[kind])}`
      }),
    )
  }
  return images.get(kind)
}

const tinted = new Map()

// Resolve to a canvas of the icon recoloured to `colour`, rendered at 2x the
// requested size for sharpness on retina displays.
export function tintedIcon(kind, colour, size = 30) {
  const key = `${kind}|${colour}|${size}`
  if (!tinted.has(key)) {
    tinted.set(
      key,
      sourceImage(kind).then((img) => {
        const px = size * 2
        const canvas = document.createElement('canvas')
        canvas.width = px
        canvas.height = px
        const ctx = canvas.getContext('2d')
        const ratio = (img.width || 1) / (img.height || 1)
        const w = ratio >= 1 ? px : px * ratio
        const h = ratio >= 1 ? px / ratio : px
        ctx.drawImage(img, (px - w) / 2, (px - h) / 2, w, h)
        ctx.globalCompositeOperation = 'source-in'
        ctx.fillStyle = colour
        ctx.fillRect(0, 0, px, px)
        return canvas
      }),
    )
  }
  return tinted.get(key)
}

export async function iconDataURL(kind, colour, size = 30) {
  const canvas = await tintedIcon(kind, colour, size)
  return canvas.toDataURL()
}
