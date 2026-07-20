'use client'

// components/TopicPrintButton.tsx
//
// Botón "Imprimir PDF" del temario + sus modales, unificado en un solo sitio.
// Antes este bloque estaba duplicado (copy-paste) en 111 ficheros TopicContentView.tsx
// con dos variantes (una con typos sin tildes). Aquí vive una vez.
//
// Comportamiento de handleDownload:
//   - sin sesión  → modal "Regístrate gratis" (lead-gen, igual que antes)
//   - con sesión  → descarga el PDF generado EN SERVIDOR (/api/temario/…/pdf)
//
// Antes llamaba a window.print(), que en iOS y en navegadores in-app (app de Google,
// Instagram…) no descargaba nada: el botón prometía un PDF que nunca existía. Ahora el PDF
// se genera en servidor y se descarga como fichero, así que funciona en cualquier navegador
// — por eso ya NO hace falta el muro "ábrelo en tu navegador".
//
// Sigue siendo GRATIS (solo pide registro, como antes): imprimir un tema ya era gratuito y
// capar lo que era gratis se percibiría como recorte. Lo premium será el temario COMPLETO.
//
// Observabilidad: emite 'temario_print_action' en cada rama.

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
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
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState(false)

  const emit = (action: string, extra?: Record<string, unknown>) =>
    emitClientEvent({
      severity: 'info',
      eventType: 'temario_print_action',
      metadata: { action, slug: oposicionFromLoginHref(loginHref), topic: topicNumber, ...extra },
    })

  const handleDownload = async () => {
    if (!user) {
      emit('register_prompt')
      setShowPrintModal(true)
      return
    }
    const slug = oposicionFromLoginHref(loginHref)
    if (!slug || topicNumber == null) {
      // Sin slug o sin tema no podemos pedir el PDF: degradamos a la impresión del
      // navegador en vez de dejar el botón muerto.
      emit('download_fallback_print')
      window.print()
      return
    }

    setDownloading(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/temario/${encodeURIComponent(slug)}/${topicNumber}/pdf`)
      // 413 = tema demasiado grande para generarlo en servidor (los "artículos-cajón" de
      // T-040). Degradamos a la impresión del navegador, que es lo que había antes: el
      // usuario no se queda sin nada.
      if (res.status === 413) {
        emit('download_too_large')
        window.print()
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()

      // Descarga vía blob + <a download>: funciona en iOS y en navegadores in-app,
      // que es justo donde window.print() no hacía nada.
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}-tema-${topicNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      emit('download', { ok: true })
    } catch (e) {
      setFailed(true)
      emit('download', { ok: false, error: e instanceof Error ? e.message : 'desconocido' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={downloading}
        aria-busy={downloading}
        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-wait"
      >
        {/* Icono de descarga (antes era una impresora: el botón ahora descarga un fichero). */}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
        </svg>
        {downloading ? 'Generando PDF…' : 'Descargar PDF'}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          No se pudo generar el PDF. Vuelve a intentarlo en unos segundos.
        </p>
      )}

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

    </>
  )
}
