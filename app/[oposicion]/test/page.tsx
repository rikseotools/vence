// app/[oposicion]/test/page.tsx - Test hub dinámico
import TestHubPage from '@/components/test/TestHubPage'
import { getOposicion } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// force-dynamic: TestHubPage hace queries pesadas (theme counts) que
// causan timeout en build con 3600+ páginas concurrentes
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}
  return {
    title: `Tests ${config.name} | Vence`,
    description: `Tests de preparación para ${config.name}. ${config.totalTopics} temas con preguntas tipo test.`,
  }
}

export default async function Page({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  return <TestHubPage oposicion={config.slug} />
}
