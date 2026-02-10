// Word Mode — paid feature: combine two full words or decode a word image

import {
  CELL, ALPHABET, buildLetterMasks, andMasks,
  drawMask, findBestMatches, matchScore,
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

// ── Decode state ──────────────────────────────────────
let decodeImage = null
let decodeMasks = null  // array of masks, one per letter position

export function initWordMode() {
  els = {
    // Tabs
    tabCombine: document.getElementById('tabCombine'),
    tabDecode: document.getElementById('tabDecode'),
    combinePanel: document.getElementById('combinePanel'),
    decodePanel: document.getElementById('decodePanel'),
    // Combine
    wordA: document.getElementById('wordA'),
    wordB: document.getElementById('wordB'),
    wordResult: document.getElementById('wordResult'),
    wordDecoded: document.getElementById('wordDecoded'),
    wordError: document.getElementById('wordError'),
    // Decode
    decodeWord: document.getElementById('decodeWord'),
    decodeUpload: document.getElementById('decodeUpload'),
    decodeDropZone: document.getElementById('decodeDropZone'),
    decodeDropContent: document.getElementById('decodeDropContent'),
    decodePreview: document.getElementById('decodePreview'),
    decodeSolveBtn: document.getElementById('decodeSolveBtn'),
    decodeResult: document.getElementById('decodeResult'),
    decodeDecodedResult: document.getElementById('decodeDecodedResult'),
  }
  if (!els.wordA) return

  // Combine inputs
  els.wordA.addEventListener('input', updateWordMode)
  els.wordB.addEventListener('input', updateWordMode)

  // Tab switching
  if (els.tabCombine && els.tabDecode) {
    els.tabCombine.addEventListener('click', () => switchTab('combine'))
    els.tabDecode.addEventListener('click', () => switchTab('decode'))
  }

  // Decode: file upload
  if (els.decodeUpload) {
    els.decodeUpload.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) loadDecodeFile(file)
    })
  }

  // Decode: click drop zone
  if (els.decodeDropZone) {
    els.decodeDropZone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') els.decodeUpload.click()
    })

    // Drag and drop
    els.decodeDropZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      els.decodeDropZone.classList.add('drag-over')
    })
    els.decodeDropZone.addEventListener('dragleave', () => {
      els.decodeDropZone.classList.remove('drag-over')
    })
    els.decodeDropZone.addEventListener('drop', (e) => {
      e.preventDefault()
      els.decodeDropZone.classList.remove('drag-over')
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) loadDecodeFile(file)
    })
  }

  // Decode: known word input
  if (els.decodeWord) {
    els.decodeWord.addEventListener('input', checkDecodeReady)
  }

  // Decode: solve button
  if (els.decodeSolveBtn) {
    els.decodeSolveBtn.addEventListener('click', runDecode)
  }
}

function switchTab(tab) {
  if (tab === 'combine') {
    els.tabCombine.classList.add('active')
    els.tabDecode.classList.remove('active')
    els.combinePanel.style.display = ''
    els.decodePanel.style.display = 'none'
  } else {
    els.tabCombine.classList.remove('active')
    els.tabDecode.classList.add('active')
    els.combinePanel.style.display = 'none'
    els.decodePanel.style.display = ''
  }
}

// ── Enable/disable decode inputs ──────────────────────
export function setDecodeEnabled(enabled) {
  if (els.decodeWord) els.decodeWord.disabled = !enabled
  checkDecodeReady()
}

function checkDecodeReady() {
  const word = parseLine(els.decodeWord?.value || '')
  els.decodeSolveBtn.disabled = !(word.length > 0 && decodeImage)
}

// ── Decode image loading ──────────────────────────────

function loadDecodeFile(file) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    const img = new Image()
    img.onload = () => {
      decodeImage = img
      showDecodePreview(img)
      els.decodeDropZone.classList.add('has-file')
      checkDecodeReady()
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

function showDecodePreview(img) {
  clearEl(els.decodePreview)
  const cv = document.createElement('canvas')
  const maxH = 60
  const scale = maxH / img.height
  cv.width = Math.round(img.width * scale)
  cv.height = maxH
  cv.style.height = maxH + 'px'
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0, cv.width, cv.height)
  els.decodePreview.appendChild(cv)
  els.decodeDropContent.style.display = 'none'
  els.decodePreview.style.display = 'flex'
}

/**
 * Split an image into N equal vertical strips and convert each to a CELL×CELL mask.
 * Color-agnostic: any pixel with a dark channel is "ink".
 */
function splitImageToMasks(img, numLetters) {
  const letterWidth = img.width / numLetters
  const result = []
  for (let i = 0; i < numLetters; i++) {
    const c = document.createElement('canvas')
    c.width = CELL
    c.height = CELL
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, CELL, CELL)
    ctx.drawImage(img, i * letterWidth, 0, letterWidth, img.height, 0, 0, CELL, CELL)
    const d = ctx.getImageData(0, 0, CELL, CELL).data
    const mask = new Uint8Array(CELL * CELL)
    for (let j = 0; j < mask.length; j++) {
      const minCh = Math.min(d[j * 4], d[j * 4 + 1], d[j * 4 + 2])
      mask[j] = minCh < 200 ? 1 : 0
    }
    result.push(mask)
  }
  return result
}

// ── Run decode ────────────────────────────────────────

function runDecode() {
  clearEl(els.decodeResult)
  clearEl(els.decodeDecodedResult)

  const knownWord = parseLine(els.decodeWord.value)
  if (!knownWord || !decodeImage) return

  // Split image into letter-sized masks
  const targetMasks = splitImageToMasks(decodeImage, knownWord.length)
  const m = getMasks()
  const decoded = []

  for (let i = 0; i < knownWord.length; i++) {
    const knownCh = knownWord[i]
    const targetMask = targetMasks[i]

    // Try all 26 candidates
    let best = { ch: '?', score: -1, maskAND: null }
    for (const ch of ALPHABET) {
      const maskAND = andMasks(m[knownCh], m[ch])
      const score = matchScore(maskAND, targetMask)
      if (score > best.score) {
        best = { ch, score, maskAND }
      }
    }
    decoded.push(best)

    // Build card
    const card = document.createElement('div')
    card.className = 'decode-card'

    const pos = document.createElement('div')
    pos.className = 'decode-card-pos'
    pos.textContent = i + 1

    const pair = document.createElement('div')
    pair.className = 'decode-card-pair'
    pair.innerHTML = `<span class="hl-a">${knownCh}</span> & <span class="hl-b">${best.ch}</span>`

    const canvas = makeCanvas(best.maskAND, 34, 34, 34, 56)

    const letter = document.createElement('div')
    letter.className = 'decode-card-letter'
    letter.textContent = best.ch

    const score = document.createElement('div')
    score.className = 'decode-card-score'
    score.textContent = `${(best.score * 100).toFixed(0)}%`

    card.appendChild(pos)
    card.appendChild(pair)
    card.appendChild(canvas)
    card.appendChild(letter)
    card.appendChild(score)
    els.decodeResult.appendChild(card)
  }

  // Show decoded word
  const decodedText = document.createElement('div')
  decodedText.className = 'wm-decoded-text'
  decodedText.textContent = decoded.map(d => d.ch).join('')
  els.decodeDecodedResult.appendChild(decodedText)

  const decodedLabel = document.createElement('div')
  decodedLabel.className = 'wm-decoded-label'
  decodedLabel.textContent = `${knownWord} & ? = decoded word`
  els.decodeDecodedResult.appendChild(decodedLabel)
}

// ── Combine mode (existing) ───────────────────────────

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

    const card = document.createElement('div')
    card.className = 'wm-card'

    const pos = document.createElement('div')
    pos.className = 'wm-pos'
    pos.textContent = i + 1

    const pair = document.createElement('div')
    pair.className = 'wm-pair'
    pair.innerHTML = `<span class="hl-a">${chA}</span> & <span class="hl-b">${chB}</span>`

    const canvas = makeCanvas(maskAND, 34, 34, 34, 64)

    const result = document.createElement('div')
    result.className = 'wm-match'
    result.innerHTML = `<strong>${best.ch}</strong>`

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

  const decodedText = document.createElement('div')
  decodedText.className = 'wm-decoded-text'
  decodedText.textContent = decoded.join('')
  els.wordDecoded.appendChild(decodedText)

  const decodedLabel = document.createElement('div')
  decodedLabel.className = 'wm-decoded-label'
  decodedLabel.textContent = `${a} AND ${b}`
  els.wordDecoded.appendChild(decodedLabel)
}
