// app/[oposicion]/page.tsx - Landing page dinámica
import { getOposicion, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export function generateStaticParams() {
  return ALL_OPOSICION_SLUGS.map(slug => ({ oposicion: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}

  return {
    title: `${config.name} - Tests y Temario | Vence`,
    description: `Prepara ${config.name} con tests tipo examen, temario completo y explicaciones. ${config.totalTopics} temas.`,
    keywords: [config.name, 'oposiciones', 'test', 'temario', config.badge],
    openGraph: {
      title: `${config.name} | Vence`,
      description: `Tests y temario para ${config.name}`,
      url: `${SITE_URL}/${config.slug}`,
      siteName: 'Vence - Tests de Oposiciones',
    },
    alternates: { canonical: `${SITE_URL}/${config.slug}` },
  }
}

export default async function OposicionPage({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <span className="text-5xl mb-4 block">{config.emoji}</span>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{config.name}</h1>
          <p className="text-gray-600 text-lg">{config.totalTopics} temas en {config.blocks.length} bloques</p>
          <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {config.badge} - {config.administracion === 'estado' ? 'Administracion del Estado' :
              config.administracion === 'autonomica' ? 'Administracion Autonomica' :
              config.administracion === 'local' ? 'Administracion Local' :
              config.administracion === 'justicia' ? 'Administracion de Justicia' : ''}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Link href={`/${config.slug}/test`} className="block bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow border border-gray-200">
            <div className="text-3xl mb-3">{'🎯'}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Tests por Temas</h2>
            <p className="text-gray-600">Practica con preguntas tipo test organizadas por temas y bloques.</p>
          </Link>
          <Link href={`/${config.slug}/temario`} className="block bg-white rounded-xl shadow-sm p-8 hover:shadow-md transition-shadow border border-gray-200">
            <div className="text-3xl mb-3">{'📚'}</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Temario Completo</h2>
            <p className="text-gray-600">Estudia el contenido de cada tema con articulos y legislacion.</p>
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Bloques del Temario</h2>
          {config.blocks.map(block => (
            <div key={block.id} className="mb-4 last:mb-0">
              <h3 className="font-semibold text-gray-800 mb-2">{block.icon} {block.title}</h3>
              {block.subtitle && <p className="text-sm text-gray-500 mb-2">{block.subtitle}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {block.themes.map(theme => (
                  <Link key={theme.id} href={`/${config.slug}/test/tema/${theme.id}`}
                    className="text-sm text-gray-600 hover:text-blue-600 py-1 px-2 rounded hover:bg-blue-50 transition-colors">
                    T{theme.displayNumber || theme.id}: {theme.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
