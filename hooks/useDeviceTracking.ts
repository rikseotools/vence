// hooks/useDeviceTracking.ts
// Device ID management — generates/retrieves a persistent UUID per browser.

'use client'
import { safeGet, safeSet } from '@/lib/storage/safeLocalStorage'

const DEVICE_ID_KEY = 'vence_device_id'

export function getOrCreateDeviceId(): string | null {
  if (typeof window === 'undefined') return null

  let id = safeGet(DEVICE_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    safeSet(DEVICE_ID_KEY, id)
  }
  return id
}

export function getDeviceId(): string | null {
  if (typeof window === 'undefined') return null
  return safeGet(DEVICE_ID_KEY)
}
