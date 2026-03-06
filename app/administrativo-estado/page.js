// app/administrativo-estado/page.js
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Administrativo del Estado 2026 | Tests y Temario Gratis Online',
  description: 'Prepara la oposición de Administrativo del Estado con tests gratuitos y temarios actualizados. 45 temas oficiales BOE 2025, 2.512 plazas convocatoria publicada.',
  keywords: [
    'administrativo del estado',
    'oposiciones administrativo estado',
    'test administrativo del estado',
    'temario administrativo del estado gratis',
    'oposiciones 2026',
    'convocatoria administrativo estado 2026',
    '45 temas administrativo',
    'preparar administrativo estado gratis',
    'examenes administrativo estado',
    'plazas administrativo estado 2026'
  ].join(', '),
  authors: [{ name: 'Vence - Preparación Oposiciones' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Administrativo del Estado 2026 | Preparación Completa Gratuita',
    description: 'Tests gratuitos y temario oficial BOE 22/12/2025 para la oposición de Administrativo del Estado. ¡Convocatoria publicada! 2.512 plazas.',
    url: `${SITE_URL}/administrativo-estado`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Administrativo del Estado 2026 | Convocatoria Publicada',
    description: '2.512 plazas turno libre. Temario 45 temas BOE 22/12/2025. Tests gratuitos online.'
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado`,
  },
  robots: {
    index: true,
    follow: true,
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
      respuesta: "La convocatoria fue publicada en BOE el 22/12/2025. Según el INAP, el examen está previsto para el 23 de mayo de 2026."
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

  // Schema JSON-LD - FAQPage para mejor SEO
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.pregunta,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.respuesta
      }
    }))
  }

  const serviciosPrincipales = [
    {
      icon: "📚",
      titulo: "Temarios Completos",
      descripcion: "45 temas del programa oficial según BOE 22/12/2025. 6 bloques temáticos completos.",
      enlace: "/administrativo-estado/temario",
      cta: "📚 Ver Temarios",
      stats: "45 temas • 6 bloques • BOE 2025",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      icon: "🎯",
      titulo: "Tests y Exámenes",
      descripcion: "Tests específicos de cada tema con preguntas actualizadas al temario 2025.",
      enlace: "/administrativo-estado/test",
      cta: "🎯 Empezar Tests",
      stats: "Todos los temas • Tests ilimitados",
      color: "bg-green-600 hover:bg-green-700"
    }
  ]

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
              <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                Convocatoria oficial publicada - Examen previsto 23 de mayo de 2026
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición de nivel superior (C1) con <strong>2.512 plazas en turno libre</strong>.
              Temario oficial según BOE 22/12/2025. Examen previsto mayo 2026.
            </p>

            {/* CTA Principal */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/administrativo-estado/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/administrativo-estado/test/aleatorio"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-300 transition-all"
              >
                <span className="text-xl">🎲</span>
                <span>Test Aleatorio</span>
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

          {/* Material de Preparación - PRIMERO */}
          <section className="mb-10">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
              🎯 Material de Preparación
            </h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {serviciosPrincipales.map((servicio, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1 border">
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <span className="text-3xl mr-3">{servicio.icon}</span>
                      <h3 className="text-xl font-bold text-gray-800">{servicio.titulo}</h3>
                    </div>

                    <p className="text-gray-600 mb-4 leading-relaxed">
                      {servicio.descripcion}
                    </p>

                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-6">
                      <span className="text-sm text-gray-700 font-medium">{servicio.stats}</span>
                    </div>

                    <Link
                      href={servicio.enlace}
                      className={`w-full block text-center text-white px-6 py-3 rounded-lg font-bold ${servicio.color} transition-colors`}
                    >
                      {servicio.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

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
                <strong>Plazo de inscripción cerrado.</strong> Examen previsto para el 23 de mayo de 2026.
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

          {/* Descripción SEO de la Oposición */}
          <section className="mb-12">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                ¿Qué es la Oposición de Administrativo del Estado?
              </h2>

              <div className="prose max-w-none text-gray-700">
                <p className="text-lg mb-4">
                  La <strong>oposición de Administrativo del Estado</strong> es uno de los procesos selectivos más demandados del <strong>Grupo C1</strong> en la Administración General del Estado. Es el nivel superior al de Auxiliar Administrativo y ofrece mayores responsabilidades y retribución.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">Funciones del Administrativo del Estado</h3>
                <p className="mb-4">
                  Los administrativos del Estado realizan tareas de <strong>gestión administrativa de nivel medio-alto</strong> en ministerios y organismos públicos. Sus principales funciones incluyen:
                </p>
                <ul className="list-disc pl-6 mb-6 space-y-2">
                  <li>Gestión y tramitación de expedientes complejos</li>
                  <li>Elaboración de informes y propuestas administrativas</li>
                  <li>Gestión presupuestaria y contratación pública</li>
                  <li>Coordinación de equipos de auxiliares administrativos</li>
                  <li>Atención especializada al ciudadano</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">Requisitos y Proceso Selectivo</h3>
                <p className="mb-4">
                  Para acceder a esta oposición necesitas cumplir los <strong>requisitos básicos</strong>: nacionalidad española o de la UE, tener 16 años y no exceder la edad de jubilación, poseer el título de <strong>Bachillerato o Técnico (FP Grado Medio)</strong>, y no estar inhabilitado para funciones públicas.
                </p>
                <p className="mb-6">
                  El proceso selectivo consiste en un <strong>examen único tipo test</strong> con preguntas teóricas sobre los 45 temas del programa oficial y supuestos prácticos.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">Ventajas de ser Administrativo del Estado</h3>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">💼 Estabilidad Laboral</h4>
                    <p className="text-sm text-green-700">Trabajo fijo con todas las garantías del empleo público</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">💰 Mayor Retribución</h4>
                    <p className="text-sm text-blue-700">Sueldo superior al C2, entre 24.000-30.000€ anuales</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">📈 Desarrollo Profesional</h4>
                    <p className="text-sm text-purple-700">Promoción interna a Grupo B y formación continua</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">🌍 Movilidad Geográfica</h4>
                    <p className="text-sm text-orange-700">Destinos en toda España según preferencias</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQs */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
              Preguntas Frecuentes sobre Administrativo del Estado
            </h2>
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-gray-200 rounded-lg mb-4 p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{faq.pregunta}</h3>
                  <p className="text-gray-600 leading-relaxed">{faq.respuesta}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA Final */}
          <section className="bg-blue-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto">
              Únete a miles de opositores que se preparan con nuestro material gratuito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link
                href="/administrativo-estado/test"
                className="bg-white text-blue-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm"
              >
                🎯 Empezar Tests
              </Link>
              <Link
                href="/administrativo-estado/temario"
                className="bg-yellow-500 text-blue-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm"
              >
                📚 Ver Temarios
              </Link>
            </div>
          </section>

        </div>
      </div>
    </>
  )
}