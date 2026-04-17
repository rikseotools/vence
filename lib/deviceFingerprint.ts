// lib/deviceFingerprint.ts — Hardware-based fingerprint that survives localStorage clear
// Combines screen, GPU, timezone, language into a stable hash.

const FINGERPRINT_KEY = 'vence_hw_fingerprint'

export function getOrCreateHardwareFingerprint(): string {
  if (typeof window === 'undefined') return ''

  const cached = localStorage.getItem(FINGERPRINT_KEY)
  if (cached) return cached

  const fp = computeFingerprint()
  localStorage.setItem(FINGERPRINT_KEY, fp)
  return fp
}

export function getHardwareFingerprint(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(FINGERPRINT_KEY) || computeFingerprint()
}

function computeFingerprint(): string {
  const signals = [
    `${screen.width}x${screen.height}`,
    String(window.devicePixelRatio || 1),
    String(screen.colorDepth || 24),
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    navigator.language || '',
    String(navigator.hardwareConcurrency || 0),
    String(navigator.maxTouchPoints || 0),
    getCanvasFingerprint(),
  ]

  return simpleHash(signals.join('|'))
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 50
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.fillStyle = '#f60'
    ctx.fillRect(50, 0, 100, 50)
    ctx.fillStyle = '#069'
    ctx.fillText('Vence.es', 2, 15)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('Vence.es', 4, 17)

    return canvas.toDataURL().slice(-50)
  } catch {
    return ''
  }
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'hw_' + Math.abs(hash).toString(36)
}
