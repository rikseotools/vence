// app/auxiliar-administrativo-ayuntamiento-valencia/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Ayuntamiento de Valencia 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Ayuntamiento de Valencia 2026: 274 plazas OEP 2021-2025, temario oficial 21 temas. Practica con tests y estudia el temario completo.',
  keywords: [
    'auxiliar administrativo ayuntamiento valencia',
    'oposiciones auxiliar administrativo ayuntamiento valencia',
    'temario auxiliar ayuntamiento valencia',
    'oposiciones ayuntamiento valencia 2026',
    'auxiliar administrativo ayuntamiento valencia plazas',
    '21 temas auxiliar ayuntamiento valencia',
    'requisitos auxiliar ayuntamiento valencia',
    'plazas auxiliar administrativo valencia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Ayuntamiento de Valencia 2026 | 274 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Ayuntamiento de Valencia: temario oficial 21 temas. 274 plazas OEP 2021-2025.',
    url: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valencia`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Ayuntamiento de Valencia 2026',
    description: '274 plazas. Temario 21 temas. Ayuntamiento de Valencia.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-ayuntamiento-valencia`,
  },
}

export default function AuxiliarAdministrativoAyuntamientoValencia() {
  const estadisticas = [
    { numero: "274", texto: "Plazas", color: "text-amber-600" },
    { numero: "21", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "~4700", texto: "Preguntas", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 21 temas organizados en 2 bloques: Derecho Constitucional y Administración Local.",
      stats: "21 temas · 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test con preguntas de derecho constitucional, administrativo y administración local.",
      stats: "10 temas derecho · 11 admin. local"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Graduado en ESO o equivalente, nacionalidad española o europea.",
      stats: "ESO/equivalente · +18 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo del Ayuntamiento de Valencia?",
      respuesta: "Se convocan 274 plazas para Auxiliar Administrativo del Ayuntamiento de Valencia, correspondientes a la OEP 2021-2025."
    },
    {
      pregunta: "¿Cuál es el programa oficial?",
      respuesta: "El programa consta de 21 temas en 2 bloques: Bloque I de Derecho Constitucional (10 temas) y Bloque II de Administración Local (11 temas)."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: "Nacionalidad española o europea, tener 18 años cumplidos, título de Graduado en ESO o equivalente, y no estar inhabilitado para funciones públicas."
    },
    {
      pregunta: "¿Cuántas preguntas hay disponibles en Vence?",
      respuesta: "Actualmente hay aproximadamente 4700 preguntas disponibles para practicar, organizadas por los 21 temas del temario oficial."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Derecho Constitucional",
      temas: "10 temas (1-10)",
      color: "border-amber-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. La Corona",
        "3. Las Cortes Generales",
        "4. El Gobierno y la Administración",
        "5. El Poder Judicial",
        "6. Organización territorial del Estado",
        "7. La Unión Europea",
        "8. Ley 39/2015 del Procedimiento Administrativo Común",
        "9. Ley 40/2015 de Régimen Jurídico del Sector Público",
        "10. Estatuto Básico del Empleado Público"
      ]
    },
    {
      titulo: "Bloque II: Administración Local",
      temas: "11 temas (11-21)",
      color: "border-blue-500",
      temasLista: [
        "11. El Municipio",
        "12. Régimen de funcionamiento de las entidades locales",
        "13. El personal al servicio de las entidades locales",
        "14. Haciendas locales",
        "15. Contratos del Sector Público",
        "16. La responsabilidad patrimonial de la Administración",
        "17. Administración electrónica",
        "18. Protección de datos y transparencia",
        "19. Igualdad efectiva de mujeres y hombres",
        "20. Prevención de Riesgos Laborales",
        "21. El Ayuntamiento de Valencia"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Ayuntamiento de Valencia 2026",
    "description": "Preparación para las oposiciones de Auxiliar Administrativo del Ayuntamiento de Valencia con temario oficial, tests y simulacros. 274 plazas OEP 2021-2025.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-AYTO-VALENCIA-2026",
    "educationalLevel": "Graduado en ESO",
    "teaches": "21 temas oficiales del programa de Auxiliar Administrativo del Ayuntamiento de Valencia"
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ AYUNTAMIENTO DE VALENCIA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Ayuntamiento de Valencia 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para el Ayuntamiento de Valencia con <strong>274 plazas</strong> convocadas (OEP 2021-2025).
              Temario oficial de 21 temas en 2 bloques.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-ayuntamiento-valencia/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-ayuntamiento-valencia/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-amber-300 transition-all"
              >
                <span className="text-xl">📚</span>
                <span>Ver Temario</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-md">
                  <div className={`text-2xl font-bold ${stat.color}`}>
                    {stat.numero}
                  </div>
                  <div className="text-sm text-gray-600">
                    {stat.texto}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Información del Temario */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Información de la Oposición</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {infoTemario.map((info, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg p-6">
                  <div className="text-3xl mb-4">{info.icon}</div>
                  <h3 className="text-xl font-bold mb-3">{info.titulo}</h3>
                  <p className="text-gray-600 mb-4">{info.descripcion}</p>
                  <div className="text-sm text-gray-500">{info.stats}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Temario Oficial */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">21 temas en 2 bloques</p>
            <div className="grid md:grid-cols-2 gap-6">
              {bloquesTematicos.map((bloque, index) => (
                <div key={index} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${bloque.color}`}>
                  <p className="text-xs text-gray-500 mb-1">{bloque.temas}</p>
                  <h3 className="text-base font-bold mb-3 text-gray-800">{bloque.titulo}</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {bloque.temasLista.map((tema, temaIndex) => (
                      <li key={temaIndex} className="flex items-start">
                        <span className="mr-1">&bull;</span>
                        <span>{tema}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/auxiliar-administrativo-ayuntamiento-valencia/temario"
                className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>📚</span>
                <span>Ver Temario Completo</span>
              </Link>
            </div>
          </section>

          {/* FAQs */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-lg p-6 shadow-md">
                  <h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3>
                  <p className="text-gray-600">{faq.respuesta}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
