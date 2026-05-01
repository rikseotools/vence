// app/[oposicion]/test/aleatorio/page.tsx - Template dinámico de Test Aleatorio
//
// Cubre todas las oposiciones a /<slug>/test/aleatorio con un único archivo.
// Si una oposición necesita lógica custom: crear app/<slug>/test/aleatorio/page.tsx
// con su implementación; Next.js da prioridad al estático sobre el dinámico
// (mismo patrón documentado en app/[oposicion]/page.tsx:1-4).
//
// force-dynamic: getThemeQuestionCounts es una query 4-way JOIN cara que
// satura el build SSG con 35+ oposiciones × 60s timeout (causa raíz del
// build fallido d3d4d5e). Las queries internas se cachean con tag
// 'test-counts' (random-test/queries.ts:78-87), así que las visitas tras
// la primera son 0 queries DB.
import RandomTestPage from '@/components/test/RandomTestPage'
import { getOposicion } from '@/lib/config/oposiciones'
import type { OposicionSlug } from '@/lib/api/random-test/schemas'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}
  const slugWords = oposicion.replace(/-/g, ' ')
  return {
    title: `Test Aleatorio ${config.name} | Vence`,
    description: `Genera tests aleatorios personalizados para preparar las oposiciones de ${config.name}. Selecciona temas, dificultad y modo de estudio.`,
    keywords: [
      `test ${slugWords}`,
      `oposiciones ${slugWords}`,
      'test aleatorio',
      `preparar oposiciones ${slugWords}`,
    ],
    alternates: { canonical: `/${oposicion}/test/aleatorio` },
    robots: { index: true, follow: true },
  }
}

export default async function Page({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  return <RandomTestPage oposicion={config.slug as OposicionSlug} />
}
