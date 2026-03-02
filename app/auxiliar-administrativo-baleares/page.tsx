// app/auxiliar-administrativo-baleares/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Illes Balears 2025 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo CAIB: 128 plazas, temario oficial 36 temas, 2 bloques. BOIB 11/02/2025. Requisito catalan B2.',
  keywords: [
    'auxiliar administrativo baleares',
    'oposiciones auxiliar administrativo baleares',
    'temario auxiliar baleares',
    'oposiciones caib',
    'auxiliar administrativo illes balears',
    '36 temas auxiliar baleares',
    'cuerpo auxiliar baleares',
    'plazas auxiliar administrativo baleares'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Illes Balears | 128 Plazas',
    description: 'Oposiciones Auxiliar Administrativo CAIB: temario oficial 36 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-baleares`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Illes Balears',
    description: '128 plazas. Temario 36 temas. CAIB.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-baleares`,
  },
}

export default function AuxiliarAdministrativoBaleares() {
  const estadisticas = [
    { numero: "128", texto: "Plazas convocadas", color: "text-cyan-600" },
    { numero: "36", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "B2", texto: "Catalan requerido", color: "text-cyan-600" }
  ]

  const infoTemario = [
    {
      icon: "📚",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 36 temas distribuidos en 2 bloques: Materias Comunes (20 temas) sobre Constitucion, Estatuto de Autonomia, procedimiento administrativo, empleo publico, transparencia y administracion digital; y Ofimatica (16 temas) sobre Word y Excel avanzado.",
      stats: "36 temas \u2022 2 bloques"
    },
    {
      icon: "📋",
      titulo: "Estructura del Examen",
      descripcion: "Primer ejercicio: 86 preguntas tipo test (80 evaluables + 6 de reserva) en 110 minutos, penalizacion 1/3. Segundo ejercicio: caso practico informatico con Word y Excel en 100 minutos.",
      stats: "86 preguntas test \u2022 110 min + practico 100 min"
    },
    {
      icon: "🎓",
      titulo: "Requisitos de Acceso",
      descripcion: "Titulo de Graduado en ESO o equivalente, nacionalidad espanola o europea. Grupo C2. Requisito de catalan nivel B2 (certificado oficial).",
      stats: "ESO/equivalente \u2022 Catalan B2"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuantas plazas hay para Auxiliar Administrativo de la CAIB?",
      respuesta: "Se convocan 128 plazas para Auxiliar Administrativo de la Comunitat Autonoma de les Illes Balears (BOIB 11/02/2025). El proceso selectivo esta en curso, con examen previsto para marzo-abril 2026."
    },
    {
      pregunta: "¿Cual es el programa oficial de Auxiliar Administrativo Baleares?",
      respuesta: "El programa consta de 36 temas en 2 bloques: Materias Comunes (20 temas) sobre Constitucion, Estatuto de Autonomia de las Illes Balears, regimen juridico, procedimiento administrativo, empleo publico, presupuestos, transparencia e igualdad; y Ofimatica (16 temas) sobre Word y Excel avanzado."
    },
    {
      pregunta: "¿Como es el examen de Auxiliar Administrativo Baleares?",
      respuesta: "El examen consta de dos ejercicios: un test de 86 preguntas (80 evaluables y 6 de reserva) con 4 opciones en 110 minutos (penalizacion de 1/3 por respuesta incorrecta) y un caso practico informatico con Word y Excel de 100 minutos."
    },
    {
      pregunta: "¿Necesito saber catalan para presentarme?",
      respuesta: "Si, es requisito imprescindible acreditar el nivel B2 de catalan (certificat de nivell B2 de catala) mediante certificado oficial expedido por la EBAP, el Institut Ramon Llull o entidad equivalente reconocida."
    },
    {
      pregunta: "¿Que requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), certificado de catalan B2 y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Materias Comunes",
      temas: "20 temas (1-20)",
      color: "border-cyan-500",
      temasLista: [
        "1. CE y Estatuto de Autonomia de las Illes Balears",
        "2. Parlamento, Presidente y Gobierno de las Illes Balears",
        "3. Regimen Juridico del Sector Publico y organizacion administrativa",
        "4. Fuentes del derecho y jerarquia normativa",
        "5. Procedimiento Administrativo Comun (I): disposiciones generales",
        "6. Procedimiento Administrativo Comun (II): plazos, actos y recursos",
        "7. Procedimiento Administrativo Comun (III): procedimiento",
        "8. El Butlleti Oficial de les Illes Balears",
        "9. Archivos y gestion documental",
        "10. Relaciones electronicas y atencion a la ciudadania",
        "11. Oficinas de asistencia en materia de registros",
        "12. Contratacion administrativa",
        "13. Personal funcionario: adquisicion y procesos selectivos",
        "14. Derechos, deberes e incompatibilidades de los funcionarios",
        "15. Presupuestos generales de las Illes Balears",
        "16. Prevencion de riesgos laborales",
        "17. Transparencia y acceso a la informacion publica",
        "18. Funcionamiento electronico del sector publico",
        "19. Igualdad, no discriminacion y violencia de genero",
        "20. Herramientas de administracion digital de la CAIB"
      ]
    },
    {
      titulo: "Ofimatica",
      temas: "16 temas (21-36)",
      color: "border-blue-500",
      temasLista: [
        "21. Word: conceptos basicos de edicion de texto",
        "22. Word: formato de fuente y parrafo",
        "23. Word: estilos",
        "24. Word: formato de pagina, encabezados y pies",
        "25. Word: imagenes y tablas",
        "26. Word: tabla de contenidos y notas al pie",
        "27. Word: combinacion de correspondencia",
        "28. Word: correccion ortografica y comparacion",
        "29. Word: formularios con controles de contenido",
        "30. Excel: operaciones basicas y formato de celdas",
        "31. Excel: tablas, graficos y filtrado",
        "32. Excel: diseno de pagina e impresion",
        "33. Excel: formulas y funciones estadisticas",
        "34. Excel: ortografia y proteccion de documentos",
        "35. Excel: vistas y zoom",
        "36. Excel: tablas dinamicas y analisis de escenarios"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo CAIB (Illes Balears)",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la Comunitat Autonoma de les Illes Balears con temario oficial, tests y simulacros. 128 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-BAL",
    "educationalLevel": "Graduado en ESO",
    "teaches": "36 temas oficiales del programa de Auxiliar Administrativo de la CAIB"
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
            <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-sm font-medium">
              🏝️ ILLES BALEARS - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo de la CAIB
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Comunitat Autonoma de les Illes Balears con <strong>128 plazas convocadas</strong>.
              BOIB 11/02/2025. Proceso selectivo en curso, examen previsto marzo-abril 2026.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-baleares/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-baleares/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-cyan-300 transition-all"
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-baleares" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">36 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-baleares/temario"
                className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
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
