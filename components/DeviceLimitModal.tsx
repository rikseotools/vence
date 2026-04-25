'use client'
// components/DeviceLimitModal.tsx
// Modal que aparece cuando el usuario alcanza el límite de dispositivos.
// Lista los dispositivos conectados y permite desconectar uno.

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { logClientError } from '@/lib/logClientError'

interface DeviceInfo {
  id: string
  deviceLabel: string | null
  lastSeenAt: string
}

interface DeviceLimitModalProps {
  isOpen: boolean
  onClose: () => void
  onRetry: () => void
}

export default function DeviceLimitModal({
  isOpen,
  onClose,
  onRetry,
}: DeviceLimitModalProps) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v2/devices', { headers })
      const data = await res.json()
      if (data.success) {
        setDevices(data.devices)
      } else {
        setError('No se pudieron cargar los dispositivos')
        logClientError('/api/v2/devices', new Error(`GET devices failed: ${JSON.stringify(data)}`), {
          component: 'DeviceLimitModal',
          severity: 'warning',
        })
      }
    } catch (err) {
      setError('Error de conexion')
      logClientError('/api/v2/devices', err, {
        component: 'DeviceLimitModal',
        severity: 'warning',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) fetchDevices()
  }, [isOpen, fetchDevices])

  const handleRemove = async (deviceId: string) => {
    try {
      setRemoving(deviceId)
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v2/devices', {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      })
      const data = await res.json()
      if (data.success && data.removed) {
        // Desconectado — cerrar modal y reintentar la acción
        onClose()
        onRetry()
      } else {
        setError('No se pudo desconectar el dispositivo')
        logClientError('/api/v2/devices', new Error(`DELETE device failed: ${JSON.stringify(data)}`), {
          component: 'DeviceLimitModal',
          severity: 'warning',
        })
        await fetchDevices()
      }
    } catch (err) {
      setError('Error de conexion')
      logClientError('/api/v2/devices', err, {
        component: 'DeviceLimitModal',
        severity: 'warning',
      })
    } finally {
      setRemoving(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'Hoy'
      if (diffDays === 1) return 'Ayer'
      if (diffDays < 7) return `Hace ${diffDays} dias`
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
    } catch {
      return ''
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Limite de dispositivos
              </h2>
              <p className="text-white/80 text-sm">
                Desconecta uno para usar este dispositivo
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {loading ? (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              Cargando dispositivos...
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Ya tienes {devices.length} dispositivos conectados. Desconecta uno para poder usar este:
              </p>

              <div className="space-y-3 mb-4">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {(device.deviceLabel || '').toLowerCase().includes('android') || (device.deviceLabel || '').toLowerCase().includes('ios') ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          )}
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {device.deviceLabel || 'Dispositivo desconocido'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Ultima conexion: {formatDate(device.lastSeenAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(device.id)}
                      disabled={removing !== null}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {removing === device.id ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm mb-4">
                  {error}
                </div>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
          >
            Cerrar
          </button>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 text-center">
            Puedes conectar hasta 2 dispositivos simultáneamente.
          </p>
        </div>
      </div>
    </div>
  )
}
