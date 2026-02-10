// UI logic for combiner + finder modes

import {
  CELL, ALPHABET, buildLetterMasks, buildAllFontMasks, andMasks,
  drawMask, findBestMatches, matchScore,
} from './engine.js'

// Default font size (maps to 300px on the 200x200 canvas)
const FONT_SIZE = 120

// Cached letter masks — single font for combiner display, all fonts for finder
let masks = null
let allFontMasks = null

function getMasks() {
  if (!masks) masks = buildLetterMasks(FONT_SIZE)
  return masks
}

function getAllFontMasks() {
  if (!allFontMasks) allFontMasks = buildAllFontMasks(FONT_SIZE)
  return allFontMasks
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
    solveBtn: document.getElementById('solveBtn'),
    finderResult: document.getElementById('finderResult'),
    finderGrid: document.getElementById('finderGrid'),
    directMatch: document.getElementById('directMatch'),
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

  // Show the 26-card grid when known letter changes (no target matching)
  // Clear direct match and grid when letter is cleared
  els.knownLetter.addEventListener('input', () => {
    if (!parseLetter(els.knownLetter)) clearEl(els.directMatch)
    updateFinder(false)
  })

  // Solve button runs target matching + direct match
  els.solveBtn.addEventListener('click', () => {
    if (targetMask) updateDirectMatch()
    updateFinder(true)
  })
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
      els.solveBtn.disabled = false
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
  const d = ctx.getImageData(0, 0, CELL, CELL).data
  const mask = new Uint8Array(CELL * CELL)
  for (let i = 0; i < mask.length; i++) {
    // Color-agnostic: any pixel with a dark channel is "ink"
    const minCh = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])
    mask[i] = minCh < 200 ? 1 : 0
  }
  return mask
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

  // Clear button
  const clearBtn = document.createElement('button')
  clearBtn.className = 'target-clear-btn'
  clearBtn.textContent = '\u00d7'
  clearBtn.title = 'Remove image'
  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    targetImage = null
    targetMask = null
    clearEl(els.targetPreview)
    clearEl(els.directMatch)
    els.dropZoneContent.style.display = ''
    els.targetPreview.style.display = 'none'
    els.dropZone.classList.remove('has-file')
    els.targetUpload.value = ''
    els.solveBtn.disabled = true
  })
  els.targetPreview.appendChild(clearBtn)

  // Hide the upload prompt, show preview
  els.dropZoneContent.style.display = 'none'
  els.targetPreview.style.display = 'flex'
}

function updateDirectMatch() {
  clearEl(els.directMatch)
  if (!targetMask) return

  // Try all fonts and keep best score per letter
  const bestByLetter = {}
  for (const { masks: m } of getAllFontMasks()) {
    for (const ch of ALPHABET) {
      const score = matchScore(m[ch], targetMask)
      if (!bestByLetter[ch] || score > bestByLetter[ch]) {
        bestByLetter[ch] = score
      }
    }
  }
  const results = Object.entries(bestByLetter).map(([ch, score]) => ({ ch, score }))
  results.sort((a, b) => b.score - a.score)

  const container = document.createElement('div')
  container.className = 'direct-match-box'

  const label = document.createElement('div')
  label.className = 'direct-match-label'
  label.textContent = 'Image looks like'

  const topMatches = document.createElement('div')
  topMatches.className = 'direct-match-results'

  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const r = results[i]
    const item = document.createElement('div')
    item.className = 'direct-match-item' + (i === 0 ? ' best' : '')

    const letter = document.createElement('span')
    letter.className = 'direct-match-letter'
    letter.textContent = r.ch

    const score = document.createElement('span')
    score.className = 'direct-match-score'
    score.textContent = `${(r.score * 100).toFixed(0)}%`

    item.appendChild(letter)
    item.appendChild(score)
    topMatches.appendChild(item)
  }

  container.appendChild(label)
  container.appendChild(topMatches)
  els.directMatch.appendChild(container)
}

export function updateFinder(solve = false) {
  clearEl(els.finderResult)
  clearEl(els.finderGrid)

  const known = parseLetter(els.knownLetter)
  if (!known) {
    const msg = document.createElement('p')
    msg.className = 'finder-empty'
    msg.textContent = 'Enter a known letter above to see all 26 AND combinations.'
    els.finderGrid.appendChild(msg)
    return
  }

  // Only use target matching when Solve was clicked
  const useTarget = solve && targetMask

  // Build all 26 AND combinations across all fonts (keep best per candidate)
  const fontSets = getAllFontMasks()
  const results = []

  for (const ch of ALPHABET) {
    // Always use the default font for the displayed AND canvas (keeps it stable)
    const displayMask = andMasks(fontSets[0].masks[known], fontSets[0].masks[ch])

    // Score across all fonts for target matching (only when solving)
    let bestTargetScore = null
    if (useTarget) {
      for (const { masks: m } of fontSets) {
        const maskAND = andMasks(m[known], m[ch])
        const score = matchScore(maskAND, targetMask)
        if (bestTargetScore === null || score > bestTargetScore) {
          bestTargetScore = score
        }
      }
    }

    // Find what this AND result looks like (compare display mask across all font libraries)
    let bestLooksLike = { ch: '?', score: 0 }
    for (const { masks: m } of fontSets) {
      const matches = findBestMatches(displayMask, m, 1)
      if (matches[0].score > bestLooksLike.score) {
        bestLooksLike = matches[0]
      }
    }

    results.push({
      ch,
      maskAND: displayMask,
      looksLike: bestLooksLike,
      targetScore: bestTargetScore,
    })
  }

  // Sort by target score only when solving
  if (useTarget) {
    results.sort((a, b) => b.targetScore - a.targetScore)
  }

  // Build card for each combination
  for (const r of results) {
    const card = document.createElement('div')
    card.className = 'finder-card'
    if (useTarget && r.targetScore > 0.7) {
      card.classList.add('high-match')
    }

    // Header: letter pair
    const header = document.createElement('div')
    header.className = 'card-header'
    header.innerHTML = `<span class="hl-a">${known}</span> & <span class="hl-b">${r.ch}</span>`
    card.appendChild(header)

    // AND result canvas
    card.appendChild(makeCanvas(r.maskAND, 34, 34, 34, 64))

    // What it looks like
    const looks = document.createElement('div')
    looks.className = 'card-looks'
    looks.innerHTML = `looks like <strong>${r.looksLike.ch}</strong>`
    card.appendChild(looks)

    // Target match score (only when solving)
    if (useTarget) {
      const score = document.createElement('div')
      score.className = 'card-score'
      score.textContent = `${(r.targetScore * 100).toFixed(0)}% match`
      card.appendChild(score)
    }

    // The candidate letter label
    const candidateLabel = document.createElement('div')
    candidateLabel.className = 'card-candidate'
    candidateLabel.textContent = r.ch
    card.appendChild(candidateLabel)

    els.finderGrid.appendChild(card)
  }

  // Enable/disable solve button
  els.solveBtn.disabled = !targetMask
}
