// app/auxilio-judicial/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxilio Judicial 2026 | Temario Oficial BOE y Convocatoria',
  description: 'Oposiciones Auxilio Judicial 2026: 382 plazas, temario oficial 26 temas BOE 30/12/2025. Administración de Justicia. Tests gratuitos y temario actualizado.',
  keywords: [
    'auxilio judicial', 'oposiciones auxilio judicial', 'temario auxilio judicial',
    'administracion de justicia', 'oposiciones 2026', 'convocatoria auxilio judicial 2026',
    '26 temas auxilio', 'requisitos auxilio judicial', 'plazas auxilio judicial 2026'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxilio Judicial 2026 | Convocatoria Publicada - 382 Plazas',
    description: 'Oposiciones Auxilio Judicial: temario oficial 26 temas BOE 30/12/2025. Administración de Justicia.',
    url: `${SITE_URL}/auxilio-judicial`,
    siteName: 'Vence', locale: 'es_ES', type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Auxilio Judicial 2026 | Convocatoria Publicada',
    description: '382 plazas. Temario 26 temas BOE 30/12/2025. Administración de Justicia.'
  },
  alternates: { canonical: `${SITE_URL}/auxilio-judicial` },
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

export default async function AuxilioJudicial() {
  const data = await getOposicionLandingData('auxilio-judicial')
  const hitos = await getHitosConvocatoria('auxilio-judicial')

  const plazasLibres = data?.plazasLibres ?? 382
  const plazasDiscapacidad = data?.plazasDiscapacidad ?? 43
  const temasCount = data?.temasCount ?? 26
  const boeRef = data?.boeReference ?? 'BOE-A-2025-27053'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '30 de diciembre de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '30/12/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'

  const textoExamen = examDate
    ? `Examen previsto para el ${examDate}`
    : 'Fecha de examen pendiente de confirmación'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas acceso libre", color: "text-blue-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 3), texto: "Bloques", color: "text-purple-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const faqs = [
    {
      pregunta: "¿Cuántas plazas hay para Auxilio Judicial 2026?",
      respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre (${formatNumber(plazasDiscapacidad)} reservadas para discapacidad).`
    },
    {
      pregunta: "¿Cuál es el programa oficial de Auxilio Judicial?",
      respuesta: `El programa según BOE ${boeFechaCorta} consta de ${temasCount} temas en 3 bloques: Derecho Constitucional (5 temas), Organización Judicial y Funcionarios (10 temas) y Procedimientos y Actos Procesales (11 temas).`
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar a Auxilio Judicial?",
      respuesta: `Nacionalidad española o europea, tener 16 años cumplidos, título de ${tituloRequerido}, y no estar inhabilitado para funciones públicas.`
    },
    {
      pregunta: "¿Qué diferencia hay entre Auxilio Judicial y Tramitación Procesal?",
      respuesta: "Auxilio Judicial es grupo C2 (requiere ESO) con funciones de apoyo, notificaciones y actos de comunicación. Tramitación Procesal es grupo C1 (requiere Bachillerato) con funciones de tramitación de procedimientos."
    },
    {
      pregunta: "¿Cuál es el sueldo de un funcionario de Auxilio Judicial?",
      respuesta: "El sueldo del Grupo C2 en la Administración de Justicia se sitúa entre 1.400-1.800€ brutos mensuales, pudiendo alcanzar 20.000-24.000€ anuales con complementos y trienios."
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

  const examHito = hitos.find(h => h.titulo.toLowerCase().includes('examen') && h.status !== 'completed')
  const schemaEvent = examHito ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Examen Auxilio Judicial 2026",
    "description": examHito.descripcion ?? "Examen de oposición para Auxilio Judicial",
    "startDate": examHito.fecha,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": { "@type": "Organization", "name": "Ministerio de Justicia" },
    "location": { "@type": "Place", "name": "Sedes de examen en toda España" }
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      {schemaEvent && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaEvent) }} />}

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero */}
          <div className="text-center mb-8">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              ⚖️ ADMINISTRACIÓN DE JUSTICIA - GRUPO C2
            </span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxilio Judicial 2026</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                Convocatoria oficial publicada - {textoExamen}
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición para la Administración de Justicia con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong> ({formatNumber(plazasDiscapacidad)} discapacidad).
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxilio-judicial/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                <span className="text-2xl">🎯</span><span>Empezar a Practicar</span>
              </Link>
              <Link href="/auxilio-judicial/temario"
                className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-blue-300 transition-all">
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
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026 - ¡Publicada en BOE!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                <div className="text-blue-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasDiscapacidad)}</div>
                <div className="text-blue-100 text-sm">Discapacidad</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{temasCount}</div>
                <div className="text-blue-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">C2</div>
                <div className="text-blue-100 text-sm">Grupo</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-blue-100 text-sm">{textoExamen}.</p>
            </div>
          </div>

          {/* Enlaces oficiales */}
          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (
                <a href={programaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">📄</div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOE'}</div>
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

          {/* Temario Oficial - 3 bloques */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOE {boeFechaCorta}</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 3 bloques</p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">5 temas (1-5)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Derecho Constitucional y Organización del Estado</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li>
                  <li>2. Igualdad y no discriminación</li>
                  <li>3. El Gobierno y la Administración</li>
                  <li>4. Organización territorial del Estado</li>
                  <li>5. La Unión Europea</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 mb-1">10 temas (6-15)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Organización Judicial y Funcionarios</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>6. El Poder Judicial</li>
                  <li>7. Órganos jurisdiccionales superiores</li>
                  <li>8. Órganos jurisdiccionales de instancia</li>
                  <li>9. Derechos de los ciudadanos ante la Justicia</li>
                  <li>10. Modernización de la oficina judicial</li>
                  <li>11. El Letrado de la Administración de Justicia</li>
                  <li>12. Los Cuerpos de Funcionarios</li>
                  <li>13. Ingreso y carrera de los funcionarios</li>
                  <li>14. Situaciones administrativas y régimen disciplinario</li>
                  <li>15. Libertad sindical y prevención de riesgos</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 mb-1">11 temas (16-26)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Procedimientos y Actos Procesales</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>16. Procedimientos civiles declarativos</li>
                  <li>17. Procedimientos civiles de ejecución</li>
                  <li>18. Procedimientos penales</li>
                  <li>19. Procedimientos contencioso-administrativos</li>
                  <li>20. El proceso laboral</li>
                  <li>21. Los actos procesales</li>
                  <li>22. Resoluciones de órganos judiciales</li>
                  <li>23. Comunicación con tribunales y autoridades</li>
                  <li>24. Comunicación con las partes</li>
                  <li>25. El Registro Civil</li>
                  <li>26. El archivo judicial</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxilio-judicial/temario"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
                <span>📚</span><span>Ver Temario Completo con Epígrafes</span>
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
          <section className="bg-blue-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto">
              Prepárate con tests tipo examen y temario oficial actualizado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxilio-judicial/test"
                className="bg-white text-blue-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">
                🎯 Empezar Tests
              </Link>
              <Link href="/auxilio-judicial/temario"
                className="bg-yellow-500 text-blue-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">
                📚 Ver Temario
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
