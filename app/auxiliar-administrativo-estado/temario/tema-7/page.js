// app/auxiliar-administrativo-estado/temario/tema-7/page.js
import Link from 'next/link'
import Script from 'next/script'
import Tema7Interactive from './Tema7Interactive'

export const metadata = {
  title: 'Tema 7: Ley 19/2013 de Transparencia | Auxiliar Administrativo Estado 2025',
  description: 'Tema completo de la Ley 19/2013 de transparencia, acceso a la información pública y buen gobierno. Material oficial actualizado para Auxiliar Administrativo del Estado con todos los artículos clave.',
  keywords: 'tema 7 ley transparencia, ley 19/2013, auxiliar administrativo estado, transparencia acceso información, buen gobierno, consejo transparencia, examen auxiliar administrativo',
  authors: [{ name: 'Tests Jurídicos España' }],
  openGraph: {
    title: 'Tema 7: Ley 19/2013 de Transparencia | Auxiliar Administrativo Estado',
    description: 'Material completo del Tema 7 - Ley de Transparencia para oposiciones de Auxiliar Administrativo del Estado. Artículos clave y contenido actualizado 2025.',
    url: 'https://www.ilovetest.pro/auxiliar-administrativo-estado/temario/tema-7',
    siteName: 'Tests Jurídicos España',
    locale: 'es_ES',
    type: 'article',
    images: [
      {
        url: '/images/tema-7-transparencia-og.jpg',
        width: 1200,
        height: 630,
        alt: 'Tema 7 Ley 19/2013 Transparencia Auxiliar Administrativo',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.ilovetest.pro/auxiliar-administrativo-estado/temario/tema-7',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const faqData = [
  {
    question: "¿Qué es la Ley 19/2013 de Transparencia?",
    answer: "La Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno, tiene por objeto ampliar y reforzar la transparencia de la actividad pública, regular el derecho de acceso a la información y establecer obligaciones de buen gobierno."
  },
  {
    question: "¿Cuáles son los artículos más importantes del Tema 7?",
    answer: "Los artículos más preguntados en exámenes son: Art. 1 (Objeto), Art. 2 (Ámbito subjetivo), Art. 13 (Información pública), Art. 14 (Límites), Art. 24 (Reclamaciones) y Art. 33 (Consejo de Transparencia)."
  },
  {
    question: "¿Qué es el Consejo de Transparencia y Buen Gobierno?",
    answer: "Es una Autoridad Administrativa Independiente creada por la Ley 19/2013, con personalidad jurídica propia y plena autonomía. Su presidente tiene un mandato de 6 años no renovable y su comisión está formada por 8 miembros."
  },
  {
    question: "¿Cuántos límites al derecho de acceso establece el artículo 14?",
    answer: "El artículo 14 establece 12 límites al derecho de acceso (letras a-l): seguridad nacional, defensa, relaciones exteriores, seguridad pública, investigación ilícitos, procesos judiciales, funciones de control, intereses económicos, política monetaria, secreto profesional, confidencialidad y protección ambiental."
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
      "item": "https://www.ilovetest.pro/auxiliar-administrativo-estado"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Temario",
      "item": "https://www.ilovetest.pro/auxiliar-administrativo-estado/temario"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "Tema 7: Ley 19/2013 Transparencia",
      "item": "https://www.ilovetest.pro/auxiliar-administrativo-estado/temario/tema-7"
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
  "name": "Tests Jurídicos España - Tema 7 Ley Transparencia",
  "description": "Material educativo completo del Tema 7 de la Ley 19/2013 de Transparencia para oposiciones de Auxiliar Administrativo del Estado",
  "url": "https://www.ilovetest.pro/auxiliar-administrativo-estado/temario/tema-7",
  "educationalLevel": "Higher Education",
  "teaches": "Ley 19/2013 de transparencia, acceso a la información pública y buen gobierno",
  "audience": {
    "@type": "EducationalAudience",
    "educationalRole": "student"
  }
};

export default function Tema7Page() {
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

      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
        <div className="container mx-auto px-4 py-12">
          {/* Breadcrumbs SEO */}
          <nav className="mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-blue-600">Inicio</Link></li>
              <li className="text-gray-400">/</li>
              <li><Link href="/auxiliar-administrativo-estado" className="hover:text-blue-600">Auxiliar Administrativo</Link></li>
              <li className="text-gray-400">/</li>
              <li><Link href="/auxiliar-administrativo-estado/temario" className="hover:text-blue-600">Temario</Link></li>
              <li className="text-gray-400">/</li>
              <li className="text-gray-900 font-medium">Tema 7</li>
            </ol>
          </nav>

          {/* Contenido SEO Principal */}
          <article className="mb-12">
            <header className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
                📚 Tema 7: Ley 19/2013 de Transparencia
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-4">
                Acceso a la información pública y buen gobierno
              </p>
              <p className="text-lg text-gray-500 max-w-3xl mx-auto">
                Material oficial actualizado 2025 para oposiciones de Auxiliar Administrativo del Estado. 
                Contenido completo con todos los artículos clave y casos prácticos.
              </p>
            </header>

            {/* Resumen del Tema SEO */}
            <section className="max-w-4xl mx-auto mb-12">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">📋 Resumen del Tema</h2>
                
                <div className="prose prose-lg max-w-none">
                  <p className="text-gray-700 leading-relaxed mb-6">
                    La <strong>Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno</strong> 
                    constituye uno de los temas más importantes para las oposiciones de Auxiliar Administrativo del Estado. 
                    Esta normativa establece las bases para garantizar la transparencia en las administraciones públicas españolas.
                  </p>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">🎯 Objetivos de la Ley</h3>
                  <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
                    <li><strong>Ampliar y reforzar la transparencia</strong> de la actividad pública</li>
                    <li><strong>Regular y garantizar el derecho de acceso</strong> a la información pública</li>
                    <li><strong>Establecer las obligaciones de buen gobierno</strong> para responsables públicos</li>
                  </ul>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">📖 Estructura de la Ley</h3>
                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-rose-50 p-4 rounded-lg border-l-4 border-rose-400">
                      <h4 className="font-bold text-rose-800 mb-2">Título Preliminar</h4>
                      <p className="text-sm text-gray-700">Objeto y definiciones fundamentales</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                      <h4 className="font-bold text-blue-800 mb-2">Título I: Transparencia</h4>
                      <p className="text-sm text-gray-700">Publicidad activa y derecho de acceso</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                      <h4 className="font-bold text-green-800 mb-2">Título II: Buen Gobierno</h4>
                      <p className="text-sm text-gray-700">Principios y obligaciones</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">🔥 Artículos Más Importantes</h3>
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-bold text-yellow-800 mb-3">Críticos para el examen:</h4>
                        <ul className="text-sm space-y-1">
                          <li>• <strong>Artículo 1</strong> - Objeto de la ley (95% de apariciones)</li>
                          <li>• <strong>Artículo 2</strong> - Ámbito subjetivo (85% de apariciones)</li>
                          <li>• <strong>Artículo 13</strong> - Información pública (90% de apariciones)</li>
                          <li>• <strong>Artículo 14</strong> - Límites al acceso (75% de apariciones)</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-yellow-800 mb-3">Importantes:</h4>
                        <ul className="text-sm space-y-1">
                          <li>• <strong>Artículo 24</strong> - Reclamaciones (80% de apariciones)</li>
                          <li>• <strong>Artículo 25</strong> - Ámbito buen gobierno (60% de apariciones)</li>
                          <li>• <strong>Artículo 33</strong> - Consejo de Transparencia (70% de apariciones)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 mb-4">📊 Datos Clave para Memorizar</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-bold text-purple-800 mb-2">Plazos Importantes</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• <strong>1 mes</strong> - Plazo para reclamar al CTBG</li>
                        <li>• <strong>3 meses</strong> - Plazo máximo de resolución</li>
                        <li>• <strong>6 años</strong> - Mandato del Presidente CTBG (no renovable)</li>
                      </ul>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h4 className="font-bold text-indigo-800 mb-2">Números Clave</h4>
                      <ul className="text-sm space-y-1 text-gray-700">
                        <li>• <strong>9 letras</strong> - Ámbito subjetivo (art. 2.1)</li>
                        <li>• <strong>12 límites</strong> - Derecho de acceso (art. 14)</li>
                        <li>• <strong>8 miembros</strong> - Comisión de Transparencia</li>
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
                  casos prácticos y tests de autoevaluación.
                </p>
              </div>
            </section>
          </article>

          {/* Componente Interactivo */}
          <Tema7Interactive />

          {/* Enlaces relacionados SEO */}
          <section className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">🔗 Temas Relacionados</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/auxiliar-administrativo-estado/temario/tema-6" 
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">← Tema 6</h3>
                <p className="text-sm text-gray-600">Ley 40/2015 de Régimen Jurídico</p>
              </Link>
              <Link href="/auxiliar-administrativo-estado/test/tema/7" 
                    className="bg-blue-50 p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">🎯 Tests Tema 7</h3>
                <p className="text-sm text-blue-600">Practica con preguntas reales</p>
              </Link>
              <Link href="/auxiliar-administrativo-estado/temario/tema-8" 
                    className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Tema 8 →</h3>
                <p className="text-sm text-gray-600">Siguiente tema del temario</p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}