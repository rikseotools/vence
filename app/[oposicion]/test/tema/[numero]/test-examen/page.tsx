// app/[oposicion]/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'
import { getOposicion } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'

// On-demand ISR: shell 'use client' que carga datos via API.
// Pre-generar ~1,155 páginas no aporta nada (el HTML es un spinner).
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ oposicion: string; numero: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  return <TestExamenPage oposicionSlug={config.slug} params={params as unknown as Promise<{ numero: string }>} />
}
