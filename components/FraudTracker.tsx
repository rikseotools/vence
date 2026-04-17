// components/FraudTracker.tsx
// Generates persistent device_id + hardware fingerprint for ALL users.
// Mounted in root layout — runs on every page.

'use client'
import { useEffect } from 'react'
import { getOrCreateHardwareFingerprint } from '@/lib/deviceFingerprint'

const DEVICE_ID_KEY = 'vence_device_id'

export default function FraudTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!localStorage.getItem(DEVICE_ID_KEY)) {
      localStorage.setItem(DEVICE_ID_KEY, crypto.randomUUID())
    }

    getOrCreateHardwareFingerprint()
  }, [])

  return null
}
