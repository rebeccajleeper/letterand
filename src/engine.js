// Core AND logic — pure computation, no DOM dependencies

export const CELL = 200
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// Fonts to try when matching — different puzzles use different fonts
export const FONT_FAMILIES = [
  '"Arial Black", "Arial Bold", sans-serif',
  'Impact, "Arial Narrow Bold", sans-serif',
  '"Helvetica Neue", "Helvetica Bold", Helvetica, sans-serif',
  '"Trebuchet MS", "Lucida Grande", sans-serif',
  'Verdana, Geneva, sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Courier New", Courier, monospace',
  '"Futura", "Century Gothic", sans-serif',
]

/**
 * Render a single letter to an offscreen canvas and return its ImageData.
 */
export function renderLetter(ch, fontSize, fontFamily) {
  const c = document.createElement('canvas')
  c.width = CELL
  c.height = CELL
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, CELL, CELL)
  ctx.fillStyle = '#000'
  const ff = fontFamily || '"Arial Black", "Arial Bold", sans-serif'
  ctx.font = `bold ${fontSize}px ${ff}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch.toUpperCase(), CELL / 2, CELL / 2 + Math.round(CELL * 0.02))
  return ctx.getImageData(0, 0, CELL, CELL)
}

/**
 * Convert ImageData to a binary mask (1 = dark pixel, 0 = light).
 */
export function toBinary(imageData) {
  const d = imageData.data
  const mask = new Uint8Array(CELL * CELL)
  for (let i = 0; i < mask.length; i++) {
    const brightness = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3
    mask[i] = brightness < 128 ? 1 : 0
  }
  return mask
}

/**
 * Bitwise AND two binary masks.
 */
export function andMasks(a, b) {
  const result = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) result[i] = a[i] & b[i]
  return result
}

/**
 * Score how well a candidate mask matches a target using IoU + F1 blend.
 */
export function matchScore(candidate, target) {
  let inter = 0, cSum = 0, tSum = 0
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i]) cSum++
    if (target[i]) tSum++
    if (candidate[i] && target[i]) inter++
  }
  if (cSum === 0 && tSum === 0) return 1
  if (cSum === 0 || tSum === 0) return 0
  const union = cSum + tSum - inter
  const iou = inter / union
  const prec = inter / cSum
  const rec = inter / tSum
  const f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0
  return 0.4 * iou + 0.6 * f1
}

/**
 * Build binary masks for every letter A-Z at a given font size and font family.
 */
export function buildLetterMasks(fontSize, fontFamily) {
  const masks = {}
  for (const ch of ALPHABET) {
    masks[ch] = toBinary(renderLetter(ch, fontSize, fontFamily))
  }
  return masks
}

/**
 * Build mask sets for ALL fonts. Returns an array of { fontFamily, masks }.
 */
export function buildAllFontMasks(fontSize) {
  return FONT_FAMILIES.map(ff => ({
    fontFamily: ff,
    masks: buildLetterMasks(fontSize, ff),
  }))
}

/**
 * Find the top-N best matching letters for a given mask.
 */
export function findBestMatches(mask, letterMasks, topN) {
  const scores = []
  for (const ch of ALPHABET) {
    scores.push({ ch, score: matchScore(letterMasks[ch], mask) })
  }
  scores.sort((a, b) => b.score - a.score)
  return scores.slice(0, topN)
}

/**
 * Draw a binary mask onto a canvas with the given RGB color.
 */
export function drawMask(canvas, mask, r, g, b) {
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(CELL, CELL)
  for (let i = 0; i < mask.length; i++) {
    img.data[i * 4] = mask[i] ? r : 255
    img.data[i * 4 + 1] = mask[i] ? g : 255
    img.data[i * 4 + 2] = mask[i] ? b : 255
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}
