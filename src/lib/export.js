import { FACTION_COLOURS } from './mapstyle.js'
import { tintedIcon, unitIconSize, UNIT_ICON_MAX_SIZE } from './units.js'
import { CITIES, cityVisible } from '../data/cities.js'

// Composite the GL canvas, the HTML-marker layers (units, labels) and the CRT
// treatment into a single PNG. Markers live outside the WebGL canvas, so they
// have to be redrawn by hand at their projected positions.
export async function exportPNG(map, scenario) {
  const glCanvas = map.getCanvas()
  const W = glCanvas.width
  const H = glCanvas.height
  const scale = W / glCanvas.clientWidth

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.drawImage(glCanvas, 0, 0)

  const zoom = map.getZoom()
  for (const city of CITIES) {
    if (!cityVisible(city, zoom)) continue
    const p = map.project(city.lngLat)
    const x = p.x * scale
    const y = p.y * scale
    ctx.fillStyle = '#6f93a8'
    ctx.beginPath()
    ctx.arc(x, y, 2.5 * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `${10 * scale}px "Helvetica Neue", Arial, sans-serif`
    ctx.fillStyle = '#7fa3b8'
    ctx.shadowColor = '#000000'
    ctx.shadowBlur = 3 * scale
    ctx.fillText(city.name, x + 7 * scale, y + 3.5 * scale)
    ctx.shadowBlur = 0
  }

  for (const unit of scenario.units) {
    const colour = unit.kind === 'battle' ? '#ffffff' : FACTION_COLOURS[unit.faction] ?? '#ffffff'
    const icon = await tintedIcon(unit.kind, colour, UNIT_ICON_MAX_SIZE)
    const size = unitIconSize(zoom) * scale * (unit.scale ?? 1)
    const p = map.project(unit.lngLat)
    ctx.save()
    ctx.translate(p.x * scale, p.y * scale)
    ctx.rotate(((unit.rotation ?? 0) * Math.PI) / 180)
    if (unit.flipped) ctx.scale(-1, 1)
    ctx.shadowColor = colour
    ctx.shadowBlur = 9 * scale
    ctx.drawImage(icon, -size / 2, -size / 2, size, size)
    ctx.restore()
  }
  ctx.shadowBlur = 0

  for (const label of scenario.labels) {
    const p = map.project(label.lngLat)
    const x = p.x * scale
    const y = p.y * scale
    ctx.fillStyle = '#05080d'
    ctx.beginPath()
    ctx.arc(x, y, 5.5 * scale, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2 * scale
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.font = `bold ${15 * scale}px "Helvetica Neue", Arial, sans-serif`
    ctx.shadowColor = '#000000'
    ctx.shadowBlur = 4 * scale
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label.text, x + 11 * scale, y + 5 * scale)
    ctx.shadowBlur = 0
  }

  const lineStep = Math.max(3, Math.round(3 * scale))
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  for (let y = 0; y < H; y += lineStep) {
    ctx.fillRect(0, y, W, Math.max(1, Math.round(scale)))
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, W, H)

  const link = document.createElement('a')
  link.download = `sitmap-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
