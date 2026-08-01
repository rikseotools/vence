// app/oposicion-personalizada/[id]/temario/[slug]/page.tsx — leer un tema propio. (T-327)
//
// Es el destino de los enlaces del temario («tema-1», «tema-2»…). Lo descubrió el rastreador de
// rutas: arreglé la página del temario y sus enlaces internos seguían dando 404, que es
// exactamente el tipo de agujero que comprobando a mano no se ve.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTopicContent } from '@/lib/api/temario/queries'
import TopicContentView from '@/app/administrativo-estado/temario/[slug]/TopicContentView'
import { formatUpdatedAt } from '@/lib/temario/updatedAt'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tu temario | Vence',
  robots: { index: false, follow: false },
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>
}) {
  const { id, slug } = await params
  const limpio = String(id).replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(limpio)) notFound()

  const m = slug.match(/^tema-(\d+)$/)
  if (!m) notFound()

  // Se le pasa el `position_type` donde el catálogo pasa el slug: la query lo reconoce y lo usa
  // tal cual (ver `getTopicContentBaseInternal`).
  const content = await getTopicContent(
    `personalizada_${limpio}` as never,
    parseInt(m[1], 10),
  )
  if (!content) notFound()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopicContentView content={content} updatedAt={formatUpdatedAt()} />
    </div>
  )
}
