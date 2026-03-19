// app/auxiliar-administrativo-clm/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Junta de Castilla-La Mancha 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Junta de Castilla-La Mancha: 249 plazas, temario oficial 24 temas, 2 bloques. DOCM 18/12/2024.',
  keywords: [
    'auxiliar administrativo castilla la mancha',
    'oposiciones auxiliar administrativo clm',
    'temario auxiliar clm',
    'oposiciones jccm',
    'auxiliar administrativo junta castilla la mancha',
    '24 temas auxiliar clm',
    'cuerpo auxiliar clm',
    'plazas auxiliar administrativo clm'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Junta de Castilla-La Mancha | 249 Plazas',
    description: 'Oposiciones Auxiliar Administrativo JCCM: temario oficial 24 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-clm`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
    description: '249 plazas. Temario 24 temas. JCCM.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-clm`,
  },
}

export default function AuxiliarAdministrativoClm() {
  const estadisticas = [
    { numero: "249", texto: "Plazas convocadas", color: "text-orange-600" },
    { numero: "24", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 24 temas distribuidos en 2 bloques: Organizacion Administrativa (12 temas) y Ofimatica (12 temas).",
      stats: "24 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Ejercicio unico de 100 preguntas tipo test: 50 de organizacion administrativa y 50 de ofimatica. Concurso-oposicion (75+25 puntos).",
      stats: "100 preguntas \u2022 Concurso-oposicion"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Titulo de Graduado en ESO o equivalente, nacionalidad espanola o europea. Grupo C2.",
      stats: "ESO/equivalente \u2022 +16 anos"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo de la JCCM?",
      respuesta: "Se convocan 249 plazas (234 turno libre + 15 discapacidad) para el Cuerpo Auxiliar de la Junta de Comunidades de Castilla-La Mancha."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo CLM?",
      respuesta: "El programa consta de 24 temas en 2 bloques: Organizacion Administrativa (12 temas) sobre Constitucion, Administracion, JCCM, Transparencia y Funcion Publica, y Ofimatica (12 temas) sobre Windows, Office 2019, Internet y Teams."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo CLM?",
      respuesta: "El examen consta de un ejercicio unico de 100 preguntas tipo test: 50 de organizacion administrativa y 50 de ofimatica. El sistema es concurso-oposicion (75 puntos fase oposicion + 25 puntos concurso)."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Organizacion Administrativa",
      temas: "12 temas (1-12)",
      color: "border-orange-500",
      temasLista: [
        "1. La Constitucion Espanola de 1978",
        "2. Ley 39/2015 del Procedimiento Administrativo Comun",
        "3. Ley 40/2015 de Regimen Juridico del Sector Publico (I)",
        "4. Ley 40/2015 de Regimen Juridico del Sector Publico (II)",
        "5. Calidad de los servicios publicos en la JCCM",
        "6. Transparencia en la JCCM",
        "7. Seguridad de la informacion y proteccion de datos",
        "8. Personal al servicio de la JCCM",
        "9. El presupuesto de la JCCM",
        "10. Estatuto de Autonomia de Castilla-La Mancha",
        "11. CLM: caracteristicas historicas y geograficas",
        "12. Igualdad efectiva de mujeres y hombres"
      ]
    },
    {
      titulo: "Ofimatica",
      temas: "12 temas (13-24)",
      color: "border-blue-500",
      temasLista: [
        "13. Informatica basica",
        "14. Windows 10: entorno grafico",
        "15. El Explorador de Windows",
        "16. Word 2019 (I)",
        "17. Word 2019 (II)",
        "18. Word 2019 (III)",
        "19. Excel 2019 (I)",
        "20. Excel 2019 (II)",
        "21. Excel 2019 (III)",
        "22. Internet: protocolos y servicios",
        "23. Outlook 2019",
        "24. OneDrive y Microsoft Teams"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Junta de Castilla-La Mancha",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la JCCM con temario oficial, tests y simulacros. 249 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-CLM",
    "educationalLevel": "Graduado en ESO",
    "teaches": "24 temas oficiales del programa de Auxiliar Administrativo de la JCCM"
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
          <div className="text-center mb-8">
            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
              🏰 JUNTA DE CASTILLA-LA MANCHA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Junta de Castilla-La Mancha
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la JCCM con <strong>249 plazas convocadas</strong>.
              Convocatoria DOCM 18/12/2024. Examen celebrado 11/10/2025.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-clm/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-clm/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-orange-300 transition-all"
              >
                <span className="text-xl">📚</span>
                <span>Ver Temario</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, index) => (
                <div key={index} className="bg-white rounded-lg p-4 shadow-md">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div>
                  <div className="text-sm text-gray-600">{stat.texto}</div>
                </div>
              ))}
            </div>
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Informacion de la Oposicion</h2>
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
            <div className="mt-6">
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-clm" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">24 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-clm/temario"
                className="inline-flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>📚</span>
                <span>Ver Temario Completo</span>
              </Link>
            </div>
          </section>

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
