// Generates the Homies home-screen icon set from one shared vector definition.
// Run with: node scripts/build-icons.mjs
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const RED = '#9a0002'
const CREAM = '#efe6de'

// Speech bubble from the #HOMIES logo: rounded body with a tail dropping from
// the bottom edge, vertical on the left and slanting back up to the right.
const BUBBLE =
  'M138,100 H374 A26,26 0 0 1 400,126 V306 A26,26 0 0 1 374,332 H300 ' +
  'L232,420 V332 H138 A26,26 0 0 1 112,306 V126 A26,26 0 0 1 138,100 Z'

// The logo hash, drawn on the original 512 grid then scaled into the bubble.
const HASH = `
    <g transform="translate(256,216) scale(0.72) translate(-259,-256)">
      <g transform="translate(256,256) skewX(-9) translate(-256,-256)" fill="${RED}">
        <rect x="196" y="126" width="48" height="260" rx="4"/>
        <rect x="286" y="126" width="48" height="260" rx="4"/>
        <rect x="146" y="188" width="238" height="48" rx="4"/>
        <rect x="134" y="276" width="238" height="48" rx="4"/>
      </g>
    </g>`

const mark = (scale) => `  <g transform="translate(256,256) scale(${scale}) translate(-256,-256)">
    <path d="${BUBBLE}" fill="${CREAM}"/>${HASH}
  </g>`

const svg = (backdrop, scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Homies Pro Shop">
${backdrop}
${mark(scale)}
</svg>
`

// purpose="any": rounded tile, the OS may or may not mask it further.
const anyIcon = svg(`  <rect width="512" height="512" rx="96" fill="${RED}"/>`, 1.18)
// purpose="maskable": full bleed, mark pulled inside the 80% safe circle.
const maskableIcon = svg(`  <rect width="512" height="512" fill="${RED}"/>`, 0.88)

writeFileSync(join(publicDir, 'homies-icon.svg'), anyIcon)
writeFileSync(join(publicDir, 'homies-icon-maskable.svg'), maskableIcon)

const png = (source, size, name) =>
  sharp(Buffer.from(source)).resize(size, size).png().toFile(join(publicDir, name))

await Promise.all([
  png(anyIcon, 192, 'homies-icon-192.png'),
  png(anyIcon, 512, 'homies-icon-512.png'),
  png(anyIcon, 180, 'apple-touch-icon.png'),
  png(maskableIcon, 512, 'homies-icon-maskable-512.png'),
])

console.log('icons written to', publicDir)
