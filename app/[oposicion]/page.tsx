// app/[oposicion]/page.tsx - Landing page dinámica unificada
// Template único que genera todas las landings desde BD + config.
// Las landings estáticas (app/auxiliar-administrativo-*/page.tsx) tienen prioridad
// sobre esta ruta dinámica. Se migran una a una borrando el archivo estático.
import { getOposicion, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import {
  getOposicionLandingDataCached,
  getHitosConvocatoriaCached,
  getTopicNamesForLandingCached,
} from '@/lib/api/convocatoria/queries'
import { safeServerFetch } from '@/lib/db/safeServerFetch'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import AutoAssignOposicion from '@/components/AutoAssignOposicion'
import { formatNumber, formatDateLarga, formatDateCorta } from '@/lib/utils/format'
import { getColorScheme } from '@/lib/utils/landing-colors'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
// force-dynamic: las landings hacen queries pesadas (landing data + hitos + topic names)
// que causan timeout en build con 3600+ páginas concurrentes. Se renderizan bajo demanda.
export const dynamic = 'force-dynamic'
// maxDuration 30s tras cascada del 8 may 23:27 UTC donde landings hit 300s
// completos (504). Las queries normalmente <500ms cacheadas; 30s da margen sin
// permitir que un blip de pool retenga el lambda los 5min.
export const maxDuration = 30

// Timeouts por query (cada una con su tag para identificar en logs).
const LANDING_DATA_TIMEOUT_MS = 8000
const HITOS_TIMEOUT_MS = 6000
const TOPIC_NAMES_TIMEOUT_MS = 6000

export async function generateMetadata({ params }: { params: Promise<{ oposicion: string }> }): Promise<Metadata> {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) return {}

  const data = await safeServerFetch(
    () => getOposicionLandingDataCached(oposicion),
    LANDING_DATA_TIMEOUT_MS,
    'landing-metadata',
  )
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

  // 3 fetches con quick-fail; en timeout devuelven null y el render usa fallbacks
  // (ya implementados — todos los accesos a `data` usan ?? con defaults).
  const [data, hitos, topicNamesArr] = await Promise.all([
    safeServerFetch(
      () => getOposicionLandingDataCached(oposicion),
      LANDING_DATA_TIMEOUT_MS,
      'landing-data',
    ),
    safeServerFetch(
      () => getHitosConvocatoriaCached(oposicion),
      HITOS_TIMEOUT_MS,
      'landing-hitos',
    ),
    safeServerFetch(
      () => getTopicNamesForLandingCached(config.positionType),
      TOPIC_NAMES_TIMEOUT_MS,
      'landing-topics',
    ),
  ])
  // hitos puede ser null si timeout — normalizar a [] para que el resto
  // del render no crashee (.find, .length, .map).
  const hitosSafe = hitos ?? []
  const colors = getColorScheme(data?.colorPrimario ?? null)

  // Fetch topic names from BD (para que el temario preview no dependa de oposiciones.ts)
  const topicNamesFromBD = new Map(topicNamesArr ?? [])

  // Estado del proceso (para distinguir OEP vs convocatoria en los botones)
  const estadoProceso = data?.estadoProceso ?? 'sin_oep'
  const esOepSinConvocatoria = estadoProceso === 'oep_aprobada' || estadoProceso === 'sin_oep'

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

  const isApproxDate = data?.examDateApproximate ?? false
  const textoExamen = examDate
    ? isApproxDate
      ? `Examen previsto: ${examDate} (fecha aproximada)`
      : `Examen: ${examDate}`
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
  // Defensivo: si llega undefined/null/no-string, devolver string vacío en vez
  // de propagar TypeError. Una entry malformada en JSONB de BD (ej. snapshot de
  // cache antiguo con esquema previo) no debe tumbar la página entera.
  function resolveVars(text: unknown): string {
    if (typeof text !== 'string') return ''
    return text.replace(/\{(\w+)\}/g, (_, key) => {
      const val = varsMap[key]
      if (val === undefined) {
        console.warn(`⚠️ [Landing ${oposicion}] Variable no resuelta: {${key}}`)
      }
      return val ?? ''
    })
  }

  // Estadísticas hero (de BD con variables resueltas, o generadas).
  // Filtramos entries que no respeten el esquema {numero,texto,color} —
  // pueden venir snapshots viejos con {label,value} u otros campos.
  const rawStats = data?.landingEstadisticas as Array<{ numero?: unknown; texto?: unknown; color?: unknown }> | null
  const estadisticas = rawStats && rawStats.length > 0
    ? rawStats
        .filter((s) => s && typeof s.numero === 'string')
        .map((s) => ({
          numero: resolveVars(s.numero),
          texto: typeof s.texto === 'string' ? s.texto : '',
          color: typeof s.color === 'string' ? s.color : 'text-blue-600',
        }))
    : []

  // Si tras el filtro quedó vacío, generamos las stats por defecto.
  const estadisticasSafe = estadisticas.length > 0
    ? estadisticas
    : [
        { numero: plazasLibres ? formatNumber(plazasLibres) : '—', texto: 'Plazas', color: `text-blue-600` },
        { numero: String(temasCount), texto: 'Temas', color: 'text-green-600' },
        { numero: String(config.blocks.length), texto: 'Bloques', color: 'text-purple-600' },
        { numero: config.badge, texto: 'Grupo', color: 'text-orange-600' },
      ]

  // FAQs (de BD con variables resueltas, o genéricas). Mismo filtro defensivo.
  const rawFaqs = data?.landingFaqs as Array<{ pregunta?: unknown; respuesta?: unknown }> | null
  const faqs = rawFaqs && rawFaqs.length > 0
    ? rawFaqs
        .filter((f) => f && typeof f.pregunta === 'string' && typeof f.respuesta === 'string')
        .map((f) => ({ pregunta: resolveVars(f.pregunta), respuesta: resolveVars(f.respuesta) }))
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
  const examHito = hitosSafe.find(h => h.titulo.toLowerCase().includes('examen') && h.status !== 'completed')
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
        <AutoAssignOposicion slug={oposicion} />
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

            {plazasLibres != null && plazasLibres > 0 && (
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Oposición con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>.
                {plazasDiscapacidad != null && plazasDiscapacidad > 0 ? ` ${formatNumber(plazasDiscapacidad)} reservadas para discapacidad.` : ''}
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
            <div className={`grid grid-cols-2 md:grid-cols-${Math.min(estadisticasSafe.length, 4)} gap-4 max-w-2xl mx-auto`}>
              {estadisticasSafe.map((stat, i) => (
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
                {plazasLibres != null && plazasLibres > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                    <div className="text-sm opacity-80">Plazas libres</div>
                  </div>
                )}
                {plazasPromocion != null && plazasPromocion > 0 && (
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
                    <div className={`font-bold text-gray-800 group-${colors.linkHover} transition-colors`}>
                      {esOepSinConvocatoria ? `Ver OEP en ${diarioOficial}` : `Ver convocatoria en ${diarioOficial}`}
                    </div>
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
          {hitosSafe.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">📅 Estado del Proceso Selectivo</h2>
              <div className="max-w-3xl mx-auto">
                <div className="relative">
                  <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {hitosSafe.map((hito) => (
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
                    {block.themes.map(theme => {
                      const bdName = topicNamesFromBD.get(theme.id)
                      const displayName = bdName || theme.name
                      return (
                        <li key={theme.id}>
                          <Link href={`/${config.slug}/test/tema/${theme.id}`} className={`${colors.linkHover} hover:underline`}>
                            {theme.displayNumber || theme.id}. {displayName}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Oposiciones compatibles CTA */}
          <section className="mb-12 text-center">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-indigo-100 dark:border-indigo-800">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                ¿Ya estudias para otra oposición?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-lg mx-auto">
                Descubre qué porcentaje del temario de {config.shortName} ya cubres con tu preparación actual.
              </p>
              <Link
                href={`/${config.slug}/oposiciones-compatibles`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
              >
                Ver oposiciones compatibles
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
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
