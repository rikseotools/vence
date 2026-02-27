// app/auxiliar-administrativo-carm/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo CARM (Murcia) 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo CARM 2026: 58 plazas, temario oficial 16 temas BORM 17/10/2016. Comunidad Autónoma de la Región de Murcia.',
  keywords: [
    'auxiliar administrativo carm',
    'oposiciones auxiliar administrativo murcia',
    'temario auxiliar carm',
    'oposiciones murcia 2026',
    'auxiliar administrativo region de murcia',
    '16 temas auxiliar carm',
    'requisitos auxiliar carm',
    'plazas auxiliar administrativo murcia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo CARM (Murcia) 2026 | 58 Plazas',
    description: 'Oposiciones Auxiliar Administrativo CARM: temario oficial 16 temas. Comunidad Autónoma de la Región de Murcia.',
    url: `${SITE_URL}/auxiliar-administrativo-carm`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo CARM (Murcia) 2026',
    description: '58 plazas. Temario 16 temas BORM 17/10/2016. Región de Murcia.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-carm`,
  },
}

export default function AuxiliarAdministrativoCarm() {
  const estadisticas = [
    { numero: "58", texto: "Plazas", color: "text-amber-600" },
    { numero: "16", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BORM",
      descripcion: "El temario consta de 16 temas distribuidos en 2 bloques temáticos según BORM 17/10/2016.",
      stats: "16 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test. Temario de derecho constitucional, administrativo y gestión pública.",
      stats: "9 temas derecho \u2022 7 gestión"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Graduado en ESO o equivalente, nacionalidad española o europea.",
      stats: "ESO/equivalente \u2022 +18 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo CARM 2026?",
      respuesta: "Se convocan 58 plazas para Auxiliar Administrativo de la Comunidad Autónoma de la Región de Murcia."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo CARM?",
      respuesta: "El programa según BORM 17/10/2016 consta de 16 temas en 2 bloques: Derecho Constitucional y Administrativo (9 temas) y Gestión y Administración Pública (7 temas)."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: "Nacionalidad española o europea, tener 18 años cumplidos, título de Graduado en ESO o equivalente, y no estar inhabilitado para funciones públicas."
    },
    {
      pregunta: "¿Cuándo es el examen de Auxiliar Administrativo CARM?",
      respuesta: "El examen está previsto para junio de 2026. Consulta el BORM para las fechas exactas de la convocatoria."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Derecho Constitucional y Administrativo",
      temas: "9 temas (1-9)",
      color: "border-amber-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. Estatuto de Autonomía de la Región de Murcia",
        "3. El Presidente y Consejo de Gobierno de Murcia",
        "4. Régimen Jurídico del Sector Público",
        "5. Disposiciones y actos administrativos",
        "6. El procedimiento administrativo",
        "7. Revisión de actos y responsabilidad patrimonial",
        "8. Estatuto Básico del Empleado Público",
        "9. Contratos del Sector Público"
      ]
    },
    {
      titulo: "Bloque II: Gestión y Administración Pública",
      temas: "7 temas (10-16)",
      color: "border-blue-500",
      temasLista: [
        "10. Hacienda de la Región de Murcia",
        "11. Administración electrónica",
        "12. Información administrativa y atención al ciudadano",
        "13. Archivos y Patrimonio Documental de Murcia",
        "14. Los documentos administrativos",
        "15. Prevención de Riesgos Laborales",
        "16. Igualdad, Transparencia y Protección de datos"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo CARM (Murcia) 2026",
    "description": "Preparación para las oposiciones de Auxiliar Administrativo de la Comunidad Autónoma de la Región de Murcia con temario oficial BORM, tests y simulacros. 58 plazas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-CARM-2026",
    "educationalLevel": "Graduado en ESO",
    "teaches": "16 temas oficiales del programa de Auxiliar Administrativo CARM según BORM 17/10/2016"
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
              🏛️ COMUNIDAD AUTÓNOMA DE MURCIA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo CARM 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Comunidad Autónoma de la Región de Murcia con <strong>58 plazas</strong>.
              Temario oficial según BORM 17/10/2016.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-carm/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-carm/temario"
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
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BORM 17/10/2016</h2>
            <p className="text-center text-gray-600 mb-8">16 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-carm/temario"
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
