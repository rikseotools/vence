// app/auxiliar-administrativo-canarias/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Gobierno de Canarias 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Gobierno de Canarias: 299 plazas, temario oficial 40 temas, 2 bloques. OEP 2021 turno libre.',
  keywords: [
    'auxiliar administrativo canarias',
    'oposiciones auxiliar administrativo canarias',
    'temario auxiliar canarias',
    'oposiciones gobierno de canarias',
    'auxiliar administrativo gobierno canarias',
    '40 temas auxiliar canarias',
    'cuerpo auxiliar canarias',
    'plazas auxiliar administrativo canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Gobierno de Canarias | 299 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Gobierno de Canarias: temario oficial 40 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-canarias`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Gobierno de Canarias',
    description: '299 plazas. Temario 40 temas. Gobierno de Canarias.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-canarias`,
  },
}

export default function AuxiliarAdministrativoCanarias() {
  const estadisticas = [
    { numero: "299", texto: "Plazas convocadas", color: "text-amber-600" },
    { numero: "40", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 40 temas distribuidos en 2 bloques: Parte General (20 temas) y Parte Practica (20 temas).",
      stats: "40 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Ejercicio unico con dos partes: 50 preguntas de la parte general y 25 preguntas del supuesto practico. Penalizacion por respuestas incorrectas.",
      stats: "75 preguntas \u2022 Penalizacion"
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
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo del Gobierno de Canarias?",
      respuesta: "Se convocan 299 plazas (285 turno libre + 14 discapacidad) para el Cuerpo Auxiliar de la Administracion Publica de la Comunidad Autonoma de Canarias."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo Canarias?",
      respuesta: "El programa consta de 40 temas en 2 bloques: Parte General (20 temas) sobre Constitucion, Autonomia, UE, Igualdad y Funcion Publica, y Parte Practica (20 temas) sobre Administracion, Procedimiento, Contratos y Ofimatica."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo de Canarias?",
      respuesta: "El examen consta de un ejercicio unico con dos partes: 50 preguntas tipo test de la parte general y 25 preguntas de supuesto practico. Las respuestas incorrectas penalizan."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Parte General",
      temas: "20 temas (1-20)",
      color: "border-amber-500",
      temasLista: [
        "1. La Constitucion Espanola de 1978",
        "2. La organizacion territorial del Estado",
        "3. El Estatuto de Autonomia de Canarias (I)",
        "4. El Estatuto de Autonomia de Canarias (II)",
        "5. Las Instituciones Autonomicas de Canarias",
        "6. El Gobierno de Canarias",
        "7. Las islas y la Comunidad Autonoma de Canarias",
        "8. El Presupuesto de la Comunidad Autonoma de Canarias",
        "9. La organizacion de la Union Europea",
        "10. Igualdad efectiva de mujeres y hombres",
        "11. Violencia de genero y discapacidad",
        "12. Actividad de las Administraciones Publicas",
        "13. Atencion al ciudadano",
        "14. La transparencia de la actividad publica",
        "15. Proteccion de datos de caracter personal",
        "16. La competencia administrativa",
        "17. El personal al servicio de las AAPP",
        "18. La seleccion del personal funcionario y laboral",
        "19. Las situaciones administrativas",
        "20. Derechos y deberes de los empleados publicos"
      ]
    },
    {
      titulo: "Parte Practica",
      temas: "20 temas (21-40)",
      color: "border-blue-500",
      temasLista: [
        "21. Organizacion de la Admin. Publica de Canarias",
        "22. Acceso electronico a los servicios publicos",
        "23. El acto administrativo",
        "24. Validez e invalidez de los actos",
        "25. Eficacia, notificacion y publicacion",
        "26. La revision de oficio",
        "27. El procedimiento administrativo",
        "28. Fases del procedimiento administrativo",
        "29. Los recursos administrativos",
        "30. Los recursos ordinarios",
        "31. Contratacion publica (I)",
        "32. Contratacion publica (II)",
        "33. Contratacion publica (III)",
        "34. Ayudas y subvenciones",
        "35. Funcionamiento electronico del sector publico",
        "36. Los documentos administrativos",
        "37. El sistema operativo Windows",
        "38. El explorador de Windows",
        "39. Documentos administrativos (practico)",
        "40. Archivo de la Admin. Publica de Canarias"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Gobierno de Canarias",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo del Gobierno de Canarias con temario oficial, tests y simulacros. 299 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-CANARIAS",
    "educationalLevel": "Graduado en ESO",
    "teaches": "40 temas oficiales del programa de Auxiliar Administrativo del Gobierno de Canarias"
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
              🏝️ GOBIERNO DE CANARIAS - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Gobierno de Canarias
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para el Gobierno de Canarias con <strong>299 plazas convocadas</strong>.
              OEP 2021 turno libre.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-canarias/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-canarias/temario"
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

          {/* Informacion del Temario */}
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-canarias" />
            </div>
          </section>

          {/* Temario Oficial */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">40 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-canarias/temario"
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
