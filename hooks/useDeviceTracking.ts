// hooks/useDeviceTracking.ts
// Device ID management — generates/retrieves a persistent UUID per browser.

'use client'

const DEVICE_ID_KEY = 'vence_device_id'

export function getOrCreateDeviceId(): string | null {
  if (typeof window === 'undefined') return null

  let id = localStorage.getItem(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DEVICE_ID_KEY)
}
