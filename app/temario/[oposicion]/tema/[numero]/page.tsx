// app/temario/[oposicion]/tema/[numero]/page.tsx
import { notFound } from 'next/navigation'
import { getTopicContent } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'
import TopicContentView from './TopicContentView'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    oposicion: string
    numero: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { oposicion, numero } = await params
  const oposicionConfig = OPOSICIONES[oposicion as OposicionSlug]

  if (!oposicionConfig) {
    return { title: 'Temario no encontrado' }
  }

  return {
    title: `Tema ${numero} - ${oposicionConfig.name} | Vence.es`,
    description: `Contenido teórico del Tema ${numero} para la oposición de ${oposicionConfig.name}`,
  }
}

export default async function TemarioTemaPage({ params }: PageProps) {
  const { oposicion, numero } = await params

  // Validar oposición
  if (!OPOSICIONES[oposicion as OposicionSlug]) {
    notFound()
  }

  // Validar número de tema
  const topicNumber = parseInt(numero)
  if (isNaN(topicNumber) || topicNumber < 1) {
    notFound()
  }

  // Obtener contenido (sin userId por ahora - es server component)
  const topicContent = await getTopicContent(oposicion as OposicionSlug, topicNumber)

  if (!topicContent) {
    notFound()
  }

  return <TopicContentView content={topicContent} />
}
