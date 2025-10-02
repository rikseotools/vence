// app/unsubscribe/page.js - Página pública de unsubscribe sin login requerido
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function UnsubscribePageContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('loading') // loading, success, error, invalid
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  
  // Obtener parámetros de la URL
  const token = searchParams.get('token')
  const emailParam = searchParams.get('email')

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      setMessage('Token de unsubscribe no válido o expirado.')
      return
    }

    // Validar token automáticamente
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
        setStatus('ready')
        setMessage('¿Qué tipos de email quieres desactivar?')
      } else {
        setStatus('invalid')
        setMessage(result.error || 'Token inválido o expirado')
      }
    } catch (error) {
      console.error('Error validando token:', error)
      setStatus('error')
      setMessage('Error validando el enlace de unsubscribe')
    }
  }

  const handleUnsubscribe = async () => {
    setStatus('loading')

    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token,
          unsubscribeAll: true,
          specificTypes: null
        })
      })

      const result = await response.json()

      if (result.success) {
        setStatus('success')
        setMessage('✅ Te has dado de baja de TODOS los emails correctamente. No recibirás más emails automáticos.')
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Enlace No Válido</h2>
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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">¡Completado!</h2>
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

  // Estado 'ready' - Mostrar opciones de unsubscribe
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
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

        <div className="space-y-4 mb-6">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <h3 className="font-semibold text-yellow-800 mb-4">¿Quieres dejar de recibir emails?</h3>
            <button
              onClick={handleUnsubscribe}
              className="w-full bg-red-600 text-white px-6 py-4 rounded-lg hover:bg-red-700 transition-colors font-semibold text-lg"
            >
              🚫 Desactivar TODOS los emails
            </button>
            <p className="text-sm text-yellow-700 mt-3">
              No recibirás más emails automáticos de Vence.es
            </p>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🔄 Cargando página...
          </h2>
        </div>
      </div>
    }>
      <UnsubscribePageContent />
    </Suspense>
  )
}