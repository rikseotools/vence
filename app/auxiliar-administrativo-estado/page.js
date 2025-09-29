// app/auxiliar-administrativo-estado/page.js
import Link from 'next/link'

const SITE_URL = process.env.SITE_URL || 'https://www.ilovetest.pro'

export const metadata = {
  title: 'Auxiliar Administrativo Estado 2025 | Tests y Temario Gratis Online',
  description: 'Prepara la oposición de Auxiliar Administrativo del Estado con tests gratuitos y temarios actualizados. 28 temas oficiales, 1200+ preguntas y exámenes oficiales.',
  keywords: [
    'auxiliar administrativo estado',
    'auxiliar administrativo del estado',
    'oposiciones auxiliar administrativo',
    'test auxiliar administrativo estado',
    'temario auxiliar administrativo',
    'oposiciones 2025',
    'examenes oficiales auxiliar administrativo',
    'preparar auxiliar administrativo gratis',
    '28 temas auxiliar administrativo',
    'convocatoria auxiliar administrativo 2025'
  ].join(', '),
  authors: [{ name: 'Tests Jurídicos España' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Estado 2025 | Preparación Completa Gratuita',
    description: 'Tests gratuitos, temarios descargables y exámenes oficiales para la oposición de Auxiliar Administrativo del Estado.',
    url: `${SITE_URL}/auxiliar-administrativo-estado`,
    siteName: 'Tests Jurídicos España',
    locale: 'es_ES',
    type: 'website',
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-estado`,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function AuxiliarAdministrativoEstado() {
  const estadisticas = [
    { numero: "28", texto: "Temas oficiales", color: "text-blue-600" },
    { numero: "125", texto: "Preguntas test", color: "text-green-600" },
    { numero: "2", texto: "Temas disponibles", color: "text-purple-600" },
    { numero: "100%", texto: "Actualizado 2025", color: "text-orange-600" }
  ]

  const serviciosPrincipales = [
    {
      icon: "📚",
      titulo: "Temarios Completos",
      descripcion: "28 temas del programa oficial actualizado con las últimas modificaciones de 2025.",
      enlace: "/auxiliar-administrativo-estado/temario",
      cta: "📚 Ver Temarios",
      stats: "28 temas • PDF descargable",
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      icon: "🎯", 
      titulo: "Tests y Exámenes",
      descripcion: "Tests específicos de cada tema y exámenes oficiales de convocatorias anteriores.",
      enlace: "/auxiliar-administrativo-estado/test",
      cta: "🎯 Empezar Tests",
      stats: "125 preguntas • 2 temas disponibles",
      color: "bg-green-600 hover:bg-green-700"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo del Estado 2025?",
      respuesta: "La convocatoria 2024 ofertó 2.450 plazas de turno libre más 2.033 de promoción interna. Para 2025 se espera una convocatoria similar en el tercer trimestre del año."
    },
    {
      pregunta: "¿Cuál es el temario oficial de Auxiliar Administrativo del Estado?",
      respuesta: "El temario consta de 28 temas divididos en: Organización del Estado (temas 1-14), Derecho Administrativo (temas 15-21), y Gestión de Personal y Hacienda Pública (temas 22-28). Todos actualizados según BOE 2024."
    },
    {
      pregunta: "¿Qué requisitos necesito para presentarme a la oposición?",
      respuesta: "Debes tener nacionalidad española o de la UE, ser mayor de 16 años, tener el título de ESO o equivalente, y no estar inhabilitado para el ejercicio de funciones públicas."
    },
    {
      pregunta: "¿Cómo es el examen de Auxiliar Administrativo del Estado?",
      respuesta: "El examen consta de un ejercicio único dividido en dos partes en 90 minutos: 60 preguntas (30 sobre el programa oficial y 30 psicotécnicas sobre aptitudes administrativas, numéricas y verbales) y 50 preguntas sobre conocimientos ofimáticos de Windows 10 y Microsoft 365."
    },
    {
      pregunta: "¿Cuál es el sueldo de un Auxiliar Administrativo del Estado?",
      respuesta: "El sueldo se sitúa entre 1.300-1.700€ brutos mensuales, perteneciendo al Grupo C2. El sueldo base anual es de aproximadamente 8.435€, pero con complementos, trienios y pagas extra puede alcanzar los 20.000-22.000€ anuales."
    },
    {
      pregunta: "¿Dónde puedo trabajar como Auxiliar Administrativo del Estado?",
      respuesta: "Puedes trabajar en cualquier ministerio, organismos autónomos, delegaciones territoriales, y otros entes públicos estatales en toda España, con posibilidad de elección de destino según la nota obtenida."
    }
  ]

  // Schema JSON-LD
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

  return (
    <>
      {/* Schema JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ ADMINISTRACIÓN GENERAL DEL ESTADO
            </span>
            
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo del Estado 2025
            </h1>
            
            <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
              Prepárate con tests gratuitos, temarios descargables y exámenes oficiales. 
              <strong> 28 temas oficiales</strong> según el BOE 2024.
            </p>
            
            {/* Estadísticas compactas */}
            <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto mb-8">
              {estadisticas.map((stat, index) => (
                <div key={index} className="bg-white rounded-lg p-3 shadow-sm border">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div>
                  <div className="text-gray-600 text-xs">{stat.texto}</div>
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

          {/* Información de la Convocatoria */}
          <div className="bg-blue-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🎯 Convocatoria 2024</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">2.450</div>
                <div className="text-blue-100 text-sm">Plazas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">14 Dic</div>
                <div className="text-blue-100 text-sm">Examen 2024</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">90 min</div>
                <div className="text-blue-100 text-sm">Duración</div>
              </div>
            </div>
            <p className="text-blue-100 text-sm">
              La convocatoria 2024 ya se celebró. <strong>¡Prepárate para 2025!</strong>
            </p>
          </div>

          {/* Descripción SEO de la Oposición */}
          <section className="mb-12">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                ¿Qué es la Oposición de Auxiliar Administrativo del Estado?
              </h2>
              
              <div className="prose max-w-none text-gray-700">
                <p className="text-lg mb-4">
                  La <strong>oposición de Auxiliar Administrativo del Estado</strong> es uno de los procesos selectivos más demandados de la Administración Pública española. Este puesto pertenece al <strong>Grupo C2</strong> según la clasificación del Estatuto Básico del Empleado Público.
                </p>
                
                <h3 className="text-xl font-semibold mt-6 mb-3">Funciones del Auxiliar Administrativo del Estado</h3>
                <p className="mb-4">
                  Los auxiliares administrativos del Estado realizan tareas de <strong>apoyo administrativo y gestión</strong> en los diferentes ministerios y organismos públicos. Sus principales funciones incluyen:
                </p>
                <ul className="list-disc pl-6 mb-6 space-y-2">
                  <li>Tramitación de expedientes administrativos</li>
                  <li>Atención al ciudadano presencial y telefónica</li>
                  <li>Gestión de archivo y documentación</li>
                  <li>Apoyo en tareas de secretaría y administración</li>
                  <li>Manejo de aplicaciones informáticas específicas</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">Requisitos y Proceso Selectivo</h3>
                <p className="mb-4">
                  Para acceder a esta oposición necesitas cumplir los <strong>requisitos básicos</strong>: tener nacionalidad española o de la UE, ser mayor de 16 años, poseer el título de ESO o equivalente, y no estar inhabilitado para funciones públicas.
                </p>
                <p className="mb-6">
                  El proceso selectivo consiste en un <strong>examen único</strong> dividido en dos partes que se realizan en una misma sesión de 90 minutos: 60 preguntas teóricas y psicotécnicas, y 50 preguntas de conocimientos ofimáticos sobre Windows 10 y Microsoft 365.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">Ventajas de ser Auxiliar Administrativo del Estado</h3>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">💼 Estabilidad Laboral</h4>
                    <p className="text-sm text-green-700">Trabajo fijo con todas las garantías del empleo público</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">📈 Desarrollo Profesional</h4>
                    <p className="text-sm text-blue-700">Posibilidades de promoción interna y formación continua</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🌍 Movilidad Geográfica</h4>
                    <p className="text-sm text-purple-700">Destinos en toda España según preferencias</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">⚖️ Conciliación</h4>
                    <p className="text-sm text-orange-700">Horarios compatibles con la vida personal</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="mb-10">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
               Preguntas Frecuentes sobre Auxiliar Administrativo del Estado
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
          <section className="bg-blue-600 rounded-lg shadow-lg p-6 text-white text-center">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto">
              Únete a miles de opositores que se preparan con nuestro material gratuito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link 
                href="/auxiliar-administrativo-estado/test"
                className="bg-white text-blue-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm"
              >
                🎯 Empezar Tests
              </Link>
              <Link 
                href="/auxiliar-administrativo-estado/temario"
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