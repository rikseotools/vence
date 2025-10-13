// app/administrativo-estado/page.js
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Administrativo del Estado 2025 | Temario Oficial y Programa Completo',
  description: 'Información completa sobre las oposiciones de Administrativo del Estado 2025: temario oficial de 45 temas, requisitos, estructura del examen y convocatoria.',
  keywords: [
    'administrativo del estado',
    'oposiciones administrativo estado',
    'temario administrativo del estado',
    'programa administrativo estado',
    'oposiciones 2025',
    'convocatoria administrativo estado',
    '45 temas administrativo',
    'requisitos administrativo estado',
    'oferta empleo publico administrativo 2025'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Administrativo del Estado 2025 | Temario y Programa Oficial',
    description: 'Información completa sobre las oposiciones de Administrativo del Estado: temario de 45 temas, requisitos y estructura del examen.',
    url: `${SITE_URL}/administrativo-estado`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Administrativo del Estado 2025 | Temario Oficial',
    description: 'Información sobre el temario de 45 temas, requisitos y estructura del examen de Administrativo del Estado.'
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado`,
  },
}

export default function AdministrativoEstado() {
  const estadisticas = [
    { numero: "1.200", texto: "Plazas 2025", color: "text-blue-600" },
    { numero: "150", texto: "Preguntas examen", color: "text-green-600" },
    { numero: "120", texto: "Minutos examen", color: "text-purple-600" },
    { numero: "Bach.", texto: "Título requerido", color: "text-orange-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 45 temas distribuidos en 6 bloques temáticos según la última convocatoria.",
      stats: "45 temas • 6 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Examen tipo test de 150 preguntas con 4 opciones de respuesta y 120 minutos de duración.",
      stats: "150 preguntas • 120 minutos"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Se requiere título de Bachillerato o equivalente, nacionalidad española o europea.",
      stats: "Bachillerato • +16 años"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Administrativo del Estado 2025?",
      respuesta: "La OEP 2025 incluye aproximadamente 1.200 plazas para Administrativo del Estado. La convocatoria específica se espera para el segundo semestre de 2025 con todos los detalles oficiales."
    },
    {
      pregunta: "¿Cuál es el programa oficial de Administrativo del Estado?",
      respuesta: "El programa consta de 45 temas distribuidos en 6 bloques: Organización del Estado (11 temas), Organización de Oficinas Públicas (4 temas), Derecho Administrativo General (7 temas), Gestión de Personal (9 temas), Gestión Financiera (6 temas) y Ofimática e Informática Básica (8 temas)."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar a Administrativo del Estado?",
      respuesta: "Necesitas tener nacionalidad española o europea, ser mayor de 16 años, poseer título de Bachillerato o equivalente, no estar inhabilitado para ejercer funciones públicas y no padecer enfermedad que impida el desempeño del puesto."
    },
    {
      pregunta: "¿En qué consiste el examen de Administrativo del Estado?",
      respuesta: "El examen consta de 150 preguntas tipo test con 4 opciones de respuesta, con tiempo límite de 120 minutos. Se evalúan los 45 temas del programa oficial. Las respuestas incorrectas no penalizan."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Bloque I: Organización del Estado",
      temas: "11 temas",
      descripcion: "Constitución Española, Poderes del Estado, Gobierno Abierto, Administración Pública y Unión Europea",
      color: "bg-blue-100 text-blue-800"
    },
    {
      titulo: "Bloque II: Organización de Oficinas",
      temas: "4 temas", 
      descripcion: "Atención al público, documentos y registro, administración electrónica y protección de datos",
      color: "bg-green-100 text-green-800"
    },
    {
      titulo: "Bloque III: Derecho Administrativo",
      temas: "7 temas",
      descripcion: "Fuentes del derecho, acto administrativo, procedimientos, contratos y responsabilidad patrimonial",
      color: "bg-purple-100 text-purple-800"
    },
    {
      titulo: "Bloque IV: Gestión de Personal", 
      temas: "9 temas",
      descripcion: "Personal funcionario y laboral, selección, carrera administrativa, retribuciones y seguridad social",
      color: "bg-orange-100 text-orange-800"
    },
    {
      titulo: "Bloque V: Gestión Financiera",
      temas: "6 temas", 
      descripcion: "Presupuestos, ejecución presupuestaria, retribuciones y gestión económica de contratos",
      color: "bg-red-100 text-red-800"
    },
    {
      titulo: "Bloque VI: Ofimática e Informática",
      temas: "8 temas",
      descripcion: "Informática básica, Windows, Word, Excel, Access, correo electrónico e Internet",
      color: "bg-indigo-100 text-indigo-800"
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Administrativo del Estado 2025",
    "description": "Curso completo para preparar las oposiciones de Administrativo del Estado con temario actualizado, tests y simulacros.",
    "provider": {
      "@type": "Organization", 
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "ADM-ESTADO-2025",
    "educationalLevel": "Bachillerato",
    "teaches": "45 temas oficiales del programa de Administrativo del Estado"
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
              🏛️ ADMINISTRACIÓN GENERAL DEL ESTADO
            </span>
            
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Administrativo del Estado 2025
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
              Información completa sobre las oposiciones de <strong>Administrativo del Estado</strong>: 
              programa oficial, estructura del examen, requisitos y detalles de la convocatoria 2025.
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

          {/* Información de la OEP 2025 */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Oferta Empleo Público 2025 - ¡Ya Aprobada!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">1.200</div>
                <div className="text-green-100 text-sm">Plazas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">+15%</div>
                <div className="text-green-100 text-sm">vs 2024</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">Oct</div>
                <div className="text-green-100 text-sm">Convocatoria*</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">150</div>
                <div className="text-green-100 text-sm">Preguntas</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
              <h3 className="font-bold mb-2">✨ Nivel superior: Mayor responsabilidad y sueldo</h3>
              <p className="text-green-100 text-sm">
                Como Administrativo tendrás funciones de mayor responsabilidad que el Auxiliar, con mejor retribución y más posibilidades de promoción.
              </p>
            </div>
            <p className="text-green-100 text-sm">
              <strong>¡Momento ideal para prepararte!</strong> La convocatoria específica se publicará aproximadamente en octubre de 2025.
            </p>
          </div>

          {/* Bloques Temáticos */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Programa Oficial: 45 Temas en 6 Bloques</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bloquesTematicos.map((bloque, index) => (
                <div key={index} className="bg-white rounded-xl shadow-lg p-6">
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-3 ${bloque.color}`}>
                    {bloque.temas}
                  </div>
                  <h3 className="text-lg font-bold mb-3">{bloque.titulo}</h3>
                  <p className="text-gray-600 text-sm">{bloque.descripcion}</p>
                </div>
              ))}
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