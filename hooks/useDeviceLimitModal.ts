// hooks/useDeviceLimitModal.ts
// Hook reutilizable para gestionar el modal de límite de dispositivos.
// Se usa en TestLayout, PsychometricTestLayout, DynamicTest.

import { useState, useEffect, useCallback, useRef } from 'react'

// Evento global que emite answerSaveQueue cuando detecta 403 deviceLimitReached
const DEVICE_LIMIT_EVENT = 'vence:deviceLimitReached'

export function dispatchDeviceLimitEvent() {
  window.dispatchEvent(new CustomEvent(DEVICE_LIMIT_EVENT))
}

export function useDeviceLimitModal() {
  const [isOpen, setIsOpen] = useState(false)
  const retryFnRef = useRef<(() => void) | null>(null)

  // Abrir el modal con una función de reintento opcional
  const openDeviceLimitModal = useCallback((retryFn?: () => void) => {
    retryFnRef.current = retryFn ?? null
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const retry = useCallback(() => {
    setIsOpen(false)
    if (retryFnRef.current) {
      retryFnRef.current()
      retryFnRef.current = null
    }
  }, [])

  // Escuchar evento global de la queue
  useEffect(() => {
    const handler = () => openDeviceLimitModal()
    window.addEventListener(DEVICE_LIMIT_EVENT, handler)
    return () => window.removeEventListener(DEVICE_LIMIT_EVENT, handler)
  }, [openDeviceLimitModal])

  return {
    isDeviceLimitOpen: isOpen,
    openDeviceLimitModal,
    closeDeviceLimit: close,
    retryAfterDeviceRemoval: retry,
  }
}
