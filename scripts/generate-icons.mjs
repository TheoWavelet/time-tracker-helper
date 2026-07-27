import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

const sizes = [16, 32, 48, 128, 256, 512]
const root = resolve(import.meta.dirname, '..')

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  typeBuffer.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return result
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function blend(pixel, color, opacity) {
  const alpha = (color[3] / 255) * opacity
  const currentAlpha = pixel[3] / 255
  const nextAlpha = alpha + currentAlpha * (1 - alpha)
  if (nextAlpha === 0) return [0, 0, 0, 0]
  return [
    Math.round((color[0] * alpha + pixel[0] * currentAlpha * (1 - alpha)) / nextAlpha),
    Math.round((color[1] * alpha + pixel[1] * currentAlpha * (1 - alpha)) / nextAlpha),
    Math.round((color[2] * alpha + pixel[2] * currentAlpha * (1 - alpha)) / nextAlpha),
    Math.round(nextAlpha * 255)
  ]
}

function coverage(distance, edge = 0.75) {
  return Math.max(0, Math.min(1, 0.5 - distance / edge))
}

function roundedRectDistance(x, y, halfWidth, halfHeight, radius) {
  const dx = Math.abs(x) - halfWidth + radius
  const dy = Math.abs(y) - halfHeight + radius
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius
}

function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const scale = size / 256
  const setPixel = (x, y, color, opacity) => {
    const offset = (y * size + x) * 4
    const mixed = blend([pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]], color, opacity)
    pixels[offset] = mixed[0]
    pixels[offset + 1] = mixed[1]
    pixels[offset + 2] = mixed[2]
    pixels[offset + 3] = mixed[3]
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = (x + 0.5) / scale - 128
      const py = (y + 0.5) / scale - 128
      const tile = coverage(roundedRectDistance(px, py, 108, 108, 42) * scale)
      setPixel(x, y, [13, 59, 66, 255], tile)

      const radius = Math.hypot(px, py)
      const angle = (Math.atan2(py, px) * 180) / Math.PI
      const progress = angle >= -140 && angle <= 90 ? 1 : 0
      const ring = coverage(Math.abs(radius - 69) * scale - 8 * scale)
      setPixel(x, y, [247, 201, 72, 255], ring * progress)

      const face = coverage((radius - 51) * scale)
      setPixel(x, y, [18, 82, 90, 255], face)

      const handLine = Math.abs(px * 0.62 - py * 0.78) - 5
      const handLength = Math.max(Math.abs(px + 5) - 11, Math.abs(py + 7) - 44)
      setPixel(x, y, [245, 107, 93, 255], coverage(Math.max(handLine, handLength) * scale))

      const center = coverage((Math.hypot(px, py) - 11) * scale)
      setPixel(x, y, [245, 107, 93, 255], center)
    }
  }
  return pixels
}

function encodeIco(images) {
  const header = Buffer.alloc(6 + images.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16
    header[entry] = size === 256 ? 0 : size
    header[entry + 1] = size === 256 ? 0 : size
    header[entry + 2] = 0
    header[entry + 3] = 0
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...images.map(({ png }) => png)])
}

const images = sizes.map((size) => ({ size, png: encodePng(size, renderIcon(size)) }))

// ICO directory entries store width/height in a single byte (0 meaning 256), so anything above
// 256 can't be represented — 512 is generated only for the Linux/tray PNGs below.
const icoPath = resolve(root, 'build', 'icon.ico')
await mkdir(dirname(icoPath), { recursive: true })
await writeFile(icoPath, encodeIco(images.filter(({ size }) => size <= 256)))

for (const { size, png } of images.filter(({ size }) => size !== 256 && size !== 512)) {
  const iconPath = resolve(root, 'browser-extension', 'icons', `icon-${size}.png`)
  await mkdir(dirname(iconPath), { recursive: true })
  await writeFile(iconPath, png)
}

// Linux packaging wants a single square PNG (512+ recommended) rather than an .ico.
const linuxIcon = images.find(({ size }) => size === 512)
await writeFile(resolve(root, 'build', 'icon.png'), linuxIcon.png)

// A separate, smaller icon for the tray on non-Windows platforms (see tray.ts) — the taskbar-sized
// .ico doesn't apply there, and a 512px source would look oversized/blurry once Electron scales it.
const trayIcon = images.find(({ size }) => size === 32)
await writeFile(resolve(root, 'build', 'tray-icon.png'), trayIcon.png)

console.log('Generated Windows ICO, Linux/tray PNG icons, and Chrome extension PNG icons.')