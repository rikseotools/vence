// app/oposicion-personalizada/[id]/temario/[slug]/page.tsx — leer un tema propio. (T-327)
//
// Es el destino de los enlaces del temario («tema-1», «tema-2»…). Lo descubrió el rastreador de
// rutas: arreglé la página del temario y sus enlaces internos seguían dando 404, que es
// exactamente el tipo de agujero que comprobando a mano no se ve.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTopicContent, getTemarioByPositionType } from '@/lib/api/temario/queries'
import TopicContentView from '@/components/temario/TopicContentView'
import { formatUpdatedAt } from '@/lib/temario/updatedAt'
import { raizPersonalizada } from '@/lib/oposicion/objetivoPersonalizado'

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
  const objetivo = `personalizada_${limpio}`
  const content = await getTopicContent(objetivo as never, parseInt(m[1], 10))
  if (!content) notFound()

  // El `basePath` va EXPLÍCITO. Sin él, `TopicContentView` cae en su valor por defecto
  // (`administrativo-estado`, la oposición de la que se reutiliza el componente) y los cuatro
  // enlaces de esta pantalla —tema anterior, tema siguiente, «Volver al índice» y «Practicar
  // este tema»— sacan al usuario a OTRA oposición sin dar ningún error. [T-541]
  const raiz = raizPersonalizada(objetivo)!

  // Los temas que EXISTEN, para que el pie no ofrezca un «Tema siguiente» que da 404. Con los
  // enlaces mal apuntados esto no se notaba: el tema siguiente existía en la otra oposición.
  // La consulta está cacheada (es la misma que pinta el índice del temario). [T-541]
  const temario = await getTemarioByPositionType(objetivo)
  const temasExistentes = temario?.bloques.flatMap((b) => b.temas.map((t) => t.id)) ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopicContentView
        content={content}
        basePath={raiz}
        temasExistentes={temasExistentes}
        updatedAt={formatUpdatedAt()}
      />
    </div>
  )
}
