// Extract SVG path data for selected icons from react-icons' bundled
// game-icons.net set (CC BY 3.0). Writes preview SVGs to /tmp/icon-preview
// and, with --emit, generates src/lib/icon-paths.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

// Args are "set:IconName" (e.g. gi:GiTank, fa6:FaPersonMilitaryRifle); a bare
// name defaults to the gi set.
const NAMES = process.argv.slice(2).filter((a) => a !== '--emit')
const emit = process.argv.includes('--emit')

const sources = {}
function sourceFor(set) {
  sources[set] ??= readFileSync(`node_modules/react-icons/${set}/index.mjs`, 'utf8')
  return sources[set]
}

function extract(spec_) {
  const [set, name] = spec_.includes(':') ? spec_.split(':') : ['gi', spec_]
  const src = sourceFor(set)
  const re = new RegExp(`function ${name} ?\\(props\\)[^]*?GenIcon\\((\\{[^]*?\\})\\)\\(props\\)`)
  const m = src.match(re)
  if (!m) throw new Error(`icon not found: ${set}:${name}`)
  const spec = JSON.parse(m[1])
  const viewBox = spec.attr.viewBox
  const paths = spec.child.filter((c) => c.tag === 'path').map((c) => c.attr.d)
  return { name, viewBox, paths }
}

mkdirSync('/tmp/icon-preview', { recursive: true })
const out = {}
for (const arg of NAMES) {
  const icon = extract(arg)
  const name = icon.name
  out[name] = icon
  const body = icon.paths.map((d) => `<path d="${d}"/>`).join('')
  writeFileSync(
    `/tmp/icon-preview/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}" fill="#000"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`,
  )
  console.log(`${name}: viewBox ${icon.viewBox}, ${icon.paths.length} path(s)`)
}

if (emit) {
  const lines = ["// Icon path data from game-icons.net via react-icons (CC BY 3.0).",
    '// https://game-icons.net — icons by Lorc, Delapouite & contributors.',
    'export const ICON_PATHS = {']
  for (const [name, icon] of Object.entries(out)) {
    lines.push(`  ${name}: { viewBox: '${icon.viewBox}', paths: ${JSON.stringify(icon.paths)} },`)
  }
  lines.push('}')
  writeFileSync('src/lib/icon-paths.js', lines.join('\n') + '\n')
  console.log('wrote src/lib/icon-paths.js')
}
