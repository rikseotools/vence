// app/[oposicion]/test/page.tsx - Test hub dinámico
import TestHubPage from '@/components/test/TestHubPage'
import { getOposicion, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export function generateStaticParams() {
  return ALL_OPOSICION_SLUGS.map(slug => ({ oposicion: slug }))
}

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
