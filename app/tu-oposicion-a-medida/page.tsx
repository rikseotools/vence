// app/tu-oposicion-a-medida/page.tsx
//
// Landing de «tu oposición a medida» (T-328). Habla al opositor cuya oposición no está en
// NINGUNA plataforma — el hueco que la ficha midió: nadie en el mercado de competidores
// catalogados (67 activos revisados, incluida búsqueda por nombre en `competitor_courses`)
// ofrece "elige tus leyes y artículos y arma tu propio temario"; lo más cercano encontrado es
// "programa de estudio personalizado" (ritmo/tutoría, no contenido).
//
// La demanda es real y MEDIDA, no una intuición: 303 usuarios ya tienen una oposición
// personalizada como objetivo (`custom_oposiciones`, T-327 ficha 01/08) sin que existiera
// ninguna landing que lo explicara, y 182 oposiciones del catálogo (586 usuarios, 4 premium)
// están elegidas sin tener ni un tema montado (T-397, medido 01/08 con
// `node scripts/health/oposicion-sin-temario.cjs`).
//
// Depende de [T-327] (verificado en producción 01/08). El contenido de la landing vive en
// `content.ts`, en un solo array para JSX y JSON-LD — no puede desincronizarse.
import type { Metadata } from 'next'
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { CTA_HREF, FAQ_ITEMS } from './content'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
const PAGE_PATH = '/tu-oposicion-a-medida'

export const metadata: Metadata = {
  title: 'Oposición a medida: crea tu propio temario | Vence',
  description:
    '¿Tu oposición no está en ninguna plataforma? Elige las leyes y los artículos que entran, arma tus temas y practica con tests reales — gratis.',
  keywords: [
    'oposición a medida',
    'temario personalizado oposición',
    'crear temario oposición',
    'oposiciones A1 A2',
    'preparar oposición que no está en ninguna plataforma',
  ],
  openGraph: {
    title: 'Oposición a medida: crea tu propio temario | Vence',
    description:
      'Elige las leyes y artículos de tu oposición, arma tus temas y practica con tests reales — gratis.',
    url: `${SITE_URL}${PAGE_PATH}`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  alternates: { canonical: `${SITE_URL}${PAGE_PATH}` },
  robots: { index: true, follow: true },
}

const PASOS = [
  {
    titulo: 'Busca tu ley — por nombre o por lo que dice',
    texto:
      'Si tu programa nombra la ley, búscala directamente. Si solo describe la materia ("silencio administrativo", "régimen disciplinario"...), busca esas palabras: el buscador mira también DENTRO del articulado, no solo los títulos.',
  },
  {
    titulo: 'Añade los artículos que entran a un tema',
    texto:
      'Selecciona los artículos exactos (o secciones/títulos enteros) y agrúpalos bajo el nombre que quieras — el mismo epígrafe de tu programa oficial.',
  },
  {
    titulo: 'Repite con tantos temas como necesites',
    texto: 'Uno por cada bloque de tu programa. Sin límite de temas ni de leyes.',
  },
  {
    titulo: 'Guarda y ya tienes tu oposición en Vence',
    texto:
      'Pasa a ser una oposición normal, con test por tema, estadísticas y progreso — no un formato aparte.',
  },
]

export default function TuOposicionAMedidaPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: item.respuesta },
    })),
  }

  return (
    <>
      <ClientBreadcrumbsWrapper />
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Hero */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              ¿Tu oposición no está en ninguna plataforma?
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Móntate tu propio temario eligiendo exactamente las leyes y los artículos que
              entran en tu convocatoria — y practica con tests reales, gratis.
            </p>
            <Link
              href={CTA_HREF}
              className="inline-block mt-8 px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Crea tu oposición a medida
            </Link>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-12">
          {/* El problema */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              El problema de las oposiciones que no son masivas
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Las academias y plataformas preparan las oposiciones con más plazas y más
              demanda. Si la tuya es de grupo A1 o A2, un cuerpo específico, o convocada por un
              solo ayuntamiento o comunidad, es fácil que no exista ningún material hecho a
              medida — y acabas estudiando con temarios genéricos que no coinciden con tu
              programa oficial, o directamente en PDF suelto, artículo por artículo.
            </p>
          </section>

          {/* Cómo funciona */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-5">
              Cómo funciona
            </h2>
            <ol className="space-y-5">
              {PASOS.map((paso, i) => (
                <li key={paso.titulo} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{paso.titulo}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{paso.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Comunidad */}
          <section className="mt-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Se publica con tu nombre, y otros la pueden estudiar contigo
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Tu oposición se guarda como <em>&laquo;Oposición &lt;tu nombre&gt; by
              &lt;tus iniciales&gt;&raquo;</em> y queda disponible para que cualquier otro
              opositor con tu misma convocatoria la elija como la suya. Solo tú puedes editarla.
            </p>
          </section>

          {/* FAQ */}
          <section className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Preguntas frecuentes
            </h2>
            <div className="space-y-6">
              {FAQ_ITEMS.map((item) => (
                <div key={item.pregunta}>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    {item.pregunta}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.respuesta}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-12 text-center">
            <Link
              href={CTA_HREF}
              className="inline-block px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Crea tu oposición a medida
            </Link>
          </div>
        </div>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}
