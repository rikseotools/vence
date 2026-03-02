// app/auxiliar-administrativo-asturias/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Principado de Asturias 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Principado de Asturias: 7 plazas, temario oficial 25 temas, 3 bloques. BOPA 29/12/2025.',
  keywords: [
    'auxiliar administrativo asturias',
    'oposiciones auxiliar administrativo asturias',
    'temario auxiliar asturias',
    'oposiciones principado asturias',
    'auxiliar administrativo principado asturias',
    '25 temas auxiliar asturias',
    'cuerpo auxiliar asturias',
    'plazas auxiliar administrativo asturias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Principado de Asturias | 7 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Principado de Asturias: temario oficial 25 temas en 3 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-asturias`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Principado de Asturias',
    description: '7 plazas. Temario 25 temas. Principado de Asturias.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-asturias`,
  },
}

export default function AuxiliarAdministrativoAsturias() {
  const estadisticas = [
    { numero: "7", texto: "Plazas convocadas", color: "text-indigo-600" },
    { numero: "25", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "3", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-indigo-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 25 temas distribuidos en 3 bloques: Derecho Constitucional y Organizacion Administrativa (6 temas), Derecho Administrativo y Comunitario (14 temas) y Ofimatica (5 temas).",
      stats: "25 temas \u2022 3 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Concurso-oposicion. Primer ejercicio: 90 preguntas tipo test (2 horas, penalizacion 1/3). Segundo ejercicio: prueba practica de informatica con Word y Excel (1 hora).",
      stats: "90 preguntas test \u2022 2 horas + practico"
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
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo del Principado de Asturias?",
      respuesta: "Se convocan 7 plazas para Auxiliar Administrativo del Principado de Asturias (OPE 2025, BOPA 29/12/2025). La convocatoria esta pendiente de publicacion."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo Asturias?",
      respuesta: "El programa consta de 25 temas en 3 bloques: Derecho Constitucional y Organizacion Administrativa (6 temas) sobre la Constitucion, AGE y Estatuto de Autonomia; Derecho Administrativo y Comunitario (14 temas) sobre UE, Ley 39/2015, Ley 40/2015, TREBEP, Seguridad Social, proteccion de datos e igualdad; y Ofimatica (5 temas) sobre Windows, Word, Excel y Access."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo Asturias?",
      respuesta: "El examen es un concurso-oposicion con dos ejercicios: un test de 90 preguntas con 4 opciones (2 horas, penalizacion de 1/3 por respuesta incorrecta) y un ejercicio practico de informatica con Word y Excel (1 hora)."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Derecho Constitucional y Organizacion Administrativa",
      temas: "6 temas (1-6)",
      color: "border-indigo-500",
      temasLista: [
        "1. La Constitucion Espanola de 1978 (I)",
        "2. La Constitucion Espanola de 1978 (II)",
        "3. La Constitucion Espanola de 1978 (III)",
        "4. La Administracion General del Estado",
        "5. El Estatuto de Autonomia del Principado de Asturias",
        "6. El Presidente y Consejo de Gobierno del Principado de Asturias"
      ]
    },
    {
      titulo: "Derecho Administrativo y Comunitario",
      temas: "14 temas (7-20)",
      color: "border-blue-500",
      temasLista: [
        "7. El Tratado de la Union Europea",
        "8. Ley 39/2015 de Procedimiento Administrativo Comun",
        "9. Ley 40/2015 de Regimen Juridico del Sector Publico",
        "10. Regimen Juridico de la Administracion del Principado de Asturias",
        "11. El Estatuto Basico del Empleado Publico",
        "12. Funcion Publica del Principado de Asturias",
        "13. Convenio Colectivo del personal laboral del Principado",
        "14. Regimen Economico y Presupuestario del Principado",
        "15. La Ley General de la Seguridad Social (I)",
        "16. La Ley General de la Seguridad Social (II)",
        "17. Atencion Ciudadana en el Principado de Asturias",
        "18. La documentacion administrativa",
        "19. Proteccion de datos y transparencia",
        "20. Igualdad y discapacidad"
      ]
    },
    {
      titulo: "Ofimatica",
      temas: "5 temas (21-25)",
      color: "border-purple-500",
      temasLista: [
        "21. Sistema operativo Windows",
        "22. Explorador de Windows",
        "23. Procesador de textos Word",
        "24. Hoja de calculo Excel",
        "25. Base de datos Access"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Principado de Asturias",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo del Principado de Asturias con temario oficial, tests y simulacros. 7 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-AST",
    "educationalLevel": "Graduado en ESO",
    "teaches": "25 temas oficiales del programa de Auxiliar Administrativo del Principado de Asturias"
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
            <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
              ⛰️ PRINCIPADO DE ASTURIAS - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Principado de Asturias
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para el Principado de Asturias con <strong>7 plazas convocadas</strong>.
              OPE 2025, BOPA 29/12/2025. Pendiente de convocatoria.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-asturias/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-asturias/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-indigo-300 transition-all"
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-asturias" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">25 temas en 3 bloques</p>
            <div className="grid md:grid-cols-3 gap-6">
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
                href="/auxiliar-administrativo-asturias/temario"
                className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
