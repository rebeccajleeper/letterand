// Word Mode — paid feature: combine two full words position-by-position

import {
  CELL, buildLetterMasks, andMasks,
  drawMask, findBestMatches,
} from './engine.js'

const FONT_SIZE = 120
let masks = null

function getMasks() {
  if (!masks) masks = buildLetterMasks(FONT_SIZE)
  return masks
}

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

function makeCanvas(mask, r, g, b, cssSize) {
  const cv = document.createElement('canvas')
  cv.width = CELL
  cv.height = CELL
  if (cssSize) {
    cv.style.width = cssSize + 'px'
    cv.style.height = cssSize + 'px'
  }
  drawMask(cv, mask, r, g, b)
  return cv
}

function parseLine(val) {
  return val.toUpperCase().replace(/[^A-Z]/g, '')
}

let els = {}

export function initWordMode() {
  els = {
    wordA: document.getElementById('wordA'),
    wordB: document.getElementById('wordB'),
    wordResult: document.getElementById('wordResult'),
    wordDecoded: document.getElementById('wordDecoded'),
    wordError: document.getElementById('wordError'),
  }
  if (!els.wordA) return // not in DOM yet

  els.wordA.addEventListener('input', updateWordMode)
  els.wordB.addEventListener('input', updateWordMode)
}

export function updateWordMode() {
  if (!els.wordA) return

  const a = parseLine(els.wordA.value)
  const b = parseLine(els.wordB.value)

  clearEl(els.wordResult)
  clearEl(els.wordDecoded)
  els.wordError.textContent = ''

  if (!a || !b) {
    els.wordError.textContent = 'Enter two words above to see results.'
    return
  }

  if (a.length !== b.length) {
    els.wordError.textContent = `Words must be the same length. "${a}" has ${a.length} letters, "${b}" has ${b.length}.`
    return
  }

  const m = getMasks()
  const decoded = []

  for (let i = 0; i < a.length; i++) {
    const chA = a[i]
    const chB = b[i]
    const maskA = m[chA]
    const maskB = m[chB]
    const maskAND = andMasks(maskA, maskB)
    const best = findBestMatches(maskAND, m, 1)[0]
    decoded.push(best.ch)

    // Build card for this position
    const card = document.createElement('div')
    card.className = 'wm-card'

    // Position header
    const pos = document.createElement('div')
    pos.className = 'wm-pos'
    pos.textContent = i + 1

    // Letter pair
    const pair = document.createElement('div')
    pair.className = 'wm-pair'
    pair.innerHTML = `<span class="hl-a">${chA}</span> & <span class="hl-b">${chB}</span>`

    // AND canvas
    const canvas = makeCanvas(maskAND, 34, 34, 34, 64)

    // Result letter
    const result = document.createElement('div')
    result.className = 'wm-match'
    result.innerHTML = `&rarr; <strong>${best.ch}</strong>`

    // Score
    const score = document.createElement('div')
    score.className = 'wm-score'
    score.textContent = `${(best.score * 100).toFixed(0)}%`

    card.appendChild(pos)
    card.appendChild(pair)
    card.appendChild(canvas)
    card.appendChild(result)
    card.appendChild(score)
    els.wordResult.appendChild(card)
  }

  // Show decoded word
  const decodedText = document.createElement('div')
  decodedText.className = 'wm-decoded-text'
  decodedText.textContent = decoded.join('')
  els.wordDecoded.appendChild(decodedText)

  const decodedLabel = document.createElement('div')
  decodedLabel.className = 'wm-decoded-label'
  decodedLabel.textContent = `${a} AND ${b}`
  els.wordDecoded.appendChild(decodedLabel)
}
