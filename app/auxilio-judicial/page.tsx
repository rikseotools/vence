// app/auxilio-judicial/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxilio Judicial 2026 | Temario Oficial BOE y Convocatoria',
  description: 'Oposiciones Auxilio Judicial 2026: 425 plazas (382 libres + 43 discapacidad), temario oficial 26 temas BOE 30/12/2025. Administracion de Justicia.',
  keywords: [
    'auxilio judicial',
    'oposiciones auxilio judicial',
    'temario auxilio judicial',
    'administracion de justicia',
    'oposiciones 2026',
    'convocatoria auxilio judicial 2026',
    '26 temas auxilio',
    'requisitos auxilio judicial',
    'plazas auxilio judicial 2026'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxilio Judicial 2026 | Convocatoria Publicada - 425 Plazas',
    description: 'Oposiciones Auxilio Judicial: temario oficial 26 temas BOE 30/12/2025. Administracion de Justicia. 382 plazas libres + 43 discapacidad.',
    url: `${SITE_URL}/auxilio-judicial`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxilio Judicial 2026 | Convocatoria Publicada',
    description: '425 plazas. Temario 26 temas BOE 30/12/2025. Administracion de Justicia.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxilio-judicial`,
  },
}

export default function AuxilioJudicial() {
  const estadisticas = [
    { numero: "382", texto: "Plazas libres", color: "text-blue-600" },
    { numero: "26", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "3", texto: "Bloques", color: "text-purple-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BOE 2025",
      descripcion: "El temario consta de 26 temas distribuidos en 3 bloques tematicos segun BOE 30/12/2025.",
      stats: "26 temas - 3 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "100 preguntas test (100 min) + 40 preguntas practicas (60 min). Dos ejercicios el mismo dia.",
      stats: "140 preguntas total"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Graduado en ESO o equivalente, nacionalidad espanola o europea, 16 anos cumplidos.",
      stats: "ESO - +16 anos"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuantas plazas hay para Auxilio Judicial 2026?",
      respuesta: "Se convocan 425 plazas en total: 382 plazas de acceso libre y 43 plazas reservadas para personas con discapacidad."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxilio Judicial?",
      respuesta: "El programa segun BOE 30/12/2025 consta de 26 temas en 3 bloques: Derecho Constitucional (5 temas), Organizacion Judicial y Funcionarios (10 temas) y Procedimientos y Actos Procesales (11 temas)."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar a Auxilio Judicial?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente, y no estar inhabilitado para funciones publicas."
    },
    {
      pregunta: "¿Que diferencia hay entre Auxilio Judicial y Tramitacion Procesal?",
      respuesta: "Auxilio Judicial es grupo C2 (requiere ESO) con funciones de apoyo, notificaciones y actos de comunicacion. Tramitacion Procesal es grupo C1 (requiere Bachillerato) con funciones de tramitacion de procedimientos."
    },
    {
      pregunta: "¿Cual es el sueldo de un funcionario de Auxilio Judicial?",
      respuesta: "El sueldo del Grupo C2 en la Administracion de Justicia se situa entre 1.400-1.800 euros brutos mensuales, pudiendo alcanzar 20.000-24.000 euros anuales con complementos y trienios."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Derecho Constitucional y Organizacion del Estado",
      temas: "5 temas (1-5)",
      color: "border-blue-500",
      temasLista: [
        "1. La Constitucion Espanola de 1978",
        "2. Igualdad y no discriminacion",
        "3. El Gobierno y la Administracion",
        "4. Organizacion territorial del Estado",
        "5. La Union Europea"
      ]
    },
    {
      titulo: "Bloque II: Organizacion Judicial y Funcionarios",
      temas: "10 temas (6-15)",
      color: "border-purple-500",
      temasLista: [
        "6. El Poder Judicial",
        "7. Organos jurisdiccionales superiores",
        "8. Organos jurisdiccionales de instancia",
        "9. Derechos de los ciudadanos ante la Justicia",
        "10. Modernizacion de la oficina judicial",
        "11. El Letrado de la Administracion de Justicia",
        "12. Los Cuerpos de Funcionarios",
        "13. Ingreso y carrera de los funcionarios",
        "14. Situaciones administrativas y regimen disciplinario",
        "15. Libertad sindical y prevencion de riesgos"
      ]
    },
    {
      titulo: "Bloque III: Procedimientos y Actos Procesales",
      temas: "11 temas (16-26)",
      color: "border-green-500",
      temasLista: [
        "16. Procedimientos civiles declarativos",
        "17. Procedimientos civiles de ejecucion",
        "18. Procedimientos penales",
        "19. Procedimientos contencioso-administrativos",
        "20. El proceso laboral",
        "21. Los actos procesales",
        "22. Resoluciones de organos judiciales",
        "23. Comunicacion con tribunales y autoridades",
        "24. Comunicacion con las partes",
        "25. El Registro Civil",
        "26. El archivo judicial"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxilio Judicial 2026",
    "description": "Preparacion para las oposiciones de Auxilio Judicial con temario oficial BOE 30/12/2025, tests y simulacros. 425 plazas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUXILIO-JUDICIAL-2026",
    "educationalLevel": "ESO",
    "teaches": "26 temas oficiales del programa de Auxilio Judicial segun BOE 30/12/2025"
  }

  return (
    <>
      {/* Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              ⚖️ ADMINISTRACION DE JUSTICIA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxilio Judicial 2026
            </h1>

            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold animate-pulse">
                ¡Convocatoria oficial publicada en BOE 30/12/2025!
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Administracion de Justicia con <strong>425 plazas</strong> (382 libres + 43 discapacidad).
              Temario oficial segun BOE 30/12/2025.
            </p>

            {/* CTA Principal */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxilio-judicial/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxilio-judicial/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-300 transition-all"
              >
                <span className="text-xl">📚</span>
                <span>Ver Temario</span>
              </Link>
            </div>

            {/* Estadisticas */}
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
          </section>

          {/* Informacion de la Convocatoria 2026 */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026 - ¡Publicada en BOE!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">382</div>
                <div className="text-blue-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">43</div>
                <div className="text-blue-100 text-sm">Discapacidad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">26</div>
                <div className="text-blue-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">C2</div>
                <div className="text-blue-100 text-sm">Grupo</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">📋 BOE-A-2025-27053 (30 de diciembre de 2025)</h3>
              <p className="text-blue-100 text-sm">
                Convocatoria para el Cuerpo de Auxilio Judicial de la Administracion de Justicia.
              </p>
            </div>
            <p className="text-blue-100 text-sm">
              Nivel C2: Funciones de apoyo, notificaciones y actos de comunicacion. Requiere ESO o equivalente.
            </p>
          </div>

          {/* Temario Oficial BOE */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOE 30/12/2025</h2>
            <p className="text-center text-gray-600 mb-8">26 temas en 3 bloques</p>
            <div className="grid md:grid-cols-3 gap-6">
              {bloquesTematicos.map((bloque, index) => (
                <div key={index} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${bloque.color}`}>
                  <p className="text-xs text-gray-500 mb-1">{bloque.temas}</p>
                  <h3 className="text-base font-bold mb-3 text-gray-800">{bloque.titulo}</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {bloque.temasLista.map((tema, temaIndex) => (
                      <li key={temaIndex} className="flex items-start">
                        <span className="mr-1">-</span>
                        <span>{tema}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/auxilio-judicial/temario"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>📚</span>
                <span>Ver Temario Completo con Epigrafes</span>
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
