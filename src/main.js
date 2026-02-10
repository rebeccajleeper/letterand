// Entry point — wires up combiner, finder, auth, and word mode

import './style.css'
import { initElements, updateCombiner, setupFinder, updateFinder } from './ui.js'
import { isUnlocked, getEmail, unlock, checkEmail, startCheckout, logout } from './auth.js'
import { initWordMode, updateWordMode } from './word-mode.js'

document.addEventListener('DOMContentLoaded', async () => {
  initElements()
  setupFinder()

  // Combiner inputs
  const letterA = document.getElementById('letterA')
  const letterB = document.getElementById('letterB')
  letterA.addEventListener('input', updateCombiner)
  letterB.addEventListener('input', updateCombiner)

  // Initial render
  updateCombiner()
  updateFinder()

  // ── Auth + Word Mode ───────────────────────────────
  initWordMode()

  const paywallOverlay = document.getElementById('paywallOverlay')
  const paywallEmail = document.getElementById('paywallEmail')
  const paywallBuyBtn = document.getElementById('paywallBuyBtn')
  const paywallSigninBtn = document.getElementById('paywallSigninBtn')
  const paywallStatus = document.getElementById('paywallStatus')
  const wordUnlocked = document.getElementById('wordUnlocked')
  const wordEmailEl = document.getElementById('wordEmail')
  const wordLogoutBtn = document.getElementById('wordLogoutBtn')
  const lockIcon = document.getElementById('lockIcon')
  const wordA = document.getElementById('wordA')
  const wordB = document.getElementById('wordB')

  function setUnlockedUI() {
    paywallOverlay.style.display = 'none'
    wordUnlocked.style.display = 'flex'
    lockIcon.innerHTML = '&#x1F513;'
    wordA.disabled = false
    wordB.disabled = false
    const email = getEmail()
    if (email) wordEmailEl.textContent = email
  }

  function setLockedUI() {
    paywallOverlay.style.display = 'flex'
    wordUnlocked.style.display = 'none'
    lockIcon.innerHTML = '&#x1F512;'
    wordA.disabled = true
    wordB.disabled = true
  }

  function setStatus(msg, isError) {
    paywallStatus.textContent = msg
    paywallStatus.className = 'paywall-status' + (isError ? ' paywall-error' : '')
  }

  // Check for returning from Stripe Checkout
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('session_id')
  if (sessionId) {
    setStatus('Verifying payment...', false)
    try {
      const result = await unlock(sessionId)
      if (result.access) {
        setUnlockedUI()
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname)
      } else {
        setStatus('Payment not confirmed yet. Please try again.', true)
      }
    } catch {
      setStatus('Error verifying payment. Please try again.', true)
    }
  } else if (isUnlocked()) {
    setUnlockedUI()
  } else {
    setLockedUI()
  }

  // Buy button
  paywallBuyBtn.addEventListener('click', async () => {
    const email = paywallEmail.value.trim()
    if (!email || !email.includes('@')) {
      setStatus('Please enter a valid email address.', true)
      return
    }
    paywallBuyBtn.disabled = true
    paywallBuyBtn.textContent = 'Redirecting...'
    setStatus('', false)
    try {
      await startCheckout(email)
    } catch {
      setStatus('Error starting checkout. Please try again.', true)
      paywallBuyBtn.disabled = false
      paywallBuyBtn.textContent = 'Unlock Word Mode'
    }
  })

  // Sign in with email (already purchased or admin)
  const paywallPassword = document.getElementById('paywallPassword')
  paywallSigninBtn.addEventListener('click', async () => {
    const email = paywallEmail.value.trim()
    const password = paywallPassword.value
    if (!email) {
      setStatus('Please enter your email address above first.', true)
      return
    }
    paywallSigninBtn.disabled = true
    paywallSigninBtn.textContent = 'Checking...'
    setStatus('', false)
    try {
      const result = await checkEmail(email, password)
      if (result.access) {
        setUnlockedUI()
      } else {
        setStatus('No purchase found for this email. Try a different email or purchase below.', true)
      }
    } catch {
      setStatus('Error checking access. Please try again.', true)
    }
    paywallSigninBtn.disabled = false
    paywallSigninBtn.textContent = 'Already purchased? Sign in'
  })

  // Logout
  wordLogoutBtn.addEventListener('click', () => {
    logout()
    setLockedUI()
    paywallEmail.value = ''
    setStatus('', false)
  })
})
