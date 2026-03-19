// app/auxiliar-administrativo-andalucia/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Junta de Andalucía 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Junta de Andalucía 2026: temario oficial 22 temas BOJA junio 2024. Programa C2.1000 del IAAP.',
  keywords: [
    'auxiliar administrativo junta de andalucia',
    'oposiciones auxiliar administrativo andalucia',
    'temario auxiliar andalucia',
    'oposiciones andalucia 2026',
    'auxiliar administrativo junta andalucia',
    '22 temas auxiliar andalucia',
    'requisitos auxiliar andalucia',
    'plazas auxiliar administrativo andalucia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Junta de Andalucía 2026 | Temario y Tests',
    description: 'Oposiciones Auxiliar Administrativo Junta de Andalucía: temario oficial 22 temas. Programa C2.1000 IAAP.',
    url: `${SITE_URL}/auxiliar-administrativo-andalucia`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Junta de Andalucía 2026',
    description: 'Temario 22 temas BOJA junio 2024. Junta de Andalucía.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-andalucia`,
  },
}

export default function AuxiliarAdministrativoAndalucia() {
  const estadisticas = [
    { numero: "22", texto: "Temas oficiales", color: "text-teal-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "C2", texto: "Grupo", color: "text-green-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BOJA",
      descripcion: "El temario consta de 22 temas distribuidos en 2 bloques temáticos según Resolución IAAP de 27 de mayo de 2024 (BOJA 106).",
      stats: "22 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Ejercicio único: 179 preguntas teóricas tipo test + 28 preguntas prácticas de LibreOffice 7.3. 180 minutos.",
      stats: "207 preguntas \u2022 180 min"
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
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo Junta de Andalucía?",
      respuesta: "El programa según BOJA junio 2024 consta de 22 temas en 2 bloques: Área Jurídico Administrativa General (12 temas) y Organización y Gestión Administrativa (10 temas)."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: "Nacionalidad española o europea, tener 18 años cumplidos, título de Graduado en ESO o equivalente, y no estar inhabilitado para funciones públicas."
    },
    {
      pregunta: "¿Cómo es el examen de Auxiliar Administrativo Junta de Andalucía?",
      respuesta: "Ejercicio único de 180 minutos con dos partes: 179 preguntas teóricas tipo test y 28 preguntas prácticas de ofimática (LibreOffice 7.3). Máximo 120 puntos, mínimo 48 para aprobar."
    },
    {
      pregunta: "¿Qué programa de ofimática usan en el examen?",
      respuesta: "El examen práctico se realiza con LibreOffice 7.3 (Writer y Calc), no con Microsoft Office. El sistema operativo de referencia es Windows y Guadalinex."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Área Jurídico Administrativa General",
      temas: "12 temas (1-12)",
      color: "border-teal-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. Organización territorial del Estado",
        "3. La Comunidad Autónoma de Andalucía",
        "4. Organización Institucional de la Comunidad Autónoma de Andalucía",
        "5. Organización de la Administración de la Junta de Andalucía",
        "6. El Derecho Administrativo",
        "7. El procedimiento administrativo común",
        "8. Normativa sobre Igualdad y de Género",
        "9. La Igualdad de Género en las Políticas Públicas",
        "10. El presupuesto de la Comunidad Autónoma de Andalucía",
        "11. La función pública en la Administración de la Junta de Andalucía",
        "12. El sistema español de Seguridad Social"
      ]
    },
    {
      titulo: "Bloque II: Organización y Gestión Administrativa",
      temas: "10 temas (13-22)",
      color: "border-blue-500",
      temasLista: [
        "13. La comunicación",
        "14. Las relaciones de la ciudadanía con la Junta de Andalucía",
        "15. Documentos de la Administración de la Junta de Andalucía",
        "16. La gestión de documentos",
        "17. El archivo",
        "18. La protección de datos",
        "19. La calidad",
        "20. Sistemas Informáticos",
        "21. Sistemas Ofimáticos",
        "22. Redes de Comunicaciones e Internet"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Junta de Andalucía 2026",
    "description": "Preparación para las oposiciones de Auxiliar Administrativo de la Junta de Andalucía con temario oficial BOJA, tests y simulacros.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-ANDALUCIA-2026",
    "educationalLevel": "Graduado en ESO",
    "teaches": "22 temas oficiales del programa de Auxiliar Administrativo Junta de Andalucía según BOJA junio 2024"
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
            <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ JUNTA DE ANDALUCÍA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Junta de Andalucía 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Junta de Andalucía (Cuerpo C2.1000).
              Temario oficial según BOJA junio 2024.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-andalucia/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-andalucia/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-teal-300 transition-all"
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
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOJA junio 2024</h2>
            <p className="text-center text-gray-600 mb-8">22 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-andalucia/temario"
                className="inline-flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
