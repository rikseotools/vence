// app/auxiliar-administrativo-aragon/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo DGA Aragon 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo de Aragon (DGA): 28 plazas OPE 2023-2025 + 53 previstas OPE 2026, temario oficial 20 temas, 2 bloques. BOA 23/12/2025.',
  keywords: [
    'auxiliar administrativo aragon',
    'oposiciones auxiliar administrativo aragon',
    'temario auxiliar aragon',
    'oposiciones dga aragon',
    'auxiliar administrativo dga',
    '20 temas auxiliar aragon',
    'cuerpo auxiliar aragon',
    'plazas auxiliar administrativo aragon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo DGA Aragon | 28 Plazas + 53 Previstas',
    description: 'Oposiciones Auxiliar Administrativo de Aragon (DGA): temario oficial 20 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-aragon`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo DGA Aragon',
    description: '28 plazas + 53 previstas. Temario 20 temas. Diputacion General de Aragon.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-aragon`,
  },
}

export default function AuxiliarAdministrativoAragon() {
  const estadisticas = [
    { numero: "28", texto: "Plazas convocadas", color: "text-yellow-600" },
    { numero: "20", texto: "Temas oficiales", color: "text-yellow-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-yellow-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 20 temas distribuidos en 2 bloques: Materias Comunes (15 temas) y Materias Especificas (5 temas de ofimatica).",
      stats: "20 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "2 ejercicios: primer ejercicio teorico de 70 preguntas tipo test (2 horas) y segundo ejercicio practico de 30 preguntas (1 hora). Penalizacion de 1/3 por respuesta incorrecta.",
      stats: "100 preguntas \u2022 3 horas"
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
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo de la DGA?",
      respuesta: "Se convocan 28 plazas (OPE 2023-2025, BOA 23/12/2025) para Auxiliar Administrativo de la Diputacion General de Aragon. Ademas, se preveen 53 plazas adicionales en la OPE 2026."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo Aragon?",
      respuesta: "El programa consta de 20 temas en 2 bloques: Materias Comunes (15 temas) sobre Constitucion, organizacion territorial, Union Europea, Estatuto de Aragon, derecho administrativo, proteccion de datos, igualdad y administracion electronica; y Materias Especificas (5 temas) sobre informatica, Windows, Word, Excel y correo electronico."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo Aragon?",
      respuesta: "El examen consta de 2 ejercicios: un primer ejercicio teorico con 70 preguntas tipo test (2 horas) y un segundo ejercicio practico con 30 preguntas (1 hora). Las respuestas incorrectas penalizan 1/3 del valor de la correcta."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Materias Comunes",
      temas: "15 temas (1-15)",
      color: "border-yellow-500",
      temasLista: [
        "1. La Constitucion Espanola de 1978",
        "2. La organizacion territorial del Estado",
        "3. La Union Europea",
        "4. El Estatuto de Autonomia de Aragon",
        "5. Los organos de gobierno de la CA de Aragon",
        "6. El derecho administrativo. Ley 39/2015",
        "7. Disposiciones y actos administrativos",
        "8. Eficacia y validez de los actos administrativos",
        "9. Proteccion de datos personales",
        "10. Igualdad efectiva de mujeres y hombres",
        "11. Informacion y atencion al publico",
        "12. Documentos administrativos",
        "13. Gobierno Abierto y transparencia",
        "14. Prevencion de Riesgos Laborales",
        "15. Administracion electronica"
      ]
    },
    {
      titulo: "Materias Especificas",
      temas: "5 temas (16-20)",
      color: "border-blue-500",
      temasLista: [
        "16. Informatica basica",
        "17. Sistema operativo Windows",
        "18. Procesador de textos Word",
        "19. Hoja de calculo Excel",
        "20. Correo electronico e Internet"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo DGA Aragon",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la Diputacion General de Aragon con temario oficial, tests y simulacros. 28 plazas convocadas + 53 previstas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-ARA",
    "educationalLevel": "Graduado en ESO",
    "teaches": "20 temas oficiales del programa de Auxiliar Administrativo de la DGA"
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
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
              🏔️ DGA ARAGON - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo de Aragon
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Diputacion General de Aragon con <strong>28 plazas convocadas</strong> (OPE 2023-2025) + 53 plazas previstas OPE 2026.
              Convocatoria BOA 23/12/2025.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-aragon/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-aragon/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-yellow-300 transition-all"
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-aragon" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">20 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-aragon/temario"
                className="inline-flex items-center space-x-2 bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
