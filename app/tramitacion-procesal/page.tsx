// app/tramitacion-procesal/page.js
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Tramitación Procesal y Administrativa 2026 | Temario Oficial BOE y Convocatoria',
  description: 'Oposiciones Tramitación Procesal 2026: 1.155 plazas (1.039 libres + 116 discapacidad), temario oficial 37 temas BOE 30/12/2025. Administración de Justicia.',
  keywords: [
    'tramitacion procesal',
    'oposiciones tramitacion procesal',
    'temario tramitacion procesal',
    'administracion de justicia',
    'oposiciones 2026',
    'convocatoria tramitacion procesal 2026',
    '37 temas tramitacion',
    'requisitos tramitacion procesal',
    'plazas tramitacion procesal 2026'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Tramitación Procesal y Administrativa 2026 | Convocatoria Publicada - 1.155 Plazas',
    description: 'Oposiciones Tramitación Procesal: temario oficial 37 temas BOE 30/12/2025. Administración de Justicia. 1.039 plazas libres + 116 discapacidad.',
    url: `${SITE_URL}/tramitacion-procesal`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tramitación Procesal y Administrativa 2026 | Convocatoria Publicada',
    description: '1.155 plazas. Temario 37 temas BOE 30/12/2025. Administración de Justicia.'
  },
  alternates: {
    canonical: `${SITE_URL}/tramitacion-procesal`,
  },
}

export default function TramitacionProcesal() {
  const estadisticas = [
    { numero: "1.039", texto: "Plazas libres", color: "text-purple-600" },
    { numero: "37", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "3", texto: "Bloques", color: "text-blue-600" },
    { numero: "Bach.", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BOE 2025",
      descripcion: "El temario consta de 37 temas distribuidos en 3 bloques temáticos según BOE 30/12/2025.",
      stats: "37 temas • 3 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test. Temario de derecho procesal (civil, penal, laboral, contencioso) e informática.",
      stats: "31 temas derecho • 6 informática"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Bachillerato o Técnico (FP Grado Medio), nacionalidad española o europea.",
      stats: "Bachillerato/FP • +18 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Tramitación Procesal 2026?",
      respuesta: "Se convocan 1.155 plazas en total: 1.039 plazas de acceso libre y 116 plazas reservadas para personas con discapacidad."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Tramitación Procesal?",
      respuesta: "El programa según BOE 30/12/2025 consta de 37 temas en 3 bloques: Organización del Estado y Administración de Justicia (15 temas), Derecho Procesal (16 temas) e Informática (6 temas)."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar a Tramitación Procesal?",
      respuesta: "Nacionalidad española o europea, tener 18 años cumplidos, título de Bachillerato o Técnico (FP Grado Medio), y no estar inhabilitado para funciones públicas."
    },
    {
      pregunta: "¿Qué diferencia hay entre Tramitación y Auxilio Judicial?",
      respuesta: "Tramitación Procesal es grupo C1 (requiere Bachillerato) con funciones de tramitación de procedimientos. Auxilio Judicial es grupo C2 (requiere ESO) con funciones de apoyo y notificaciones."
    },
    {
      pregunta: "¿Cuál es el sueldo de un funcionario de Tramitación Procesal?",
      respuesta: "El sueldo del Grupo C1 en la Administración de Justicia se sitúa entre 1.600-2.100€ brutos mensuales, pudiendo alcanzar 24.000-30.000€ anuales con complementos y trienios."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Organización del Estado y Administración de Justicia",
      temas: "15 temas (1-15)",
      color: "border-purple-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. Igualdad y no discriminación por razón de género",
        "3. El Gobierno y la Administración",
        "4. Organización territorial del Estado",
        "5. La Unión Europea",
        "6. El Poder Judicial",
        "7. Organización y competencia de los órganos judiciales (I)",
        "8. Organización y competencia de los órganos judiciales (II)",
        "9. Carta de Derechos de los Ciudadanos ante la Justicia",
        "10. La modernización de la oficina judicial",
        "11. El Letrado de la Administración de Justicia",
        "12. Los Cuerpos de funcionarios al servicio de la Administración de Justicia",
        "13. Los Cuerpos Generales (I)",
        "14. Los Cuerpos Generales (II)",
        "15. Libertad sindical"
      ]
    },
    {
      titulo: "Bloque II: Derecho Procesal",
      temas: "16 temas (16-31)",
      color: "border-blue-500",
      temasLista: [
        "16. Los procedimientos declarativos en la LEC",
        "17. Los procedimientos de ejecución en la LEC",
        "18. Los procesos especiales en la LEC",
        "19. La jurisdicción voluntaria",
        "20. Los procedimientos penales en la LECrim (I)",
        "21. Los procedimientos penales en la LECrim (II)",
        "22. El recurso contencioso-administrativo",
        "23. El proceso laboral",
        "24. Los recursos",
        "25. Los actos procesales",
        "26. Las resoluciones de los órganos judiciales",
        "27. Los actos de comunicación con otros tribunales",
        "28. Los actos de comunicación a las partes",
        "29. El Registro Civil (I)",
        "30. El Registro Civil (II)",
        "31. El archivo judicial y la documentación"
      ]
    },
    {
      titulo: "Bloque III: Informática",
      temas: "6 temas (32-37)",
      color: "border-green-500",
      temasLista: [
        "32. Informática básica",
        "33. Introducción al sistema operativo Windows",
        "34. El explorador de Windows",
        "35. Procesadores de texto: Word 365",
        "36. Correo electrónico: Outlook 365",
        "37. La Red Internet"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Tramitación Procesal y Administrativa 2026",
    "description": "Preparación para las oposiciones de Tramitación Procesal con temario oficial BOE 30/12/2025, tests y simulacros. 1.155 plazas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "TRAM-PROCESAL-2026",
    "educationalLevel": "Bachillerato",
    "teaches": "37 temas oficiales del programa de Tramitación Procesal según BOE 30/12/2025"
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
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              ⚖️ ADMINISTRACIÓN DE JUSTICIA - GRUPO C1
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Tramitación Procesal y Administrativa 2026
            </h1>

            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold animate-pulse">
                ¡Convocatoria oficial publicada en BOE 30/12/2025!
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Administración de Justicia con <strong>1.155 plazas</strong> (1.039 libres + 116 discapacidad).
              Temario oficial según BOE 30/12/2025.
            </p>

            {/* CTA Principal */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/tramitacion-procesal/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/tramitacion-procesal/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-purple-300 transition-all"
              >
                <span className="text-xl">📚</span>
                <span>Ver Temario</span>
              </Link>
            </div>

            {/* Estadísticas */}
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

          {/* Información de la Convocatoria 2026 */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026 - ¡Publicada en BOE!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">1.039</div>
                <div className="text-purple-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">116</div>
                <div className="text-purple-100 text-sm">Discapacidad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">37</div>
                <div className="text-purple-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">C1</div>
                <div className="text-purple-100 text-sm">Grupo</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">📋 BOE-A-2025-27053 (30 de diciembre de 2025)</h3>
              <p className="text-purple-100 text-sm">
                Convocatoria para el Cuerpo de Tramitación Procesal y Administrativa de la Administración de Justicia.
              </p>
            </div>
            <p className="text-purple-100 text-sm">
              Nivel C1: Funciones de tramitación de procedimientos judiciales. Requiere Bachillerato o equivalente.
            </p>
          </div>

          {/* Temario Oficial BOE */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOE 30/12/2025</h2>
            <p className="text-center text-gray-600 mb-8">37 temas en 3 bloques</p>
            <div className="grid md:grid-cols-3 gap-6">
              {bloquesTematicos.map((bloque, index) => (
                <div key={index} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${bloque.color}`}>
                  <p className="text-xs text-gray-500 mb-1">{bloque.temas}</p>
                  <h3 className="text-base font-bold mb-3 text-gray-800">{bloque.titulo}</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {bloque.temasLista.map((tema, temaIndex) => (
                      <li key={temaIndex} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{tema}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/tramitacion-procesal/temario"
                className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>📚</span>
                <span>Ver Temario Completo con Epígrafes</span>
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
