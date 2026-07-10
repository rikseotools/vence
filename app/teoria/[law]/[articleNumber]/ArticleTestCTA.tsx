'use client'
// app/teoria/[law]/[articleNumber]/ArticleTestCTA.tsx
//
// CTA "Hacer test de este artículo" del lector individual. Es CLIENTE a propósito:
// el nº de preguntas que el test servirá depende de la OPOSICIÓN del usuario
// (filtro de oficiales + tag de oposición), que solo se conoce en cliente
// (useOposicion) — igual que LawTestPageWrapper. Consulta el endpoint SSOT
// (/test-count), que reusa el MISMO núcleo que sirve el test, así que el botón
// aparece EXACTAMENTE cuando el test tendrá preguntas para ESTE usuario (cero
// dead-ends) y muestra el nº real. Superficie del bug de manuel izquierdo.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useOposicion } from '@/contexts/OposicionContext'
import { ID_TO_POSITION_TYPE } from '@/lib/config/oposiciones'
import { buildArticleTestLink } from '@/lib/navigation/backToArticleLink'

const DEFAULT_POSITION_TYPE = 'auxiliar_administrativo_estado'

interface ArticleTestCTAProps {
  lawSlug: string
  articleNumber: number
}

export default function ArticleTestCTA({ lawSlug, articleNumber }: ArticleTestCTAProps) {
  const { oposicionId } = useOposicion()
  const positionType =
    (oposicionId && ID_TO_POSITION_TYPE[oposicionId]) || DEFAULT_POSITION_TYPE

  // null = cargando (no pintar nada para no parpadear); número = resuelto.
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!Number.isInteger(articleNumber) || articleNumber <= 0) {
      setCount(0)
      return
    }
    let alive = true
    setCount(null)
    fetch(
      `/api/teoria/${lawSlug}/${articleNumber}/test-count?positionType=${encodeURIComponent(positionType)}`,
    )
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => {
        if (alive) setCount(typeof d?.count === 'number' ? d.count : 0)
      })
      .catch(() => {
        if (alive) setCount(0)
      })
    return () => {
      alive = false
    }
  }, [lawSlug, articleNumber, positionType])

  if (count === null || count <= 0) return null

  return (
    <div className="mb-8 flex justify-center">
      <Link
        href={buildArticleTestLink(lawSlug, articleNumber)}
        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
      >
        🎯 Hacer test de este artículo
        <span className="text-blue-100 font-normal">
          ({count} pregunta{count !== 1 ? 's' : ''})
        </span>
      </Link>
    </div>
  )
}
