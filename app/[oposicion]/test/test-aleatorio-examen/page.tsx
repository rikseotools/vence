// app/[oposicion]/test/test-aleatorio-examen/page.tsx - Template dinámico de Examen Aleatorio
//
// Cubre todas las oposiciones a /<slug>/test/test-aleatorio-examen con un único
// archivo. Si una oposición necesita lógica custom: crear
// app/<slug>/test/test-aleatorio-examen/page.tsx con su implementación;
// Next.js da prioridad al estático sobre el dinámico.
//
// force-dynamic: ExamAleatorioServerWrapper carga nombres de temas desde BD
// (cacheados con tag 'test-counts'). SSG saturaba el build con 35+ oposiciones.
import ExamAleatorioServerWrapper from '@/components/test/ExamAleatorioServerWrapper'
import { getOposicion } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}
  const slugWords = oposicion.replace(/-/g, ' ')
  return {
    title: `Test Aleatorio Modo Examen ${config.name} | Vence`,
    description: `Practica simulacros tipo examen para ${config.name}. Modo examen completo con todas las preguntas visibles y corrección al final.`,
    keywords: [
      `simulacro examen ${slugWords}`,
      `oposiciones ${slugWords}`,
      'test aleatorio examen',
      `examen ${slugWords}`,
    ],
    alternates: { canonical: `/${oposicion}/test/test-aleatorio-examen` },
    robots: { index: true, follow: true },
  }
}

export default async function Page({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  return <ExamAleatorioServerWrapper oposicionSlug={config.slug} />
}
