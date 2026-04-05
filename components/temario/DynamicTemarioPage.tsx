// components/temario/DynamicTemarioPage.tsx
// Componente server compartido que renderiza el temario de cualquier oposición.
// Lee de BD (oposicion_bloques + topics) - fuente única de verdad.
// SEO: server-rendered, static, revalidate=false.

import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'
import { getTemarioByPositionType } from '@/lib/api/temario/queries'
import { slugToPositionType } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'

interface DynamicTemarioPageProps {
  oposicionSlug: string          // ej: 'auxilio-judicial'
  oposicionDisplayName: string   // ej: 'Auxilio Judicial'
  breadcrumbHint?: string        // opcional: texto adicional para header
}

function getFechaActualizacion() {
  return new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default async function DynamicTemarioPage({
  oposicionSlug,
  oposicionDisplayName,
}: DynamicTemarioPageProps) {
  const positionType = slugToPositionType(oposicionSlug)
  if (!positionType) notFound()

  const temario = await getTemarioByPositionType(positionType)
  if (!temario) notFound()

  const fechaActualizacion = getFechaActualizacion()

  // Transformar al formato que espera TemarioClient (compatible con hardcoded anterior)
  const bloques = temario.bloques.map(b => ({
    id: `bloque${b.bloqueNumber}`,
    titulo: b.titulo,
    icon: b.icon || '📚',
    count: b.temas.length,
    temas: b.temas.map(t => ({
      id: t.id,
      titulo: t.titulo,
      descripcion: t.descripcion || '',
      displayNum: t.displayNum !== t.id ? t.displayNum : undefined,
      disponible: t.disponible,
    })),
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-10" />}>
        <InteractiveBreadcrumbs />
      </Suspense>

      <div className="container mx-auto px-4 py-8">
        {/* Header SSR para SEO */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario {oposicionDisplayName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span>
          </p>
        </div>

        {/* Por qué es gratis SSR para SEO */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Componente cliente para interactividad */}
        <TemarioClient
          bloques={bloques}
          oposicion={oposicionSlug}
          fechaActualizacion={fechaActualizacion}
        />

        {/* Lista sr-only para SEO indexación */}
        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario {oposicionDisplayName}</h2>
          {bloques.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/${oposicionSlug}/temario/tema-${tema.id}`}>
                      Tema {tema.id}: {tema.titulo} - {tema.descripcion}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  )
}
