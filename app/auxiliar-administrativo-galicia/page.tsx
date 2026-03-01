// app/auxiliar-administrativo-galicia/page.tsx
import Link from 'next/link'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import ConvocatoriaLinks from '@/components/ConvocatoriaLinks'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Auxiliar Administrativo Xunta de Galicia 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Xunta de Galicia: 83 plazas, temario oficial 17 temas, 2 partes. DOG 25/11/2025.',
  keywords: [
    'auxiliar administrativo galicia',
    'oposiciones auxiliar administrativo galicia',
    'temario auxiliar galicia',
    'oposiciones xunta de galicia',
    'auxiliar administrativo xunta de galicia',
    '17 temas auxiliar galicia',
    'cuerpo auxiliar galicia',
    'plazas auxiliar administrativo galicia'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Xunta de Galicia | 83 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Xunta de Galicia: temario oficial 17 temas en 2 partes.',
    url: `${SITE_URL}/auxiliar-administrativo-galicia`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Xunta de Galicia',
    description: '83 plazas. Temario 17 temas. Xunta de Galicia.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-galicia`,
  },
}

export default function AuxiliarAdministrativoGalicia() {
  const estadisticas = [
    { numero: "83", texto: "Plazas convocadas", color: "text-sky-600" },
    { numero: "17", texto: "Temas oficiales", color: "text-green-600" },
    { numero: "3", texto: "Ejercicios", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-sky-600" }
  ]

  const infoTemario = [
    {
      icon: "\ud83d\udcda",
      titulo: "Programa Oficial",
      descripcion: "El temario consta de 17 temas distribuidos en 2 partes: Parte General (13 temas) y Parte Especifica (4 temas sobre informatica y ofimatica).",
      stats: "17 temas \u2022 2 partes"
    },
    {
      icon: "\ud83d\udccb",
      titulo: "Estructura del Examen",
      descripcion: "3 ejercicios eliminatorios: 1o) 100 preguntas test + 6 reserva, 120 min (Parte General); 2o) 40 preguntas test + 5 reserva, 80 min (Parte Especifica - LibreOffice); 3o) Traduccion gallego (Apto/No apto). Penalizacion de 1/4 por incorrecta.",
      stats: "140 preguntas + traduccion gallego"
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
      pregunta: "\u00bfCuantas plazas hay para Auxiliar Administrativo de la Xunta de Galicia?",
      respuesta: "Se convocan 83 plazas para el Cuerpo Auxiliar de la Administracion de la Xunta de Galicia. OEP 2022 (50 plazas) + OEP 2024 (33 plazas), publicadas en DOG 25/11/2025."
    },
    {
      pregunta: "\u00bfCual es el programa oficial de Auxiliar Administrativo Galicia?",
      respuesta: "El programa consta de 17 temas en 2 partes: Parte General (13 temas) sobre Constitucion, Estatuto de Autonomia de Galicia, UE, PRL, Administracion gallega, LPAC, LRJSP, regimen financiero, transparencia, empleo publico, igualdad y discapacidad; y Parte Especifica (4 temas) sobre gestion documental, informatica basica, sistemas operativos y ofimatica (Writer, Calc, Impress)."
    },
    {
      pregunta: "\u00bfComo es el examen de Auxiliar Administrativo Galicia?",
      respuesta: "El examen consta de 3 ejercicios eliminatorios: 1o) 100 preguntas tipo test + 6 de reserva sobre la Parte General (120 min); 2o) 40 preguntas tipo test + 5 de reserva sobre la Parte Especifica (80 min); 3o) Traduccion de gallego a castellano (Apto/No apto). Penalizacion de 1/4 por respuesta incorrecta. Fecha prevista del 1er ejercicio: 20 de septiembre de 2026."
    },
    {
      pregunta: "\u00bfQue requisitos necesito para opositar?",
      respuesta: "Nacionalidad espanola o europea, tener 16 anos cumplidos, titulo de Graduado en ESO o equivalente (Grupo C2), y no estar inhabilitado para funciones publicas."
    }
  ]

  const bloquesTematicos = [
    {
      titulo: "Parte General",
      temas: "13 temas (1-13)",
      color: "border-sky-500",
      temasLista: [
        "1. CE: T.Preliminar, T.I (excepto cap 3), T.II, T.III (cap 1), T.IV, T.V, T.VIII",
        "2. Estatuto de Autonomia de Galicia (LO 1/1981)",
        "3. Derecho derivado UE: reglamentos, directivas, decisiones",
        "4. Instituciones UE: Parlamento, Consejo Europeo, Consejo, Comision",
        "5. Ley 31/1995 PRL: capitulo III",
        "6. Ley 16/2010 organizacion Administracion Galicia",
        "7. Ley 39/2015 LPAC: titulos Preliminar, I, II, III, IV y V",
        "8. Ley 40/2015 LRJSP: caps I-V titulo preliminar",
        "9. DL 1/1999 regimen financiero Galicia",
        "10. Ley 1/2016 transparencia Galicia",
        "11. Ley 2/2015 empleo publico Galicia",
        "12. Ley 7/2023 igualdad Galicia",
        "13. RDL 1/2013 discapacidad"
      ]
    },
    {
      titulo: "Parte Especifica",
      temas: "4 temas (14-17)",
      color: "border-blue-500",
      temasLista: [
        "14. Gestion de documentos en la Xunta de Galicia",
        "15. Informatica basica: componentes, redes, almacenamiento",
        "16. Sistemas operativos: administrador de archivos",
        "17. Sistemas ofimaticos: Writer, Calc, Impress, correo electronico"
      ]
    }
  ]

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "Oposiciones Auxiliar Administrativo Xunta de Galicia",
    "description": "Preparacion para las oposiciones de Auxiliar Administrativo de la Xunta de Galicia con temario oficial, tests y simulacros. 83 plazas convocadas.",
    "provider": {
      "@type": "Organization",
      "name": "Vence",
      "url": SITE_URL
    },
    "courseCode": "AUX-ADMIN-GALICIA",
    "educationalLevel": "Graduado en ESO",
    "teaches": "17 temas oficiales del programa de Auxiliar Administrativo de la Xunta de Galicia"
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
            <span className="bg-sky-100 text-sky-800 px-3 py-1 rounded-full text-sm font-medium">
              {'\ud83d\udc1a'} XUNTA DE GALICIA - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Xunta de Galicia
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposicion para la Xunta de Galicia con <strong>83 plazas convocadas</strong>.
              OEP 2022 + 2024, DOG 25/11/2025.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-galicia/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">{'\ud83c\udfaf'}</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-galicia/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-sky-300 transition-all"
              >
                <span className="text-xl">{'\ud83d\udcda'}</span>
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
              <ConvocatoriaLinks oposicionSlug="auxiliar-administrativo-galicia" />
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">{'\ud83d\udccb'} Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">17 temas en 2 partes</p>
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
                href="/auxiliar-administrativo-galicia/temario"
                className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>{'\ud83d\udcda'}</span>
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
