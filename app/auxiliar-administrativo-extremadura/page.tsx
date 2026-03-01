// app/auxiliar-administrativo-extremadura/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Junta de Extremadura 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Junta de Extremadura: 146 plazas, temario oficial 25 temas, 2 bloques. DOE 27/12/2024.',
  keywords: [
    'auxiliar administrativo extremadura',
    'oposiciones auxiliar administrativo extremadura',
    'temario auxiliar extremadura',
    'oposiciones junta extremadura',
    'auxiliar administrativo junta extremadura',
    '25 temas auxiliar extremadura',
    'cuerpo auxiliar extremadura',
    'plazas auxiliar administrativo extremadura'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Junta de Extremadura | 146 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Junta de Extremadura: temario oficial 25 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-extremadura`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Junta de Extremadura',
    description: '146 plazas. Temario 25 temas. Junta de Extremadura.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-extremadura`,
  },
}

export default function AuxiliarAdministrativoExtremadura() {
  const estadisticas = [
    { numero: "146", texto: "Plazas convocadas", color: "text-teal-600" },
    { numero: "25", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-teal-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 25 temas distribuidos en 2 bloques: Empleo Publico y Organizacion (14 temas) y Derecho Administrativo y Ofimatica (11 temas).",
      stats: "25 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Ejercicio unico teorico-practico: 43 preguntas (35 teoricas + 8 practicas de ofimatica), 85 minutos. Concurso-oposicion (10+3 puntos).",
      stats: "43 preguntas \u2022 85 minutos"
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
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo de la Junta de Extremadura?",
      respuesta: "Se convocan 146 plazas (126 turno libre + 20 discapacidad) para el Cuerpo Auxiliar, Especialidad Administracion General, de la Junta de Extremadura. Acumulacion OEP 2021+2022+2023."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo Extremadura?",
      respuesta: "El programa consta de 25 temas en 2 bloques: Empleo Publico y Organizacion (14 temas) sobre Estatuto Autonomia, TREBEP, Funcion Publica Extremadura, PRL e Igualdad; y Derecho Administrativo y Ofimatica (11 temas) sobre Ley 39/2015, Ley 40/2015, Contratacion, Administracion electronica, Windows y Office 365."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo Extremadura?",
      respuesta: "El examen consta de un ejercicio unico teorico-practico con 43 preguntas: 35 teoricas y 8 practicas de ofimatica. Duracion 85 minutos. Sistema concurso-oposicion (10 puntos oposicion + 3 puntos concurso)."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Empleo Publico y Organizacion",
      temas: "14 temas (1-14)",
      color: "border-teal-500",
      temasLista: [
        "1. Gobierno y Administracion de la CAE (I)",
        "2. Gobierno y Administracion de la CAE (II)",
        "3. Estatuto Basico del Empleado Publico",
        "4. Funcion Publica de Extremadura (I)",
        "5. Funcion Publica de Extremadura (II)",
        "6. Funcion Publica de Extremadura (III)",
        "7. Funcion Publica de Extremadura (IV)",
        "8. Funcion Publica de Extremadura (V)",
        "9. Funcion Publica de Extremadura (VI)",
        "10. Personal Laboral CC (I)",
        "11. Personal Laboral CC (II)",
        "12. Personal Laboral CC (III)",
        "13. Prevencion de Riesgos Laborales",
        "14. Igualdad y violencia de genero en Extremadura"
      ]
    },
    {
      titulo: "Derecho Administrativo y Ofimatica",
      temas: "11 temas (15-25)",
      color: "border-blue-500",
      temasLista: [
        "15. Regimen Juridico del Sector Publico (I)",
        "16. Regimen Juridico del Sector Publico (II)",
        "17. Procedimiento Administrativo Comun (I)",
        "18. Procedimiento Administrativo Comun (II)",
        "19. Procedimiento Administrativo Comun (III)",
        "20. Contratacion del Sector Publico",
        "21. Documento, registro y archivo",
        "22. Administracion electronica Extremadura (I)",
        "23. Administracion electronica Extremadura (II)",
        "24. Windows 10",
        "25. Office 365: Word y Excel"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Junta de Extremadura",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la Junta de Extremadura con temario oficial, tests y simulacros. 146 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-EXT",
    "educationalLevel": "Graduado en ESO",
    "teaches": "25 temas oficiales del programa de Auxiliar Administrativo de la Junta de Extremadura"
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
            <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium">
              🌿 JUNTA DE EXTREMADURA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Junta de Extremadura
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Junta de Extremadura con <strong>146 plazas convocadas</strong>.
              Convocatoria DOE 27/12/2024. Acumulacion OEP 2021+2022+2023.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-extremadura/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-extremadura/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-teal-300 transition-all"
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-extremadura" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">25 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-extremadura/temario"
                className="inline-flex items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
