// components/FraudTracker.js
// Generates a persistent device_id for ALL users (stored in localStorage).
// Mounted in root layout — runs on every page.

'use client'
import { useEffect } from 'react'

const DEVICE_ID_KEY = 'vence_device_id'

export default function FraudTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DEVICE_ID_KEY)) return

    localStorage.setItem(DEVICE_ID_KEY, crypto.randomUUID())
  }, [])

  return null
}
