'use client'

// components/TopicPrintButton.tsx
//
// Botón "Imprimir PDF" del temario + sus modales, unificado en un solo sitio.
// Antes este bloque estaba duplicado (copy-paste) en 111 ficheros TopicContentView.tsx
// con dos variantes (una con typos sin tildes). Aquí vive una vez.
//
// Comportamiento de handlePrint:
//   - sin sesión           → modal "Regístrate gratis" (lead-gen, igual que antes)
//   - navegador in-app      → modal "ábrelo en tu navegador" (antes: no-op silencioso)
//   - navegador normal      → window.print()
//
// Observabilidad: emite 'temario_print_action' en cada rama para dejar de estar ciegos
// (cuánta gente imprime, cuántos chocan con el muro in-app, si usan el apaño).

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { isInAppBrowser } from '@/lib/browser/inAppBrowser'
import { emitClientEvent } from '@/lib/observability/client'

interface TopicPrintButtonProps {
  /** Href completo de login con oposicion + return_to (ya presente en cada temario). */
  loginHref: string
  /** Nº de tema, solo para metadata de observabilidad. */
  topicNumber?: number
}

function oposicionFromLoginHref(href: string): string | null {
  const m = href.match(/[?&]oposicion=([^&]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function TopicPrintButton({ loginHref, topicNumber }: TopicPrintButtonProps) {
  const { user } = useAuth() as { user: any }
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [showInAppModal, setShowInAppModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const emit = (action: string, extra?: Record<string, unknown>) =>
    emitClientEvent({
      severity: 'info',
      eventType: 'temario_print_action',
      metadata: { action, slug: oposicionFromLoginHref(loginHref), topic: topicNumber, ...extra },
    })

  const handlePrint = () => {
    if (!user) {
      emit('register_prompt')
      setShowPrintModal(true)
      return
    }
    // Los navegadores embebidos (app de Google, Instagram, Facebook…) bloquean
    // window.print() en silencio → en vez de un no-op, avisamos de cómo descargar.
    if (isInAppBrowser()) {
      emit('inapp_blocked')
      setLinkCopied(false)
      setShowInAppModal(true)
      return
    }
    emit('print')
    window.print()
  }

  const copyPageLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      emit('copy_link', { ok: true })
    } catch {
      setLinkCopied(false)
      emit('copy_link', { ok: false })
    }
  }

  return (
    <>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Imprimir PDF
      </button>

      {/* Sin sesión: captación de email (lead-gen) */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Descarga el temario en PDF
              </h3>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Regístrate gratis para descargar el PDF y recibir actualizaciones cuando cambie la legislación.
              </p>

              <div className="space-y-3">
                <Link
                  href={loginHref}
                  className="block w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Registrarse gratis
                </Link>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="block w-full py-3 px-4 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Quizás más tarde
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navegador embebido (in-app) que bloquea la descarga del PDF */}
      {showInAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowInAppModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Cerrar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Ábrelo en tu navegador para descargar el PDF
              </h3>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Estás viendo esta página dentro de otra app (Google, Instagram, Facebook…), y ese
                navegador no permite descargar el PDF. Abre esta página en Safari o Chrome: toca el
                menú (⋯ o los tres puntos) y elige <span className="font-medium">«Abrir en el navegador»</span>.
              </p>

              <div className="space-y-3">
                <button
                  onClick={copyPageLink}
                  className="block w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {linkCopied ? '✓ Enlace copiado' : 'Copiar enlace'}
                </button>

                <button
                  onClick={() => setShowInAppModal(false)}
                  className="block w-full py-3 px-4 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
