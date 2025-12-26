'use client'
import { useState } from 'react'

export default function TelegramLogin({ session, onSuccess }) {
  const [step, setStep] = useState('phone') // phone, code, 2fa
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneCodeHash, setPhoneCodeHash] = useState('') // Guardamos el hash
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSendCode(e) {
    e.preventDefault()
    if (!phoneNumber.trim()) return

    if (!session?.access_token) {
      setError('Sesion no disponible. Recarga la pagina.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/marca/telegram/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      })

      const data = await res.json()

      console.log('Respuesta de enviar codigo:', data)

      if (data.success) {
        setPhoneCodeHash(data.phoneCodeHash) // Guardar el hash
        setStep('code')
      } else {
        setError(data.error || 'Error enviando codigo')
      }
    } catch (err) {
      console.error('Error en fetch:', err)
      setError('Error de conexion: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/marca/telegram/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          phoneNumber: phoneNumber.trim(),
          phoneCodeHash: phoneCodeHash,
          password: password || undefined,
        }),
      })

      const data = await res.json()

      if (data.error === '2FA_REQUIRED') {
        setStep('2fa')
        setError('')
      } else if (data.success) {
        onSuccess?.()
      } else {
        setError(data.error || 'Error verificando codigo')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify2FA(e) {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/marca/telegram/auth', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code: code.trim(),
          phoneNumber: phoneNumber.trim(),
          phoneCodeHash: phoneCodeHash,
          password: password.trim(),
        }),
      })

      const data = await res.json()

      if (data.success) {
        onSuccess?.()
      } else {
        setError(data.error || 'Error verificando contrasena')
      }
    } catch (err) {
      setError('Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-blue-600 dark:text-blue-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.015-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.1.154.232.17.331.016.099.036.322.021.496z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Conectar Telegram
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === 'phone' && 'Introduce tu numero de telefono con codigo de pais'}
            {step === 'code' && 'Introduce el codigo que recibiste en Telegram'}
            {step === '2fa' && 'Introduce tu contrasena de verificacion en dos pasos'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Step 1: Phone */}
        {step === 'phone' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Numero de telefono
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+34612345678"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Incluye el codigo de pais (ej: +34 para Espana)
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !phoneNumber.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar Codigo'}
            </button>
          </form>
        )}

        {/* Step 2: Code */}
        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Codigo de verificacion
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345"
                maxLength={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Revisa tu app de Telegram, te hemos enviado un codigo
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verificando...' : 'Verificar Codigo'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError('')
              }}
              className="w-full py-2 px-4 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cambiar numero
            </button>
          </form>
        )}

        {/* Step 3: 2FA */}
        {step === '2fa' && (
          <form onSubmit={handleVerify2FA} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contrasena 2FA
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contrasena de verificacion en dos pasos"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                Esta es la contrasena que configuraste en Telegram para verificacion en dos pasos
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Verificando...' : 'Iniciar Sesion'}
            </button>
          </form>
        )}
      </div>

      {/* Nota de seguridad */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Tu sesion se almacena de forma segura y encriptada.
          Solo se usa para monitorizar grupos y enviar respuestas desde tu cuenta.
        </p>
      </div>
    </div>
  )
}
