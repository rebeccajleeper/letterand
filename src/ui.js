// UI logic for combiner + finder modes

import {
  CELL, ALPHABET, buildLetterMasks, andMasks,
  drawMask, findBestMatches, matchScore, toBinary,
} from './engine.js'

// Default font size (maps to 300px on the 200x200 canvas)
const FONT_SIZE = 120

// Cached letter masks (rebuilt only when needed)
let masks = null

function getMasks() {
  if (!masks) masks = buildLetterMasks(FONT_SIZE)
  return masks
}

// ── DOM refs ───────────────────────────────────────────

let els = {}

export function initElements() {
  els = {
    // Combiner
    letterA: document.getElementById('letterA'),
    letterB: document.getElementById('letterB'),
    combinerResult: document.getElementById('combinerResult'),
    combinerSummary: document.getElementById('combinerSummary'),
    // Finder
    knownLetter: document.getElementById('knownLetter'),
    posA: document.getElementById('posA'),
    posB: document.getElementById('posB'),
    targetUpload: document.getElementById('targetUpload'),
    targetPreview: document.getElementById('targetPreview'),
    dropZone: document.getElementById('dropZone'),
    finderGrid: document.getElementById('finderGrid'),
  }
}

// ── Helpers ────────────────────────────────────────────

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

function parseLetter(input) {
  const val = input.value.toUpperCase().replace(/[^A-Z]/g, '')
  return val.length > 0 ? val[0] : null
}

// ── Combiner ───────────────────────────────────────────

export function updateCombiner() {
  const chA = parseLetter(els.letterA)
  const chB = parseLetter(els.letterB)
  clearEl(els.combinerResult)
  clearEl(els.combinerSummary)

  if (!chA || !chB) {
    els.combinerSummary.textContent = 'Enter two letters above to see the result.'
    return
  }

  const m = getMasks()
  const maskA = m[chA]
  const maskB = m[chB]
  const maskAND = andMasks(maskA, maskB)
  const best = findBestMatches(maskAND, m, 3)

  // Build visual: [A] & [B] = [AND] => "X"
  const row = els.combinerResult

  // Letter A
  const groupA = document.createElement('div')
  groupA.className = 'vis-group'
  const labelA = document.createElement('div')
  labelA.className = 'vis-label label-a'
  labelA.textContent = chA
  groupA.appendChild(labelA)
  groupA.appendChild(makeCanvas(maskA, 233, 69, 96, 120))
  row.appendChild(groupA)

  // Operator &
  const opAnd = document.createElement('span')
  opAnd.className = 'vis-op'
  opAnd.textContent = '&'
  row.appendChild(opAnd)

  // Letter B
  const groupB = document.createElement('div')
  groupB.className = 'vis-group'
  const labelB = document.createElement('div')
  labelB.className = 'vis-label label-b'
  labelB.textContent = chB
  groupB.appendChild(labelB)
  groupB.appendChild(makeCanvas(maskB, 67, 97, 238, 120))
  row.appendChild(groupB)

  // Operator =
  const opEq = document.createElement('span')
  opEq.className = 'vis-op'
  opEq.textContent = '='
  row.appendChild(opEq)

  // AND result
  const groupAND = document.createElement('div')
  groupAND.className = 'vis-group'
  const labelAND = document.createElement('div')
  labelAND.className = 'vis-label label-and'
  labelAND.textContent = 'AND'
  groupAND.appendChild(labelAND)
  groupAND.appendChild(makeCanvas(maskAND, 34, 34, 34, 120))
  row.appendChild(groupAND)

  // Arrow =>
  const opArrow = document.createElement('span')
  opArrow.className = 'vis-op vis-arrow'
  opArrow.textContent = '\u2192'
  row.appendChild(opArrow)

  // Best match letter
  const groupMatch = document.createElement('div')
  groupMatch.className = 'vis-group vis-match'
  const matchLetter = document.createElement('div')
  matchLetter.className = 'match-letter'
  matchLetter.textContent = best[0].ch
  groupMatch.appendChild(matchLetter)
  const matchScore = document.createElement('div')
  matchScore.className = 'match-score'
  matchScore.textContent = `${(best[0].score * 100).toFixed(0)}% match`
  groupMatch.appendChild(matchScore)
  row.appendChild(groupMatch)

  // Summary text
  const summary = els.combinerSummary
  const p1 = document.createElement('p')
  p1.innerHTML = `<strong class="hl-a">${chA}</strong> combined with <strong class="hl-b">${chB}</strong> looks like <strong class="hl-result">${best[0].ch}</strong>.`
  summary.appendChild(p1)

  if (best.length > 1) {
    const p2 = document.createElement('p')
    p2.className = 'runner-up'
    const runners = best.slice(1).map(b => `${b.ch} (${(b.score * 100).toFixed(0)}%)`).join(', ')
    p2.textContent = `Also similar to: ${runners}`
    summary.appendChild(p2)
  }
}

// ── Finder ─────────────────────────────────────────────

let targetImage = null
let targetMask = null
let knownPos = 'a' // 'a' means the known letter is in position A

export function setupFinder() {
  // Position toggle
  els.posA.addEventListener('click', () => {
    knownPos = 'a'
    els.posA.classList.add('active')
    els.posB.classList.remove('active')
    updateFinder()
  })
  els.posB.addEventListener('click', () => {
    knownPos = 'b'
    els.posB.classList.add('active')
    els.posA.classList.remove('active')
    updateFinder()
  })

  // File upload (click)
  els.targetUpload.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) loadTargetFile(file)
  })

  // Click anywhere on drop zone triggers file input
  els.dropZone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') els.targetUpload.click()
  })

  // Drag and drop
  const dz = els.dropZone
  dz.addEventListener('dragover', (e) => {
    e.preventDefault()
    dz.classList.add('drag-over')
  })
  dz.addEventListener('dragleave', () => {
    dz.classList.remove('drag-over')
  })
  dz.addEventListener('drop', (e) => {
    e.preventDefault()
    dz.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) loadTargetFile(file)
  })

  // Known letter input
  els.knownLetter.addEventListener('input', updateFinder)
}

function loadTargetFile(file) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    const img = new Image()
    img.onload = () => {
      targetImage = img
      targetMask = imageToMask(img)
      showTargetPreview(img)
      els.dropZone.classList.add('has-file')
      updateFinder()
    }
    img.src = ev.target.result
  }
  reader.readAsDataURL(file)
}

function imageToMask(img) {
  const c = document.createElement('canvas')
  c.width = CELL
  c.height = CELL
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, CELL, CELL)
  ctx.drawImage(img, 0, 0, CELL, CELL)
  return toBinary(ctx.getImageData(0, 0, CELL, CELL))
}

function showTargetPreview(img) {
  clearEl(els.targetPreview)
  const h = 80
  const w = Math.round(img.width * (h / img.height))
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  cv.style.width = w + 'px'
  cv.style.height = h + 'px'
  cv.className = 'target-canvas'
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  const label = document.createElement('span')
  label.className = 'target-label'
  label.textContent = 'Target:'
  els.targetPreview.appendChild(label)
  els.targetPreview.appendChild(cv)
}

export function updateFinder() {
  clearEl(els.finderGrid)

  const known = parseLetter(els.knownLetter)
  if (!known) {
    const msg = document.createElement('p')
    msg.className = 'finder-empty'
    msg.textContent = 'Enter a known letter above to see all 26 AND combinations.'
    els.finderGrid.appendChild(msg)
    return
  }

  const m = getMasks()
  const results = []

  for (const ch of ALPHABET) {
    const maskA = knownPos === 'a' ? m[known] : m[ch]
    const maskB = knownPos === 'a' ? m[ch] : m[known]
    const maskAND = andMasks(maskA, maskB)
    const bestMatch = findBestMatches(maskAND, m, 1)[0]

    let targetScore = null
    if (targetMask) {
      targetScore = matchScore(maskAND, targetMask)
    }

    results.push({
      ch,
      maskAND,
      bestMatch,
      targetScore,
    })
  }

  // Sort by target score (best first) if target uploaded, otherwise alphabetical
  if (targetMask) {
    results.sort((a, b) => b.targetScore - a.targetScore)
  }

  for (const r of results) {
    const card = document.createElement('div')
    card.className = 'finder-card'
    if (r.targetScore !== null && r.targetScore > 0.7) {
      card.classList.add('high-match')
    }

    // Header: which two letters
    const header = document.createElement('div')
    header.className = 'card-header'
    if (knownPos === 'a') {
      header.innerHTML = `<span class="hl-a">${known}</span> & <span class="hl-b">${r.ch}</span>`
    } else {
      header.innerHTML = `<span class="hl-a">${r.ch}</span> & <span class="hl-b">${known}</span>`
    }
    card.appendChild(header)

    // AND result canvas
    card.appendChild(makeCanvas(r.maskAND, 34, 34, 34, 64))

    // What it looks like
    const looks = document.createElement('div')
    looks.className = 'card-looks'
    looks.innerHTML = `\u2192 <strong>${r.bestMatch.ch}</strong>`
    card.appendChild(looks)

    // Target match score (if uploaded)
    if (r.targetScore !== null) {
      const score = document.createElement('div')
      score.className = 'card-score'
      score.textContent = `${(r.targetScore * 100).toFixed(0)}% target match`
      card.appendChild(score)
    }

    // The candidate letter large
    const candidateLabel = document.createElement('div')
    candidateLabel.className = 'card-candidate'
    candidateLabel.textContent = r.ch
    card.appendChild(candidateLabel)

    els.finderGrid.appendChild(card)
  }
}
