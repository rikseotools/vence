// app/es/auxiliar-administrativo-estado/temario/tema-1/page.js
import Link from 'next/link'
import Script from 'next/script'
import Tema1Interactive from './Tema1Interactive'

export const metadata = {
  title: 'Tema 1: La Constitución Española de 1978 | Auxiliar Administrativo Estado 2025',
  description: 'Tema completo de la Constitución Española de 1978. Material oficial actualizado para Auxiliar Administrativo del Estado con todos los artículos clave, estructura y principios fundamentales.',
  keywords: 'tema 1 constitución española, constitución 1978, auxiliar administrativo estado, derechos fundamentales, poderes del estado, examen auxiliar administrativo',
  authors: [{ name: 'Tests Jurídicos España' }],
  openGraph: {
    title: 'Tema 1: La Constitución Española de 1978 | Auxiliar Administrativo Estado',
    description: 'Material completo del Tema 1 - Constitución Española para oposiciones de Auxiliar Administrativo del Estado. Artículos clave y contenido actualizado 2025.',
    url: 'https://www.ilovetest.pro/es/auxiliar-administrativo-estado/temario/tema-1',
    siteName: 'Tests Jurídicos España',
    locale: 'es_ES',
    type: 'article',
    images: [
      {
        url: '/images/tema-1-constitucion-og.jpg',
        width: 1200,
        height: 630,
        alt: 'Tema 1 Constitución Española 1978 Auxiliar Administrativo',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.ilovetest.pro/es/auxiliar-administrativo-estado/temario/tema-1',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const faqData = [
  {
    question: "¿Cuándo se aprobó la Constitución Española de 1978?",
    answer: "La Constitución Española fue aprobada por las Cortes Generales el 31 de octubre de 1978, ratificada por referéndum el 6 de diciembre de 1978, sancionada por el Rey el 27 de diciembre y publicada en el BOE el 29 de diciembre de 1978, entrando en vigor ese mismo día."
  },
  {
    question: "¿Cuáles son los artículos más importantes del Tema 1?",
    answer: "Los artículos más preguntados en exámenes son: Art. 1 (Estado social y democrático), Art. 2 (Unidad e indivisibilidad), Art. 9 (Principios generales), Art. 14 (Igualdad), Art. 15 (Derecho a la vida), Art. 56 (El Rey), Art. 66 (Las Cortes), Art. 97 (El Gobierno) y Art. 117 (Poder Judicial)."
  },
  {
    question: "¿Cuántos títulos tiene la Constitución Española?",
    answer: "La Constitución Española tiene 10 Títulos: Título Preliminar, Título I (Derechos y deberes fundamentales), Título II (La Corona), Título III (Las Cortes Generales), Título IV (El Gobierno y la Administración), Título V (Relaciones Gobierno-Cortes), Título VI (Poder Judicial), Título VII (Economía y Hacienda), Título VIII (Organización territorial), Título IX (Tribunal Constitucional) y Título X (Reforma constitucional)."
  },
  {
    question: "¿Qué valores superiores establece el artículo 1 de la Constitución?",
    answer: "El artículo 1.1 establece como valores superiores del ordenamiento jurídico: la libertad, la justicia, la igualdad y el pluralismo político. Estos cuatro valores son fundamentales y aparecen frecuentemente en los exámenes."
  }
];

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": "https://www.ilovetest.pro"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Auxiliar Administrativo Estado",
      "item": "https://www.ilovetest.pro/es/auxiliar-administrativo-estado"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Temario",
      "item": "https://www.ilovetest.pro/es/auxiliar-administrativo-estado/temario"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Tema 1: Constitución Española 1978",
      "item": "https://www.ilovetest.pro/es/auxiliar-administrativo-estado/temario/tema-1"
    }
  ]
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqData.map((faq) => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "Tests Jurídicos España - Tema 1 Constitución Española",
  "description": "Material educativo completo del Tema 1 de la Constitución Española de 1978 para oposiciones de Auxiliar Administrativo del Estado",
  "url": "https://www.ilovetest.pro/es/auxiliar-administrativo-estado/temario/tema-1",
  "educationalLevel": "Higher Education",
  "teaches": "Constitución Española de 1978, derechos fundamentales, organización del Estado",
  "audience": {
    "@type": "EducationalAudience",
    "educationalRole": "student"
  }
};

export default function Tema1Page() {
  return (
    <>
      {/* Schema Markup */}
      <Script id="breadcrumb-schema" type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </Script>
      <Script id="faq-schema" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>
      <Script id="article-schema" type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </Script>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 py-12">
          {/* Breadcrumbs SEO */}
          <nav className="mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-blue-600">Inicio</Link></li>
              <li className="text-gray-400">/</li>
              <li><Link href="/es/auxiliar-administrativo-estado" className="hover:text-blue-600">Auxiliar Administrativo</Link></li>
              <li className="text-gray-400">/</li>
              <li><Link href="/es/auxiliar-administrativo-estado/temario" className="hover:text-blue-600">Temario</Link></li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-900 font-medium">Tema 1</li>
            </ol>
          </nav>

          {/* Contenido SEO Principal */}
          <article className="mb-12">
            <header className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                🏛️ Tema 1: La Constitución Española de 1978
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-4">
                Base fundamental del ordenamiento jurídico español
              </p>
              <p className="text-lg text-gray-500 max-w-3xl mx-auto">
                Material oficial actualizado 2025 para oposiciones de Auxiliar Administrativo del Estado. 
                Contenido completo con todos los artículos clave, estructura constitucional y principios fundamentales.
              </p>
            </header>

            {/* Resumen del Tema SEO */}
            <section className="max-w-4xl mx-auto mb-12">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Resumen del Tema</h2>
                
                <div className="prose prose-lg max-w-none">
                  <p className="text-gray-700 leading-relaxed mb-6">
                    La <strong>Constitución Española de 6 de diciembre de 1978</strong> es la norma suprema 
                    del ordenamiento jurídico español y constituye el tema más fundamental para las oposiciones 
                    de Auxiliar Administrativo del Estado. Establece los principios básicos de la convivencia 
                    política y social española.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">🎯 Características Principales</h3>
                  <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
                    <li><strong>Consensuada</strong> - Fruto del consenso entre todas las fuerzas políticas</li>
                    <li><strong>Extensa</strong> - 169 artículos, 4 disposiciones adicionales, 9 transitorias, 1 derogatoria y 1 final</li>
                    <li><strong>Rígida</strong> - Procedimiento especial para su reforma</li>
                    <li><strong>Escrita</strong> - Texto único y codificado</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">📖 Estructura de la Constitución</h3>
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <h4 className="font-bold text-blue-800 mb-2">Título Preliminar</h4>
                      <p className="text-sm text-gray-700">Principios generales del Estado (arts. 1-9)</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                      <h4 className="font-bold text-green-800 mb-2">Título I</h4>
                      <p className="text-sm text-gray-700">Derechos y deberes fundamentales (arts. 10-55)</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-400">
                      <h4 className="font-bold text-purple-800 mb-2">Título II</h4>
                      <p className="text-sm text-gray-700">La Corona (arts. 56-65)</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-400">
                      <h4 className="font-bold text-red-800 mb-2">Título III</h4>
                      <p className="text-sm text-gray-700">Las Cortes Generales (arts. 66-96)</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400">
                      <h4 className="font-bold text-orange-800 mb-2">Título IV</h4>
                      <p className="text-sm text-gray-700">Gobierno y Administración (arts. 97-107)</p>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-lg border-l-4 border-teal-400">
                      <h4 className="font-bold text-teal-800 mb-2">Título VI</h4>
                      <p className="text-sm text-gray-700">Del Poder Judicial (arts. 117-127)</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">🔥 Artículos Más Importantes</h3>
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-bold text-yellow-800 mb-3">Críticos para el examen:</h4>
                        <ul className="text-sm space-y-1">
                          <li>• <strong>Artículo 1</strong> - Estado social y democrático (95% de apariciones)</li>
                          <li>• <strong>Artículo 2</strong> - Unidad e indivisibilidad (90% de apariciones)</li>
                          <li>• <strong>Artículo 9</strong> - Principios generales (85% de apariciones)</li>
                          <li>• <strong>Artículo 14</strong> - Igualdad (80% de apariciones)</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-yellow-800 mb-3">Importantes:</h4>
                        <ul className="text-sm space-y-1">
                          <li>• <strong>Artículo 15</strong> - Derecho a la vida (75% de apariciones)</li>
                          <li>• <strong>Artículo 56</strong> - El Rey (70% de apariciones)</li>
                          <li>• <strong>Artículo 66</strong> - Las Cortes Generales (65% de apariciones)</li>
                          <li>• <strong>Artículo 97</strong> - El Gobierno (60% de apariciones)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">📊 Datos Clave para Memorizar</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-bold text-purple-800 mb-2">Fechas Importantes</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• <strong>31 octubre 1978</strong> - Aprobación por las Cortes</li>
                        <li>• <strong>6 diciembre 1978</strong> - Referéndum</li>
                        <li>• <strong>29 diciembre 1978</strong> - Publicación BOE</li>
                      </ul>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h4 className="font-bold text-indigo-800 mb-2">Números Clave</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• <strong>169 artículos</strong> - Estructura total</li>
                        <li>• <strong>10 títulos</strong> - Organización temática</li>
                        <li>• <strong>4 valores superiores</strong> - Art. 1.1</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ SEO Section */}
            <section className="max-w-4xl mx-auto mb-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">❓ Preguntas Frecuentes</h2>
              <div className="space-y-4">
                {faqData.map((faq, index) => (
                  <details key={index} className="bg-white rounded-lg shadow border border-gray-200">
                    <summary className="p-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50">
                      {faq.question}
                    </summary>
                    <div className="p-4 pt-0 text-gray-700">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* Navegación y CTA */}
            <section className="text-center">
              <div className="max-w-md mx-auto space-y-4">
                <p className="text-lg text-gray-700 mb-6">
                  Accede al contenido completo del tema con material interactivo, 
                  análisis de artículos clave y casos prácticos.
                </p>
              </div>
            </section>
          </article>

          {/* Componente Interactivo */}
          <Tema1Interactive />

          {/* Enlaces relacionados SEO */}
          <section className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🔗 Temas Relacionados</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/es/auxiliar-administrativo-estado/temario" 
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">← Temario</h3>
                <p className="text-sm text-gray-600">Volver al temario completo</p>
              </Link>
              <Link href="/es/auxiliar-administrativo-estado/test/tema/1" 
                    className="bg-blue-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">🎯 Tests Tema 1</h3>
                <p className="text-sm text-blue-600">Practica con preguntas reales</p>
              </Link>
              <Link href="/es/auxiliar-administrativo-estado/temario/tema-2" 
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Tema 2 →</h3>
                <p className="text-sm text-gray-600">Derechos Fundamentales</p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}