// app/[oposicion]/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'
import { getOposicion } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'

// On-demand ISR: estas páginas son shells 'use client' (solo un spinner)
// que cargan datos via API client-side. Pre-generarlas no aporta nada
// y añade ~1,155 páginas al build (41 oposiciones × ~28 temas).
// dynamicParams = true (default) permite que cualquier combinación válida funcione.
export function generateStaticParams() {
  return []
}

export default async function Page({ params }: { params: Promise<{ oposicion: string; numero: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  // Pass the full params promise so TemaTestPage can await it
  return <TemaTestPage oposicionSlug={config.slug} params={params as unknown as Promise<{ numero: string }>} />
}
