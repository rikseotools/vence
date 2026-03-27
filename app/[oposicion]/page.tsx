// app/[oposicion]/page.tsx - Landing page dinámica unificada
// Template único que genera todas las landings desde BD + config.
// Las landings estáticas (app/auxiliar-administrativo-*/page.tsx) tienen prioridad
// sobre esta ruta dinámica. Se migran una a una borrando el archivo estático.
import { getOposicion, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { formatNumber, formatDateLarga, formatDateCorta } from '@/lib/utils/format'
import { getColorScheme } from '@/lib/utils/landing-colors'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400 // ISR: regenerar cada 24h

export function generateStaticParams() {
  return ALL_OPOSICION_SLUGS.map(slug => ({ oposicion: slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}

  const data = await getOposicionLandingData(oposicion)
  const title = data?.seoTitle || `${config.name} 2026 | Tests y Temario`
  // Description se genera dinámicamente para que plazas/temas siempre estén actualizados
  const plazas = data?.plazasLibres
  const temas = data?.temasCount ?? config.totalTopics
  const description = plazas
    ? `Oposiciones ${config.name}: ${plazas} plazas, temario oficial ${temas} temas. Tests gratuitos.`
    : `Prepara ${config.name} con tests tipo examen y temario completo. ${temas} temas.`

  return {
    title,
    description,
    keywords: [config.name, 'oposiciones', 'test', 'temario', config.badge],
    authors: [{ name: 'Vence' }],
    metadataBase: new URL(SITE_URL),
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/${config.slug}`,
      siteName: 'Vence',
      locale: 'es_ES',
      type: 'website',
    },
    alternates: { canonical: `${SITE_URL}/${config.slug}` },
    robots: { index: true, follow: true },
  }
}

export default async function OposicionPage({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()

  const data = await getOposicionLandingData(oposicion)
  const hitos = await getHitosConvocatoria(oposicion)
  const colors = getColorScheme(data?.colorPrimario ?? null)

  // Datos de BD con fallbacks
  const plazasLibres = data?.plazasLibres ?? null
  const plazasPromocion = data?.plazasPromocionInterna ?? null
  const plazasDiscapacidad = data?.plazasDiscapacidad ?? null
  const temasCount = data?.temasCount ?? config.totalTopics
  const boeRef = data?.boeReference ?? data?.diarioReferencia ?? null
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : null
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : null
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'
  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null
  const diarioOficial = data?.diarioOficial ?? 'BOE'

  const textoExamen = examDate
    ? `Examen previsto para el ${examDate}`
    : 'Fecha de examen pendiente de confirmación'

  // Inscripción
  const inscripcionCerrada = data?.inscriptionDeadline
    ? new Date(data.inscriptionDeadline) < new Date()
    : true
  const inscripcionInicio = data?.inscriptionStart ? formatDateLarga(data.inscriptionStart) : null
  const inscripcionFin = data?.inscriptionDeadline ? formatDateLarga(data.inscriptionDeadline) : null

  // Texto de inscripción (usado en FAQs)
  const textoInscripcion = inscripcionCerrada && inscripcionInicio
    ? `El plazo de inscripción fue del ${inscripcionInicio} al ${inscripcionFin}.`
    : inscripcionInicio
      ? `Plazo de inscripción: del ${inscripcionInicio} al ${inscripcionFin}.`
      : ''

  // Resolver variables {plazasLibres}, {temasCount}, etc. en textos de BD
  const varsMap: Record<string, string> = {
    plazasLibres: plazasLibres ? formatNumber(plazasLibres) : '—',
    plazasPromocion: plazasPromocion ? formatNumber(plazasPromocion) : '—',
    plazasDiscapacidad: plazasDiscapacidad ? formatNumber(plazasDiscapacidad) : '—',
    temasCount: String(temasCount),
    bloquesCount: String(config.blocks.length),
    tituloRequerido,
    boeRef: boeRef || '',
    boeFechaLarga: boeFechaLarga || '',
    boeFechaCorta: boeFechaCorta || '',
    textoExamen,
    textoInscripcion,
    examDate: examDate || 'pendiente de confirmación',
    salarioMin: data?.salarioMin ? formatNumber(data.salarioMin) : '—',
    salarioMax: data?.salarioMax ? formatNumber(data.salarioMax) : '—',
  }
  function resolveVars(text: string): string {
    return text.replace(/\{(\w+)\}/g, (_, key) => {
      const val = varsMap[key]
      if (val === undefined) {
        console.warn(`⚠️ [Landing ${oposicion}] Variable no resuelta: {${key}}`)
      }
      return val ?? ''
    })
  }

  // Estadísticas hero (de BD con variables resueltas, o generadas)
  const rawStats = data?.landingEstadisticas as Array<{ numero: string; texto: string; color: string }> | null
  const estadisticas = rawStats
    ? rawStats.map(s => ({ ...s, numero: resolveVars(s.numero) }))
    : [
        { numero: plazasLibres ? formatNumber(plazasLibres) : '—', texto: 'Plazas', color: `text-blue-600` },
        { numero: String(temasCount), texto: 'Temas', color: 'text-green-600' },
        { numero: String(config.blocks.length), texto: 'Bloques', color: 'text-purple-600' },
        { numero: config.badge, texto: 'Grupo', color: 'text-orange-600' },
      ]

  // FAQs (de BD con variables resueltas, o genéricas)
  const rawFaqs = data?.landingFaqs as Array<{ pregunta: string; respuesta: string }> | null
  const faqs = rawFaqs
    ? rawFaqs.map(f => ({ pregunta: resolveVars(f.pregunta), respuesta: resolveVars(f.respuesta) }))
    :
    [
      {
        pregunta: `¿Cuántas plazas hay para ${config.name}?`,
        respuesta: plazasLibres
          ? `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre${plazasDiscapacidad ? ` (${formatNumber(plazasDiscapacidad)} reservadas para discapacidad)` : ''}.`
          : 'El número de plazas se determinará en la convocatoria.'
      },
      {
        pregunta: `¿Cuál es el temario oficial?`,
        respuesta: `El temario consta de ${temasCount} temas en ${config.blocks.length} bloques.`
      },
      {
        pregunta: `¿Qué requisitos necesito?`,
        respuesta: `Nacionalidad española o europea, título de ${tituloRequerido}, y no estar inhabilitado para funciones públicas.`
      },
    ]

  // Schema JSON-LD: FAQ
  const schemaFAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.pregunta,
      "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta }
    }))
  }

  // Schema JSON-LD: Evento del examen
  const examHito = hitos.find(h => h.titulo.toLowerCase().includes('examen') && h.status !== 'completed')
  const schemaEvent = examHito ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": `Examen ${config.name} 2026`,
    "description": examHito.descripcion ?? `Examen de oposición para ${config.name}`,
    "startDate": examHito.fecha,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
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
            <span className={`${colors.badge} ${colors.badgeText} px-3 py-1 rounded-full text-sm font-medium`}>
              {config.badge} - {boeFechaCorta ? `CONVOCATORIA PUBLICADA ${boeFechaCorta}` : 'PREPARACIÓN'}
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">{config.name}</h1>

            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className={`inline-block ${colors.subtitleBg} ${colors.subtitleText} px-3 py-1 rounded-full font-bold`}>
                {boeRef ? 'Convocatoria oficial publicada' : 'Preparación disponible'} - {textoExamen}
              </span>
            </p>

            {plazasLibres && (
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Oposición con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>.
                {plazasDiscapacidad ? ` ${formatNumber(plazasDiscapacidad)} reservadas para discapacidad.` : ''}
              </p>
            )}

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href={`/${config.slug}/test`} className={`inline-flex items-center justify-center space-x-2 ${colors.gradient} text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105`}>
                <span className="text-2xl">🎯</span><span>Empezar a Practicar</span>
              </Link>
              <Link href={`/${config.slug}/temario`} className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-gray-300 transition-all">
                <span className="text-xl">📚</span><span>Ver Temario</span>
              </Link>
            </div>

            {/* Estadísticas hero */}
            <div className={`grid grid-cols-2 md:grid-cols-${Math.min(estadisticas.length, 4)} gap-4 max-w-2xl mx-auto`}>
              {estadisticas.map((stat, i) => (
                <div key={i} className="bg-white rounded-lg p-4 shadow-md">
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div>
                  <div className="text-sm text-gray-600">{stat.texto}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Caja de Convocatoria */}
          {boeRef && (
            <div className={`${colors.gradient} rounded-lg shadow-lg p-6 text-white mb-10`}>
              <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {plazasLibres && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                    <div className="text-sm opacity-80">Plazas libres</div>
                  </div>
                )}
                {plazasPromocion && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatNumber(plazasPromocion)}</div>
                    <div className="text-sm opacity-80">Promoción int.</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-2xl font-bold">{temasCount}</div>
                  <div className="text-sm opacity-80">Temas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{config.blocks.length}</div>
                  <div className="text-sm opacity-80">Bloques</div>
                </div>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-4">
                <h3 className="font-bold mb-2">📋 {boeRef} {boeFechaLarga ? `(${boeFechaLarga})` : ''}</h3>
                <p className="text-sm opacity-80">
                  {inscripcionCerrada && inscripcionInicio
                    ? <><strong>Plazo de inscripción cerrado.</strong> {textoExamen}.</>
                    : inscripcionInicio
                      ? <><strong>Inscripción: del {inscripcionInicio} al {inscripcionFin}.</strong> {textoExamen}.</>
                      : <>{textoExamen}.</>
                  }
                </p>
              </div>
              {oepDecreto && (
                <p className="text-sm mt-2 opacity-80">
                  OEP: {oepDecreto}{oepFecha ? ` (${oepFecha})` : ''}
                </p>
              )}
            </div>
          )}

          {/* Enlaces oficiales */}
          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (
                <a href={programaUrl} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg ${colors.hoverBorder} transition-all group`}>
                  <div className={`flex-shrink-0 w-12 h-12 ${colors.badge} rounded-lg flex items-center justify-center text-2xl`}>📄</div>
                  <div>
                    <div className={`font-bold text-gray-800 group-${colors.linkHover} transition-colors`}>Ver convocatoria en {diarioOficial}</div>
                    <div className="text-sm text-gray-500">{boeRef} {boeFechaCorta ? `- ${boeFechaCorta}` : ''}</div>
                  </div>
                </a>
              )}
              {seguimientoUrl && (
                <a href={seguimientoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">🔍</div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Seguimiento del proceso</div>
                    <div className="text-sm text-gray-500">Consulta el estado actualizado</div>
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
                          hito.status === 'completed' ? 'bg-green-100 text-green-600 border-2 border-green-500' :
                          hito.status === 'current' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse' :
                          'bg-gray-100 text-gray-400 border-2 border-gray-300'
                        }`}>
                          {hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}
                        </div>
                        <div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              hito.status === 'completed' ? 'bg-green-100 text-green-700' :
                              hito.status === 'current' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>{formatDateCorta(hito.fecha)}</span>
                            {hito.status === 'current' && <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>}
                          </div>
                          <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>
                            {hito.url ? <a href={hito.url} target="_blank" rel="noopener noreferrer" className={`${colors.linkHover} hover:underline transition-colors`}>{hito.titulo}</a> : hito.titulo}
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

          {/* Temario */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en {config.blocks.length} bloques</p>
            <div className={`grid md:grid-cols-${Math.min(config.blocks.length, 2)} gap-6`}>
              {config.blocks.map((block) => (
                <div key={block.id} className={`bg-white rounded-xl shadow-lg p-5 border-l-4 ${colors.borderAccent}`}>
                  <p className="text-xs text-gray-500 mb-1">{block.themes.length} temas</p>
                  <h3 className="text-base font-bold mb-3 text-gray-800">{block.icon} {block.title}</h3>
                  {block.subtitle && <p className="text-xs text-gray-500 mb-2">{block.subtitle}</p>}
                  <ul className="space-y-1 text-xs text-gray-600">
                    {block.themes.map(theme => (
                      <li key={theme.id}>
                        <Link href={`/${config.slug}/test/tema/${theme.id}`} className={`${colors.linkHover} hover:underline`}>
                          {theme.displayNumber || theme.id}. {theme.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* FAQs */}
          {faqs.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-center mb-8">❓ Preguntas Frecuentes</h2>
              <div className="max-w-3xl mx-auto space-y-4">
                {faqs.map((faq, i) => (
                  <details key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
                    <summary className="px-6 py-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50 transition-colors list-none flex justify-between items-center">
                      {faq.pregunta}
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-6 pb-4 text-gray-600 leading-relaxed">{faq.respuesta}</div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* CTA final */}
          <div className="text-center mb-8">
            <div className={`${colors.gradient} rounded-xl p-8 text-white`}>
              <h2 className="text-2xl font-bold mb-4">¿Listo para empezar?</h2>
              <p className="mb-6 opacity-90">Practica con tests tipo examen y prepárate para aprobar.</p>
              <Link href={`/${config.slug}/test`} className="inline-block bg-white text-gray-800 px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                🎯 Empezar Tests Gratis
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
