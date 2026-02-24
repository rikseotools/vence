// app/unsubscribe/page.js - Página pública de unsubscribe sin login requerido
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  {
    id: 'marketing',
    label: 'Emails de Vence',
    description: 'Reactivacion, bienvenida, motivacion, resumen semanal, medallas, mejoras de producto',
    color: 'blue',
  },
  {
    id: 'newsletter',
    label: 'Newsletter y novedades',
    description: 'Boletines, alertas BOE, novedades de tu oposicion',
    color: 'purple',
  },
  {
    id: 'soporte',
    label: 'Soporte y transaccional',
    description: 'Respuestas a impugnaciones, soporte tecnico, recordatorio de renovacion',
    color: 'orange',
  },
]

function UnsubscribePageContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const [showConfirmAll, setShowConfirmAll] = useState(false)
  const [tokenCategory, setTokenCategory] = useState(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setMessage('Token de unsubscribe no valido o expirado.')
      return
    }
    validateToken()
  }, [token])

  const validateToken = async () => {
    try {
      const response = await fetch('/api/unsubscribe/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const result = await response.json()

      if (result.success) {
        setEmail(result.email)
        const category = result.user?.category || 'marketing'
        setTokenCategory(category)
        setSelectedCategories(new Set([category]))
        setStatus('ready')
      } else {
        setStatus('invalid')
        setMessage(result.error || 'Token invalido o expirado')
      }
    } catch (error) {
      console.error('Error validando token:', error)
      setStatus('error')
      setMessage('Error validando el enlace de unsubscribe')
    }
  }

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const handleUnsubscribeSelected = async () => {
    if (selectedCategories.size === 0) return
    setStatus('loading')

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          categories: Array.from(selectedCategories),
        })
      })

      const result = await response.json()

      if (result.success) {
        const names = Array.from(selectedCategories).map(
          id => CATEGORIES.find(c => c.id === id)?.label
        ).filter(Boolean)
        setStatus('success')
        setMessage(`Has desactivado: ${names.join(', ')}. No recibiras mas esos emails.`)
      } else {
        setStatus('error')
        setMessage(result.error || 'Error procesando la baja de emails')
      }
    } catch (error) {
      console.error('Error en unsubscribe:', error)
      setStatus('error')
      setMessage('Error procesando la solicitud')
    }
  }

  const handleConfirmUnsubscribeAll = async () => {
    setStatus('loading')
    setShowConfirmAll(false)

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          unsubscribeAll: true,
        })
      })

      const result = await response.json()

      if (result.success) {
        setStatus('success')
        setMessage('Te has dado de baja de TODOS los emails. No recibiras mas emails automaticos.')
      } else {
        setStatus('error')
        setMessage(result.error || 'Error procesando la baja de emails')
      }
    } catch (error) {
      console.error('Error en unsubscribe:', error)
      setStatus('error')
      setMessage('Error procesando la solicitud')
    }
  }

  // --- RENDER STATES ---

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Procesando...</h2>
          <p className="text-gray-600">Validando enlace de unsubscribe</p>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Enlace No Valido</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <Link
            href="/perfil?tab=emails"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir a Mi Perfil
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Completado</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="space-y-3">
            <Link
              href="/perfil?tab=emails"
              className="block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ver Mis Preferencias
            </Link>
            <Link
              href="/es"
              className="block bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Ir a Vence.es
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // --- READY STATE: Category selection ---
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestionar Emails</h1>
          <p className="text-gray-600">
            Email: <span className="font-semibold">{email}</span>
          </p>
        </div>

        {/* Category selection */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Selecciona que categorias quieres desactivar:
          </p>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.has(cat.id)
              const isFromToken = cat.id === tokenCategory
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{cat.label}</span>
                        {isFromToken && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                            Este email
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Disable selected button */}
        <button
          onClick={handleUnsubscribeSelected}
          disabled={selectedCategories.size === 0}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors mb-4 ${
            selectedCategories.size > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Desactivar seleccionados ({selectedCategories.size})
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-400">o</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Nuclear option */}
        <button
          onClick={() => setShowConfirmAll(true)}
          className="w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-semibold"
        >
          Desactivar TODOS los emails
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          No recibiras ningun email automatico de Vence.es
        </p>

        {/* Confirm all modal */}
        {showConfirmAll && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Estas seguro?</h3>
                <p className="text-gray-600 mb-4">
                  Desactivar <strong>todos los emails</strong> significa que no recibiras alertas, novedades ni respuestas de soporte por email.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleConfirmUnsubscribeAll}
                  className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
                >
                  Si, desactivar todos
                </button>
                <button
                  onClick={() => setShowConfirmAll(false)}
                  className="w-full bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-6">
          <p>Siempre puedes cambiar tus preferencias desde tu perfil.</p>
          <Link
            href="/perfil?tab=emails"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Ir a Mi Perfil
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Cargando pagina...
          </h2>
        </div>
      </div>
    }>
      <UnsubscribePageContent />
    </Suspense>
  )
}
