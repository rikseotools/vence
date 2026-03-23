// app/auxiliar-administrativo-canarias/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Gobierno de Canarias 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Gobierno de Canarias: 285 plazas, temario oficial 40 temas, 2 bloques. Tests gratuitos y temario actualizado.',
  keywords: [
    'auxiliar administrativo canarias', 'oposiciones auxiliar administrativo canarias',
    'temario auxiliar canarias', 'oposiciones gobierno de canarias',
    'auxiliar administrativo gobierno canarias', '40 temas auxiliar canarias',
    'cuerpo auxiliar canarias', 'plazas auxiliar administrativo canarias'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Gobierno de Canarias | 285 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Gobierno de Canarias: temario oficial 40 temas en 2 bloques.',
    url: `${SITE_URL}/auxiliar-administrativo-canarias`,
    siteName: 'Vence', locale: 'es_ES', type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Gobierno de Canarias',
    description: '285 plazas. Temario 40 temas. Gobierno de Canarias.'
  },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-canarias` },
}

function formatNumber(n: number | null): string {
  if (n == null) return '—'
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatDateLarga(dateStr: string | null): string {
  if (!dateStr) return ''
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} de ${meses[m - 1]} de ${y}`
}

function formatDateCorta(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default async function AuxiliarAdministrativoCanarias() {
  const data = await getOposicionLandingData('auxiliar-administrativo-canarias')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-canarias')

  const plazasLibres = data?.plazasLibres ?? 285
  const plazasPromocion = data?.plazasPromocionInterna ?? 16
  const plazasDiscapacidad = data?.plazasDiscapacidad ?? 14
  const temasCount = data?.temasCount ?? 40
  const boeRef = data?.boeReference ?? 'BOC 2024/239, 29/11/2024'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '29 de noviembre de 2024'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '29/11/2024'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO'

  const examYaPasado = data?.examDate ? new Date(data.examDate) < new Date() : false

  const textoExamen = examDate
    ? (examYaPasado ? `Examen realizado el ${examDate}` : `Examen previsto para el ${examDate}`)
    : 'Fecha de examen pendiente'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas acceso libre", color: "text-amber-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo del Gobierno de Canarias?",
      respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre (${formatNumber(plazasDiscapacidad)} reservadas para discapacidad) y ${formatNumber(plazasPromocion)} de promoción interna.`
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo Canarias?",
      respuesta: `El programa consta de ${temasCount} temas en 2 bloques: Parte General (20 temas) sobre Constitución, Autonomía, UE, Igualdad y Función Pública, y Parte Práctica (20 temas) sobre Administración, Procedimiento, Contratos y Ofimática.`
    },
    {
      pregunta: "¿Cómo es el examen de Auxiliar Administrativo de Canarias?",
      respuesta: "El examen consta de un ejercicio único con dos partes: 50 preguntas tipo test de la parte general y 25 preguntas de supuesto práctico. Las respuestas incorrectas penalizan."
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: `Nacionalidad española o europea, tener 16 años cumplidos, título de ${tituloRequerido} o equivalente (Grupo C2), y no estar inhabilitado para funciones públicas.`
    }
  ]

  const schemaFAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.pregunta,
      "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta }
    }))
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero */}
          <div className="text-center mb-8">
            <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
              🏝️ GOBIERNO DE CANARIAS - GRUPO C2
            </span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo Gobierno de Canarias</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
                {textoExamen}
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para el Gobierno de Canarias con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-canarias/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                <span className="text-2xl">🎯</span><span>Empezar a Practicar</span>
              </Link>
              <Link href="/auxiliar-administrativo-canarias/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-amber-300 transition-all">
                <span className="text-xl">📚</span><span>Ver Temario</span>
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

          {/* Convocatoria */}
          <div className="bg-gradient-to-r from-amber-600 to-amber-700 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                <div className="text-amber-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasPromocion)}</div>
                <div className="text-amber-100 text-sm">Promoción int.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{temasCount}</div>
                <div className="text-amber-100 text-sm">Temas</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-amber-100 text-sm">{textoExamen}.</p>
            </div>
          </div>

          {/* Enlaces oficiales */}
          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (
                <a href={programaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-amber-300 transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-amber-200 transition-colors">📄</div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-amber-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOC'}</div>
                    <div className="text-sm text-gray-500">{boeFechaCorta}</div>
                  </div>
                </a>
              )}
              {seguimientoUrl && (
                <a href={seguimientoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">🔍</div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Seguimiento del proceso selectivo</div>
                    <div className="text-sm text-gray-500">Estado actual, listas y documentos oficiales</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Timeline */}
          {hitos.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">📅 Estado del Proceso Selectivo</h2>
              <div className="max-w-3xl mx-auto">
                <div className="relative">
                  <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {hitos.map((hito) => (
                      <div key={hito.id} className="relative flex items-start gap-4 md:gap-6">
                        <div className={`relative z-10 flex-shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base ${
                          hito.status === 'completed' ? 'bg-green-100 text-green-600 border-2 border-green-500'
                            : hito.status === 'current' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse'
                              : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                        }`}>
                          {hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}
                        </div>
                        <div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              hito.status === 'completed' ? 'bg-green-100 text-green-700'
                                : hito.status === 'current' ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>{formatDateCorta(hito.fecha)}</span>
                            {hito.status === 'current' && <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>}
                          </div>
                          <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>
                            {hito.url ? (
                              <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 hover:underline transition-colors">{hito.titulo}</a>
                            ) : hito.titulo}
                          </h3>
                          {hito.descripcion && <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Temario Oficial */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 2 bloques</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-amber-500">
                <p className="text-xs text-gray-500 mb-1">20 temas (1-20)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Parte General</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li>
                  <li>2. La organización territorial del Estado</li>
                  <li>3. El Estatuto de Autonomía de Canarias (I)</li>
                  <li>4. El Estatuto de Autonomía de Canarias (II)</li>
                  <li>5. Las Instituciones Autonómicas de Canarias</li>
                  <li>6. El Gobierno de Canarias</li>
                  <li>7. Las islas y la Comunidad Autónoma de Canarias</li>
                  <li>8. El Presupuesto de la Comunidad Autónoma de Canarias</li>
                  <li>9. La organización de la Unión Europea</li>
                  <li>10. Igualdad efectiva de mujeres y hombres</li>
                  <li>11. Violencia de género y discapacidad</li>
                  <li>12. Actividad de las Administraciones Públicas</li>
                  <li>13. Atención al ciudadano</li>
                  <li>14. La transparencia de la actividad pública</li>
                  <li>15. Protección de datos de carácter personal</li>
                  <li>16. La competencia administrativa</li>
                  <li>17. El personal al servicio de las Administraciones Públicas</li>
                  <li>18. La selección del personal funcionario y laboral</li>
                  <li>19. Las situaciones administrativas</li>
                  <li>20. Derechos y deberes de los empleados públicos</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">20 temas (21-40)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Parte Práctica</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>21. La organización general de la Administración Pública de Canarias</li>
                  <li>22. El acceso electrónico de los ciudadanos a los servicios públicos</li>
                  <li>23. El acto administrativo</li>
                  <li>24. Validez e invalidez de los actos</li>
                  <li>25. Eficacia, notificación y publicación</li>
                  <li>26. La revisión de oficio</li>
                  <li>27. El procedimiento administrativo</li>
                  <li>28. Fases del procedimiento administrativo</li>
                  <li>29. Los recursos administrativos</li>
                  <li>30. Los recursos ordinarios</li>
                  <li>31. Contratación pública (I)</li>
                  <li>32. Contratación pública (II)</li>
                  <li>33. Contratación pública (III)</li>
                  <li>34. Régimen general de ayudas y subvenciones</li>
                  <li>35. Funcionamiento electrónico del sector público</li>
                  <li>36. Los documentos administrativos</li>
                  <li>37. El sistema operativo Windows</li>
                  <li>38. El explorador de Windows</li>
                  <li>39. Los documentos administrativos (práctico)</li>
                  <li>40. Regulación del archivo de la Administración Pública de Canarias</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-canarias/temario"
                className="inline-flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
                <span>📚</span><span>Ver Temario Completo</span>
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

          {/* CTA Final */}
          <section className="bg-amber-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-amber-100 mb-6 max-w-xl mx-auto">
              Prepárate con tests tipo examen y temario oficial actualizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-canarias/test"
                className="bg-white text-amber-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">
                🎯 Empezar Tests
              </Link>
              <Link href="/auxiliar-administrativo-canarias/temario"
                className="bg-yellow-500 text-amber-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">
                📚 Ver Temario
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
