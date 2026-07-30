'use client'
// components/FavoriteQuestionButton.tsx
// Corazón para guardar una pregunta y repasarla después (T-261).
// Petición de Laura Zurdo (feedback 46372450, 28/07/2026).
//
// Diseño:
//  · OPTIMISTA con reversión: el corazón responde al instante y, si el servidor
//    falla, vuelve a su estado real y se avisa. Nada de spinners en un gesto de 1 clic.
//  · El servidor fija el estado FINAL (marcar/desmarcar explícito, no "alternar"),
//    así dos pestañas abiertas no se pelean.
//  · Sin sesión no se pinta: marcar exige cuenta y un corazón que no funciona
//    frustra más que su ausencia.
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../lib/api/authHeaders'

interface Props {
  questionId: string | null | undefined
  /** Estado inicial conocido (p.ej. en el repaso de favoritas todas empiezan marcadas). */
  initialIsFavorite?: boolean
  /**
   * Dónde está guardándola (oposición y tema). Se manda al servidor porque DESPUÉS
   * no se puede reconstruir: la misma pregunta vive en temas distintos según la
   * oposición. Ausente en tests por leyes o en el propio repaso de guardadas.
   */
  positionType?: string | null
  topicNumber?: number | null
  className?: string
}

export default function FavoriteQuestionButton({
  questionId,
  initialIsFavorite = false,
  positionType = null,
  topicNumber = null,
  className = '',
}: Props) {
  const { user } = useAuth() as { user: { id: string } | null }
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)

  // El estado SIGUE a la pregunta. `useState(initialIsFavorite)` solo se evalúa en el
  // primer render, y en un test React reutiliza esta misma instancia al pasar de pregunta
  // (se monta sin `key`), así que el corazón se quedaba con el estado de la ANTERIOR: salía
  // rojo en preguntas no marcadas y había que pulsarlo dos veces, la primera para deshacer
  // lo heredado. Lo reportó Laura Zurdo el 29/07/2026, el día del estreno.
  //
  // Se sincroniza por `questionId` además de por el valor: dos preguntas seguidas pueden
  // compartir estado (ambas sin marcar) y aun así hay que reiniciar al cambiar de pregunta.
  useEffect(() => {
    setIsFavorite(initialIsFavorite)
  }, [questionId, initialIsFavorite])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(false)

  const alternar = useCallback(async () => {
    if (!questionId || enviando) return

    const deseado = !isFavorite
    setIsFavorite(deseado) // optimista
    setEnviando(true)
    setError(false)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v2/question-favorites', {
        method: deseado ? 'POST' : 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          ...(deseado && positionType ? { positionType } : {}),
          ...(deseado && topicNumber ? { topicNumber } : {}),
        }),
      })
      if (!res.ok) throw new Error(`question-favorites ${res.status}`)
      const json = await res.json()
      // El servidor manda: si por lo que sea difiere, gana él.
      if (typeof json?.isFavorite === 'boolean') setIsFavorite(json.isFavorite)
    } catch {
      setIsFavorite(!deseado) // revertir
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setEnviando(false)
    }
  }, [questionId, isFavorite, enviando, positionType, topicNumber])

  if (!user || !questionId) return null

  const etiqueta = isFavorite ? 'Quitar de guardadas' : 'Guardar esta pregunta'

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={enviando}
      aria-pressed={isFavorite}
      aria-label={etiqueta}
      title={error ? 'No se pudo guardar, inténtalo otra vez' : etiqueta}
      className={`shrink-0 rounded-full p-2 text-xl leading-none transition-all duration-200 hover:scale-110 disabled:opacity-60 ${
        isFavorite
          ? 'text-red-500 hover:text-red-600'
          : 'text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400'
      } ${className}`}
    >
      {isFavorite ? '❤️' : '🤍'}
    </button>
  )
}
