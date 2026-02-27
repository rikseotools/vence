// app/auxiliar-administrativo-cyl/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Castilla y León 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Castilla y León 2026: 362 plazas, temario oficial 28 temas BOCYL enero 2026. Junta de Castilla y León.',
  keywords: [
    'auxiliar administrativo castilla y leon',
    'oposiciones auxiliar administrativo cyl',
    'temario auxiliar castilla y leon',
    'oposiciones castilla y leon 2026',
    'auxiliar administrativo junta castilla y leon',
    '28 temas auxiliar cyl',
    'requisitos auxiliar cyl',
    'plazas auxiliar administrativo castilla y leon'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Castilla y León 2026 | 362 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Castilla y León: temario oficial 28 temas. Junta de Castilla y León.',
    url: `${SITE_URL}/auxiliar-administrativo-cyl`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Castilla y León 2026',
    description: '362 plazas. Temario 28 temas BOCYL enero 2026. Junta de Castilla y León.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-cyl`,
  },
}

export default function AuxiliarAdministrativoCyl() {
  const estadisticas = [
    { numero: "362", texto: "Plazas", color: "text-rose-600" },
    { numero: "28", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Grupos", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BOCYL",
      descripcion: "El temario consta de 28 temas distribuidos en 2 grupos temáticos según BOCYL enero 2026.",
      stats: "28 temas \u2022 2 grupos"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "60 preguntas tipo test + 20 preguntas de supuesto práctico Office 365. Tiempo total: 100 minutos.",
      stats: "80 preguntas \u2022 100 minutos"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Graduado en ESO o equivalente, nacionalidad española o europea. Grupo C2.",
      stats: "ESO/equivalente \u2022 +18 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de Castilla y León 2026?",
      respuesta: "Se convocan 362 plazas para Auxiliar Administrativo de la Junta de Castilla y León, según convocatoria publicada en el BOCYL en enero de 2026."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo CyL?",
      respuesta: "El programa consta de 28 temas en 2 grupos: Grupo I (19 temas) sobre Organización Política y Administrativa, y Grupo II (9 temas) sobre Competencias profesionales."
    },
    {
      pregunta: "¿Cómo es el examen de Auxiliar Administrativo de Castilla y León?",
      respuesta: "El examen consta de 60 preguntas tipo test sobre el temario más 20 preguntas de un supuesto práctico sobre Office 365. Tiempo total: 100 minutos."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: "Nacionalidad española o europea, tener 18 años cumplidos, título de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones públicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Grupo I: Organización Política y Administrativa",
      temas: "19 temas (1-19)",
      color: "border-rose-500",
      temasLista: [
        "1. La Constitución Española",
        "2. La Administración General del Estado",
        "3. La Administración local y organización territorial de CyL",
        "4. La Unión Europea",
        "5. El Estatuto de Autonomía de Castilla y León",
        "6. Las Cortes de Castilla y León",
        "7. Instituciones propias de CyL",
        "8. El Gobierno de CyL",
        "9. La Administración de CyL",
        "10. El sector público de CyL",
        "11. Las fuentes del derecho administrativo",
        "12. El acto administrativo",
        "13. El procedimiento administrativo común",
        "14. Órganos de las Administraciones Públicas",
        "15. El Estatuto Básico del Empleado Público",
        "16. La Función Pública de Castilla y León",
        "17. Sindicación, huelga e incompatibilidades",
        "18. El presupuesto de CyL",
        "19. Políticas de igualdad y no discriminación en CyL"
      ]
    },
    {
      titulo: "Grupo II: Competencias",
      temas: "9 temas (20-28)",
      color: "border-blue-500",
      temasLista: [
        "20. Derechos de las personas y atención al público",
        "21. Oficinas de asistencia en materia de registros",
        "22. Administración electrónica",
        "23. Transparencia y protección de datos",
        "24. El documento y archivo administrativo",
        "25. Informática básica y Windows 11",
        "26. Word y Excel para Microsoft 365",
        "27. Correo electrónico e Internet",
        "28. Seguridad y salud en el puesto de trabajo"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Castilla y León 2026",
    "description": "Preparación para las oposiciones de Auxiliar Administrativo de la Junta de Castilla y León con temario oficial BOCYL, tests y simulacros. 362 plazas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-CYL-2026",
    "educationalLevel": "Graduado en ESO",
    "teaches": "28 temas oficiales del programa de Auxiliar Administrativo de Castilla y León según BOCYL enero 2026"
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
            <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ JUNTA DE CASTILLA Y LEÓN - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Castilla y León 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Junta de Castilla y León con <strong>362 plazas</strong>.
              Temario oficial según BOCYL enero 2026.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-cyl/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-cyl/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-rose-300 transition-all"
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
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOCYL enero 2026</h2>
            <p className="text-center text-gray-600 mb-8">28 temas en 2 grupos</p>
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
                href="/auxiliar-administrativo-cyl/temario"
                className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
