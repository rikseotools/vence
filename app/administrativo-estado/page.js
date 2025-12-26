// app/administrativo-estado/page.js
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Administrativo del Estado 2026 | Temario Oficial BOE y Convocatoria',
  description: 'Oposiciones Administrativo del Estado 2026: 2.512 plazas turno libre, temario oficial 45 temas BOE 22/12/2025. Inscripción hasta 22 enero 2026.',
  keywords: [
    'administrativo del estado',
    'oposiciones administrativo estado',
    'temario administrativo del estado',
    'programa administrativo estado',
    'oposiciones 2026',
    'convocatoria administrativo estado 2026',
    '45 temas administrativo',
    'requisitos administrativo estado',
    'plazas administrativo estado 2026'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Administrativo del Estado 2026 | Convocatoria Publicada - 2.512 Plazas',
    description: 'Oposiciones Administrativo del Estado: temario oficial 45 temas BOE 22/12/2025. Inscripción hasta 22 enero 2026. Examen mayo 2026.',
    url: `${SITE_URL}/administrativo-estado`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Administrativo del Estado 2026 | Convocatoria Publicada',
    description: '2.512 plazas turno libre. Temario 45 temas BOE 22/12/2025. Inscripción hasta 22 enero 2026.'
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado`,
  },
}

export default function AdministrativoEstado() {
  const estadisticas = [
    { numero: "2.512", texto: "Plazas libres", color: "text-blue-600" },
    { numero: "45", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "6", texto: "Bloques", color: "text-purple-600" },
    { numero: "Bach.", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial BOE 2025",
      descripcion: "El temario consta de 45 temas distribuidos en 6 bloques temáticos según BOE 22/12/2025.",
      stats: "45 temas • 6 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test único. Parte teórica y supuestos prácticos. Previsto para mayo 2026.",
      stats: "Examen único • Mayo 2026"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Título de Bachillerato o Técnico (FP Grado Medio), nacionalidad española o europea.",
      stats: "Bachillerato/FP • +16 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuándo es el examen de Administrativo del Estado 2026?",
      respuesta: "La convocatoria fue publicada en BOE el 22/12/2025. Según el INAP, el examen está previsto para el 23 de mayo de 2026. Inscripciones hasta el 22 de enero de 2026."
    },
    {
      pregunta: "¿Cuántas plazas hay para Administrativo del Estado 2026?",
      respuesta: "Se convocan 2.512 plazas en turno libre (2.282 acceso general + 230 reservadas para discapacidad) y 6.178 plazas en promoción interna."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Administrativo del Estado?",
      respuesta: "El programa según BOE 22/12/2025 consta de 45 temas en 6 bloques: Organización del Estado (11), Organización de Oficinas (4), Derecho Administrativo (7), Gestión de Personal (9), Gestión Financiera (6) e Informática y Ofimática (8). Novedades: políticas LGTBI y Copilot de Windows."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar a Administrativo del Estado?",
      respuesta: "Nacionalidad española o europea, tener 16 años y no exceder edad de jubilación, título de Bachillerato o Técnico (FP Grado Medio), y no estar inhabilitado para funciones públicas."
    },
    {
      pregunta: "¿En qué consiste el examen de Administrativo del Estado?",
      respuesta: "El proceso selectivo consiste en un ejercicio único tipo test que incluye parte teórica sobre los 45 temas del programa y supuestos prácticos."
    },
    {
      pregunta: "¿Cuál es el sueldo de un Administrativo del Estado?",
      respuesta: "El sueldo del Grupo C1 se sitúa entre 1.600-2.000€ brutos mensuales. Con complementos, trienios y pagas extra puede alcanzar 24.000-30.000€ anuales dependiendo del destino."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Organización del Estado y Administración Pública",
      temas: "11 temas (1-11)",
      color: "border-blue-500",
      temasLista: [
        "1. La Constitución Española de 1978",
        "2. La Jefatura del Estado. La Corona",
        "3. Las Cortes Generales",
        "4. El Poder Judicial",
        "5. El Gobierno y la Administración",
        "6. El Gobierno Abierto",
        "7. La Ley 19/2013 de transparencia",
        "8. La Administración General del Estado",
        "9. La Organización territorial del Estado",
        "10. La Administración local",
        "11. La organización de la Unión Europea"
      ]
    },
    {
      titulo: "Bloque II: Organización de Oficinas Públicas",
      temas: "4 temas (12-15)",
      color: "border-green-500",
      temasLista: [
        "12. Atención al público",
        "13. Documento, registro y archivo",
        "14. Administración electrónica",
        "15. Protección de datos personales"
      ]
    },
    {
      titulo: "Bloque III: Derecho Administrativo General",
      temas: "7 temas (16-22)",
      color: "border-purple-500",
      temasLista: [
        "16. Las fuentes del derecho administrativo",
        "17. El acto administrativo",
        "18. Las Leyes del Procedimiento Administrativo",
        "19. Los contratos del sector público",
        "20. Procedimientos y formas de la actividad administrativa",
        "21. La responsabilidad patrimonial",
        "22. Políticas de igualdad ⭐ LGTBI nuevo"
      ]
    },
    {
      titulo: "Bloque IV: Gestión de Personal",
      temas: "9 temas (23-31)",
      color: "border-orange-500",
      temasLista: [
        "23. El personal al servicio de las Administraciones públicas",
        "24. Selección de personal",
        "25. El personal funcionario",
        "26. Adquisición y pérdida de la condición de funcionario",
        "27. Provisión de puestos de trabajo",
        "28. Las incompatibilidades y régimen disciplinario",
        "29. El régimen de la Seguridad Social de los funcionarios",
        "30. El personal laboral",
        "31. El régimen de la Seguridad Social del personal laboral"
      ]
    },
    {
      titulo: "Bloque V: Gestión Financiera",
      temas: "6 temas (32-37)",
      color: "border-red-500",
      temasLista: [
        "32. El presupuesto",
        "33. El presupuesto del Estado en España",
        "34. El procedimiento administrativo de ejecución del presupuesto",
        "35. Las retribuciones e indemnizaciones",
        "36. Gastos para la compra de bienes y servicios",
        "37. Gestión económica y financiera"
      ]
    },
    {
      titulo: "Bloque VI: Informática Básica y Ofimática",
      temas: "8 temas (38-45)",
      color: "border-indigo-500",
      temasLista: [
        "38. Informática básica",
        "39. Sistema operativo Windows ⭐ Copilot nuevo",
        "40. El explorador de Windows",
        "41. Procesadores de texto: Word 365",
        "42. Hojas de cálculo: Excel 365",
        "43. Bases de datos: Access 365",
        "44. Correo electrónico: Outlook 365",
        "45. La Red Internet"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Administrativo del Estado 2026",
    "description": "Preparación para las oposiciones de Administrativo del Estado con temario oficial BOE 22/12/2025, tests y simulacros. 2.512 plazas turno libre.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "ADM-ESTADO-2026",
    "educationalLevel": "Bachillerato",
    "teaches": "45 temas oficiales del programa de Administrativo del Estado según BOE 22/12/2025"
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
              🏢 ADMINISTRACIÓN GENERAL DEL ESTADO - GRUPO C1
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Administrativo del Estado 2026
            </h1>

            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold animate-pulse">
                ¡Convocatoria oficial publicada! Inscríbete hasta el 22 de enero de 2026
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición de nivel superior (C1) con <strong>2.512 plazas en turno libre</strong>.
              Temario oficial según BOE 22/12/2025. Examen previsto mayo 2026.
            </p>

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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026 - ¡Publicada en BOE!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">2.512</div>
                <div className="text-blue-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">6.178</div>
                <div className="text-blue-100 text-sm">Promoción int.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">45</div>
                <div className="text-blue-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">Mayo</div>
                <div className="text-blue-100 text-sm">Examen 2026</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">📋 BOE-A-2025-26262 (22 de diciembre de 2025)</h3>
              <p className="text-blue-100 text-sm">
                <strong>Plazo de inscripción: hasta el 22 de enero de 2026.</strong> Inscripción online mediante sistema IPS y Cl@ve.
              </p>
            </div>
            <p className="text-blue-100 text-sm">
              Nivel C1: Mayor responsabilidad y sueldo que C2. Novedades del temario: políticas LGTBI y Copilot de Windows.
            </p>
          </div>

          {/* Temario Oficial BOE */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOE 22/12/2025</h2>
            <p className="text-center text-gray-600 mb-8">45 temas en 6 bloques</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bloquesTematicos.map((bloque, index) => (
                <div key={index} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${bloque.color}`}>
                  <p className="text-xs text-gray-500 mb-1">{bloque.temas}</p>
                  <h3 className="text-base font-bold mb-3 text-gray-800">{bloque.titulo}</h3>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {bloque.temasLista.map((tema, temaIndex) => (
                      <li key={temaIndex} className="flex items-start">
                        <span className="mr-1">•</span>
                        <span>{tema.includes('⭐') ? (
                          <>
                            {tema.replace(' ⭐', '')}
                            <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1 rounded">nuevo</span>
                          </>
                        ) : tema}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href="/administrativo-estado/temario"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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