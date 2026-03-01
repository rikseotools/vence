// app/auxiliar-administrativo-valencia/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Generalitat Valenciana 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Generalitat Valenciana: 245 plazas, temario oficial 24 temas, 2 bloques. DOGV 09/02/2026.',
  keywords: [
    'auxiliar administrativo valencia',
    'oposiciones auxiliar administrativo valencia',
    'temario auxiliar valencia',
    'oposiciones generalitat valenciana',
    'auxiliar administrativo generalitat valenciana',
    '24 temas auxiliar valencia',
    'cuerpo auxiliar valencia',
    'plazas auxiliar administrativo valencia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Generalitat Valenciana | 245 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Generalitat Valenciana: temario oficial 24 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-valencia`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Generalitat Valenciana',
    description: '245 plazas. Temario 24 temas. Generalitat Valenciana.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-valencia`,
  },
}

export default function AuxiliarAdministrativoValencia() {
  const estadisticas = [
    { numero: "245", texto: "Plazas convocadas", color: "text-red-600" },
    { numero: "24", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "2", texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-red-600" }
  ]

  const infoTemario = [
    {
      icon: "\ud83d\udcda",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 24 temas distribuidos en 2 bloques: Materias Comunes (10 temas) y Materias Especificas (14 temas).",
      stats: "24 temas \u2022 2 bloques"
    },
    {
      icon: "\ud83d\udccb",
      titulo: "Estructura del Examen",
      descripcion: "75 preguntas tipo test (30 comunes + 45 especificas), aproximadamente 75 minutos. Penalizacion de 1/3 por respuesta incorrecta. Maximo 60 puntos, minimo aprobado 30 puntos.",
      stats: "75 preguntas \u2022 ~75 minutos"
    },
    {
      icon: "\ud83c\udf93",
      titulo: "Requisitos de Acceso",
      descripcion: "Titulo de Graduado en ESO o equivalente, nacionalidad espanola o europea. Grupo C2.",
      stats: "ESO/equivalente \u2022 +16 anos"
    }
  ]

  const faqs = [
    {
      pregunta: "\u00bfCuantas plazas hay para Auxiliar Administrativo de la Generalitat Valenciana?",
      respuesta: "Se convocan 245 plazas para el Cuerpo Auxiliar de la Administracion de la Generalitat Valenciana. OPE 2026, publicada en DOGV 09/02/2026."
    },
    {
      pregunta: "\u00bfCual es el programa oficial de Auxiliar Administrativo Valencia?",
      respuesta: "El programa consta de 24 temas en 2 bloques: Materias Comunes (10 temas) sobre Constitucion, Estatuto de Autonomia, Ley del Consell, Derecho de la UE e Igualdad; y Materias Especificas (14 temas) sobre Ley 39/2015, Organos AAPP, Contratos, Admin electronica, Funcion Publica Valenciana, Presupuestos y LibreOffice."
    },
    {
      pregunta: "\u00bfComo es el examen de Auxiliar Administrativo Valencia?",
      respuesta: "El examen consta de 75 preguntas tipo test: 30 de materias comunes y 45 de materias especificas. Duracion aproximada de 75 minutos. Penalizacion de 1/3 por respuesta incorrecta. Puntuacion maxima 60 puntos, minimo para aprobar 30 puntos."
    },
    {
      pregunta: "\u00bfQue requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Materias Comunes",
      temas: "10 temas (1-10)",
      color: "border-red-500",
      temasLista: [
        "1. CE: Titulo Preliminar, Titulo I, Titulo X",
        "2. CE: Titulo II Corona, Titulo III Cortes",
        "3. CE: Titulo IV Gobierno, Titulo V",
        "4. CE: Titulo VI Poder Judicial, Titulo IX TC",
        "5. CE: Titulo VIII Organizacion territorial",
        "6. Estatuto de Autonomia de la Comunitat Valenciana",
        "7. Ley 5/1983 del Consell (I)",
        "8. Ley 5/1983 del Consell (II)",
        "9. Derecho de la UE",
        "10. Igualdad: LO 3/2007, Ley 9/2003 GVA, LO 1/2004"
      ]
    },
    {
      titulo: "Materias Especificas",
      temas: "14 temas (11-24)",
      color: "border-blue-500",
      temasLista: [
        "11. Ley 39/2015 (I)",
        "12. Ley 39/2015 (II)",
        "13. Ley 39/2015 (III)",
        "14. Ley 39/2015 (IV)",
        "15. Ley 39/2015 (V)",
        "16. Organos AAPP",
        "17. Contratos del Sector Publico",
        "18. Admin electronica CV + Proteccion de datos",
        "19. Funcion Publica Valenciana (I)",
        "20. Funcion Publica Valenciana (II)",
        "21. Presupuestos",
        "22. Ejecucion presupuestaria",
        "23. Gestion presupuestaria GVA",
        "24. LibreOffice 6.1"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Generalitat Valenciana",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la Generalitat Valenciana con temario oficial, tests y simulacros. 245 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-GVA",
    "educationalLevel": "Graduado en ESO",
    "teaches": "24 temas oficiales del programa de Auxiliar Administrativo de la Generalitat Valenciana"
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
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              \ud83c\udf4a GENERALITAT VALENCIANA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Generalitat Valenciana
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Generalitat Valenciana con <strong>245 plazas convocadas</strong>.
              OPE 2026, DOGV 09/02/2026.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-valencia/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">\ud83c\udfaf</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-valencia/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-red-300 transition-all"
              >
                <span className="text-xl">\ud83d\udcda</span>
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-valencia" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">\ud83d\udccb Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">24 temas en 2 bloques</p>
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
                href="/auxiliar-administrativo-valencia/temario"
                className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>\ud83d\udcda</span>
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
