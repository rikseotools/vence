// app/auxiliar-administrativo-madrid/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria, type HitoConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400 // ISR 24h

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Comunidad de Madrid 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Comunidad de Madrid 2026: 551 plazas, temario oficial 21 temas, examen 12 abril 2026. Tests gratuitos y temario actualizado.',
  keywords: [
    'auxiliar administrativo madrid',
    'oposiciones auxiliar administrativo madrid',
    'temario auxiliar madrid',
    'oposiciones comunidad de madrid 2026',
    'auxiliar administrativo comunidad de madrid',
    '21 temas auxiliar madrid',
    'requisitos auxiliar madrid',
    'plazas auxiliar administrativo madrid',
    'examen auxiliar madrid abril 2026'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Comunidad de Madrid 2026 | 551 Plazas',
    description: 'Oposiciones Auxiliar Administrativo Comunidad de Madrid: temario oficial 21 temas. Examen 12 abril 2026.',
    url: `${SITE_URL}/auxiliar-administrativo-madrid`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxiliar Administrativo Comunidad de Madrid 2026',
    description: '551 plazas. Temario 21 temas. Examen 12 abril 2026.'
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-madrid`,
  },
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

export default async function AuxiliarAdministrativoMadrid() {
  const data = await getOposicionLandingData('auxiliar-administrativo-madrid')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-madrid')

  const plazasLibres = data?.plazasLibres ?? 551
  const plazasPromocion = data?.plazasPromocionInterna ?? 60
  const temasCount = data?.temasCount ?? 21
  const boeRef = data?.boeReference ?? 'BOCM num. 113, 13/05/2025'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '13 de mayo de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '13/05/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'

  const inscripcionCerrada = data?.inscriptionDeadline
    ? new Date(data.inscriptionDeadline) < new Date()
    : true
  const inscripcionInicio = data?.inscriptionStart ? formatDateLarga(data.inscriptionStart) : null
  const inscripcionFin = data?.inscriptionDeadline ? formatDateLarga(data.inscriptionDeadline) : null

  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null

  const textoExamen = examDate
    ? `Examen previsto para el ${examDate}`
    : 'Examen previsto para 2026'

  const textoInscripcion = inscripcionCerrada
    ? 'Plazo de inscripción cerrado.'
    : `Plazo de inscripción: del ${inscripcionInicio} al ${inscripcionFin}.`

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas libres", color: "text-red-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Titulo requerido", color: "text-orange-600" }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de la Comunidad de Madrid 2026?",
      respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre${plazasPromocion ? ` y ${formatNumber(plazasPromocion)} de promoción interna` : ''} para Auxiliar Administrativo de la Comunidad de Madrid.`
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo Madrid?",
      respuesta: `El programa consta de ${temasCount} temas en 2 bloques: Bloque I (15 temas) sobre Organización Política y Bloque II (6 temas) sobre Ofimática (Windows, Word, Excel, Access, Outlook, Microsoft 365).`
    },
    {
      pregunta: "¿Cuándo es el examen de Auxiliar Administrativo de la Comunidad de Madrid?",
      respuesta: examDate
        ? `El examen está previsto para el ${examDate}.${inscripcionCerrada && inscripcionInicio ? ` El plazo de inscripción fue del ${inscripcionInicio} al ${inscripcionFin}.` : ''}`
        : 'Pendiente de confirmación.'
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar?",
      respuesta: `Nacionalidad española o europea, tener 16 años cumplidos, título de ${tituloRequerido} (Grupo C2), y no estar inhabilitado para funciones públicas.`
    }
  ]

  // Schema JSON-LD: FAQ + Event
  const schemaFAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.pregunta,
      "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta }
    }))
  }

  const examHito = hitos.find(h => h.titulo.toLowerCase().includes('examen') && h.status !== 'completed')
  const schemaEvent = examHito ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Examen Auxiliar Administrativo Comunidad de Madrid 2026",
    "description": examHito.descripcion ?? "Examen de oposición para Auxiliar Administrativo de la Comunidad de Madrid",
    "startDate": examHito.fecha,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": { "@type": "Organization", "name": "Comunidad de Madrid" },
    "location": { "@type": "Place", "name": "Madrid" }
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }}
      />
      {schemaEvent && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaEvent) }}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ COMUNIDAD DE MADRID - GRUPO C2
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo Comunidad de Madrid 2026
            </h1>

            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Comunidad de Madrid con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>.
              {examDate ? ` ${textoExamen}.` : ''}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/auxiliar-administrativo-madrid/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                <span className="text-2xl">🎯</span>
                <span>Empezar a Practicar</span>
              </Link>
              <Link
                href="/auxiliar-administrativo-madrid/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-red-300 transition-all"
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

          {/* Convocatoria */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                <div className="text-red-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasPromocion)}</div>
                <div className="text-red-100 text-sm">Promoción int.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{temasCount}</div>
                <div className="text-red-100 text-sm">Temas</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-red-100 text-sm">
                <strong>{textoInscripcion}</strong> {textoExamen}.
              </p>
            </div>
            {oepDecreto && (
              <p className="text-sm mt-2 opacity-80">
                OEP: {oepDecreto}{oepFecha ? ` (${oepFecha})` : ''}
              </p>
            )}
          </div>

          {/* Enlaces oficiales */}
          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (
                <a href={programaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-red-300 transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-red-200 transition-colors">📄</div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-red-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOCM'}</div>
                    <div className="text-sm text-gray-500">{boeRef} - {boeFechaCorta}</div>
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

          {/* Timeline de hitos */}
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
                            {hito.status === 'current' && (
                              <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>
                            )}
                          </div>
                          <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>
                            {hito.url ? (
                              <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline transition-colors">{hito.titulo}</a>
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
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-red-500">
                <p className="text-xs text-gray-500 mb-1">15 temas (1-15)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque I: Organización Política</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>1. La Constitución Española de 1978</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>2. El Estatuto de Autonomía de la Comunidad de Madrid</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>3. La Ley de Gobierno y Administración de la Comunidad de Madrid</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>4. Las fuentes del ordenamiento jurídico</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>5. El acto administrativo</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>6. La Ley del Procedimiento Administrativo Común de las Administraciones Públicas</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>7. La Jurisdicción Contencioso-Administrativa</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>8. Transparencia y Protección de Datos</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>9. Los contratos en el Sector Público</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>10. El Texto Refundido de la Ley del Estatuto Básico del Empleado Público</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>11. La Seguridad Social</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>12. Hacienda Pública y Presupuestos de la Comunidad de Madrid</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>13. Igualdad de género y no discriminación</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>14. Información administrativa y Administración electrónica</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>15. Los documentos administrativos</span></li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">6 temas (16-21)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque II: Ofimática</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>16. El explorador de Windows</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>17. Procesadores de texto: Word</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>18. Hojas de cálculo: Excel</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>19. Bases de datos: Access y Power BI</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>20. Correo electrónico: Outlook</span></li>
                  <li className="flex items-start"><span className="mr-1">&bull;</span><span>21. Trabajo colaborativo: Microsoft 365</span></li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-madrid/temario"
                className="inline-flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
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
          <section className="bg-red-600 rounded-lg shadow-lg p-6 text-white text-center">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-red-100 mb-6 max-w-xl mx-auto">
              Prepárate con tests tipo examen y temario oficial actualizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-madrid/test"
                className="bg-white text-red-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">
                🎯 Empezar Tests
              </Link>
              <Link href="/auxiliar-administrativo-madrid/temario"
                className="bg-yellow-500 text-red-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">
                📚 Ver Temario
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
