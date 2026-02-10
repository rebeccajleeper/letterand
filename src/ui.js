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
    targetUpload: document.getElementById('targetUpload'),
    targetPreview: document.getElementById('targetPreview'),
    dropZone: document.getElementById('dropZone'),
    dropZoneContent: document.getElementById('dropZoneContent'),
    finderResult: document.getElementById('finderResult'),
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

export function setupFinder() {
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
  const sz = 80
  const cv = document.createElement('canvas')
  cv.width = sz
  cv.height = sz
  cv.style.width = sz + 'px'
  cv.style.height = sz + 'px'
  cv.className = 'target-canvas'
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0, sz, sz)
  els.targetPreview.appendChild(cv)

  // Hide the upload prompt, show preview
  els.dropZoneContent.style.display = 'none'
  els.targetPreview.style.display = 'flex'
}

export function updateFinder() {
  clearEl(els.finderResult)
  clearEl(els.finderGrid)

  const known = parseLetter(els.knownLetter)

  if (!known && !targetMask) {
    const msg = document.createElement('p')
    msg.className = 'finder-empty'
    msg.textContent = 'Enter a known letter and upload a target image to find the missing letter.'
    els.finderGrid.appendChild(msg)
    return
  }

  if (!known) {
    const msg = document.createElement('p')
    msg.className = 'finder-empty'
    msg.textContent = 'Now enter the known letter to find the match.'
    els.finderGrid.appendChild(msg)
    return
  }

  if (!targetMask) {
    const msg = document.createElement('p')
    msg.className = 'finder-empty'
    msg.textContent = 'Upload a target image to find which letter creates it.'
    els.finderGrid.appendChild(msg)
    return
  }

  // Try all 26 letters in both positions, pick the best
  const m = getMasks()
  const results = []

  for (const ch of ALPHABET) {
    // Try known as A, candidate as B
    const maskAB = andMasks(m[known], m[ch])
    const scoreAB = matchScore(maskAB, targetMask)

    // Try candidate as A, known as B
    const maskBA = andMasks(m[ch], m[known])
    const scoreBA = matchScore(maskBA, targetMask)

    // Pick whichever position scored better
    const bestPos = scoreAB >= scoreBA ? 'a' : 'b'
    const bestScore = Math.max(scoreAB, scoreBA)
    const bestMask = bestPos === 'a' ? maskAB : maskBA

    results.push({
      ch,
      pos: bestPos,
      score: bestScore,
      maskAND: bestMask,
    })
  }

  results.sort((a, b) => b.score - a.score)

  // Show prominent best match
  const best = results[0]
  const resultDiv = els.finderResult

  const resultCard = document.createElement('div')
  resultCard.className = 'finder-best-match'

  const resultLabel = document.createElement('div')
  resultLabel.className = 'finder-best-label'
  resultLabel.textContent = 'Best match'

  const resultLetter = document.createElement('div')
  resultLetter.className = 'finder-best-letter'
  resultLetter.textContent = best.ch

  const resultScore = document.createElement('div')
  resultScore.className = 'finder-best-score'
  resultScore.textContent = `${(best.score * 100).toFixed(0)}% match`

  const resultExplain = document.createElement('div')
  resultExplain.className = 'finder-best-explain'
  if (best.pos === 'a') {
    resultExplain.innerHTML = `<span class="hl-a">${known}</span> <span class="op">&</span> <span class="hl-b">${best.ch}</span> creates this image`
  } else {
    resultExplain.innerHTML = `<span class="hl-a">${best.ch}</span> <span class="op">&</span> <span class="hl-b">${known}</span> creates this image`
  }

  const resultCanvas = makeCanvas(best.maskAND, 34, 34, 34, 100)

  resultCard.appendChild(resultLabel)
  resultCard.appendChild(resultLetter)
  resultCard.appendChild(resultCanvas)
  resultCard.appendChild(resultScore)
  resultCard.appendChild(resultExplain)
  resultDiv.appendChild(resultCard)

  // Show runner-ups in grid
  const runnersLabel = document.createElement('div')
  runnersLabel.className = 'finder-runners-label'
  runnersLabel.textContent = 'Other candidates'

  els.finderGrid.appendChild(runnersLabel)

  for (let i = 1; i < results.length; i++) {
    const r = results[i]
    const card = document.createElement('div')
    card.className = 'finder-card'
    if (r.score > 0.7) card.classList.add('high-match')

    const header = document.createElement('div')
    header.className = 'card-header'
    if (r.pos === 'a') {
      header.innerHTML = `<span class="hl-a">${known}</span> & <span class="hl-b">${r.ch}</span>`
    } else {
      header.innerHTML = `<span class="hl-a">${r.ch}</span> & <span class="hl-b">${known}</span>`
    }
    card.appendChild(header)

    card.appendChild(makeCanvas(r.maskAND, 34, 34, 34, 64))

    const score = document.createElement('div')
    score.className = 'card-score'
    score.textContent = `${(r.score * 100).toFixed(0)}%`
    card.appendChild(score)

    const candidateLabel = document.createElement('div')
    candidateLabel.className = 'card-candidate'
    candidateLabel.textContent = r.ch
    card.appendChild(candidateLabel)

    els.finderGrid.appendChild(card)
  }
}
