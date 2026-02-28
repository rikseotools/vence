// app/auxiliar-administrativo-madrid/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Comunidad de Madrid 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Comunidad de Madrid 2026: 645 plazas, temario oficial 21 temas, examen octubre 2026. Comunidad de Madrid.',
  keywords: [
    'auxiliar administrativo madrid',
    'oposiciones auxiliar administrativo madrid',
    'temario auxiliar madrid',
    'oposiciones comunidad de madrid 2026',
    'auxiliar administrativo comunidad de madrid',
    '21 temas auxiliar madrid',
    'requisitos auxiliar madrid',
    'plazas auxiliar administrativo madrid'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Comunidad de Madrid 2026 | 645 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Comunidad de Madrid: temario oficial 21 temas. Examen octubre 2026.',
    url: `${SITE_URL}/auxiliar-administrativo-madrid`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Comunidad de Madrid 2026',
    description: '645 plazas. Temario 21 temas. Examen octubre 2026. Comunidad de Madrid.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-madrid`,
  },
}

export default function AuxiliarAdministrativoMadrid() {
  const estadisticas = [
    { numero: "645", texto: "Plazas previstas", color: "text-red-600" },
    { numero: "21", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 21 temas distribuidos en 2 bloques: Organización Política (15 temas) y Ofimática (6 temas).",
      stats: "21 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test con preguntas sobre el temario oficial. Penalización por respuestas incorrectas.",
      stats: "Tipo test \u2022 Penalización"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Graduado en ESO o equivalente, nacionalidad española o europea. Grupo C2.",
      stats: "ESO/equivalente \u2022 +16 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de la Comunidad de Madrid 2026?",
      respuesta: "Se prevén 645 plazas para Auxiliar Administrativo de la Comunidad de Madrid, siendo la CCAA con más plazas de Auxiliar Administrativo en 2026."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo Madrid?",
      respuesta: "El programa consta de 21 temas en 2 bloques: Bloque I (15 temas) sobre Organización Política y Bloque II (6 temas) sobre Ofimática (Windows, Word, Excel, Access, Outlook, Microsoft 365)."
    },
    {
      pregunta: "¿Cuándo es el examen de Auxiliar Administrativo de la Comunidad de Madrid?",
      respuesta: "El examen está previsto para octubre de 2026."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: "Nacionalidad española o europea, tener 16 años cumplidos, título de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones públicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Organización Política",
      temas: "15 temas (1-15)",
      color: "border-red-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. El Estatuto de Autonomía de la Comunidad de Madrid",
        "3. La Ley de Gobierno y Administración de la CAM",
        "4. Las fuentes del ordenamiento jurídico",
        "5. El acto administrativo",
        "6. La Ley del Procedimiento Administrativo Común",
        "7. La Jurisdicción Contencioso-Administrativa",
        "8. Transparencia y Protección de Datos",
        "9. Los contratos en el Sector Público",
        "10. El Estatuto Básico del Empleado Público",
        "11. La Seguridad Social",
        "12. Hacienda Pública y Presupuestos de la CAM",
        "13. Igualdad de género y no discriminación",
        "14. Información administrativa y Administración electrónica",
        "15. Los documentos administrativos"
      ]
    },
    {
      titulo: "Bloque II: Ofimática",
      temas: "6 temas (16-21)",
      color: "border-blue-500",
      temasLista: [
        "16. El explorador de Windows",
        "17. Procesadores de texto: Word",
        "18. Hojas de cálculo: Excel",
        "19. Bases de datos: Access y Power BI",
        "20. Correo electrónico: Outlook",
        "21. Trabajo colaborativo: Microsoft 365"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Comunidad de Madrid 2026",
    "description": "Preparación para las oposiciones de Auxiliar Administrativo de la Comunidad de Madrid con temario oficial, tests y simulacros. 645 plazas previstas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-MADRID-2026",
    "educationalLevel": "Graduado en ESO",
    "teaches": "21 temas oficiales del programa de Auxiliar Administrativo de la Comunidad de Madrid"
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
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ COMUNIDAD DE MADRID - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Comunidad de Madrid 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Comunidad de Madrid con <strong>645 plazas previstas</strong>.
              Examen previsto para octubre 2026.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-madrid/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-madrid/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-red-300 transition-all"
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
                href="/auxiliar-administrativo-madrid/temario"
                className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
