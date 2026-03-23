// app/auxiliar-administrativo-estado/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria, type HitoConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400 // Revalidar cada 24h

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Estado 2026 | Tests y Temario Gratis Online',
  description: 'Prepara la oposición de Auxiliar Administrativo del Estado con tests gratuitos y temarios actualizados. 28 temas oficiales BOE 2025, convocatoria publicada.',
  keywords: [
    'auxiliar administrativo estado',
    'auxiliar administrativo del estado',
    'oposiciones auxiliar administrativo',
    'test auxiliar administrativo estado',
    'temario auxiliar administrativo',
    'oposiciones 2026',
    'examenes oficiales auxiliar administrativo',
    'preparar auxiliar administrativo gratis',
    '28 temas auxiliar administrativo',
    'convocatoria auxiliar administrativo 2026'
  ].join(', '),
  authors: [{ name: 'Vence - Preparación Oposiciones' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Auxiliar Administrativo Estado 2026 | Preparación Completa Gratuita',
    description: 'Tests gratuitos y temario oficial BOE 22/12/2025 para la oposición de Auxiliar Administrativo del Estado. ¡Convocatoria publicada!',
    url: `${SITE_URL}/auxiliar-administrativo-estado`,
    siteName: 'Vence',
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

/** Formatea número con separador de miles español: 1700 → "1.700" */
function formatNumber(n: number | null): string {
  if (n == null) return '—'
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Formatea fecha ISO a español largo: "2025-12-22" → "22 de diciembre de 2025" */
function formatDateLarga(dateStr: string | null): string {
  if (!dateStr) return ''
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${d} de ${meses[m - 1]} de ${y}`
}

/** Formatea fecha ISO a corto: "2025-12-22" → "22/12/2025" */
function formatDateCorta(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export default async function AuxiliarAdministrativoEstado() {
  const data = await getOposicionLandingData('auxiliar-administrativo-estado')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-estado')

  // Datos de BD con fallbacks al valor actual hardcodeado
  const plazasLibres = data?.plazasLibres ?? 1700
  const plazasPromocion = data?.plazasPromocionInterna ?? 720
  const temasCount = data?.temasCount ?? 28
  const boeRef = data?.boeReference ?? 'BOE-A-2025-26262'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '22 de diciembre de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '22/12/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const salarioMin = data?.salarioMin ?? 18000
  const salarioMax = data?.salarioMax ?? 24000
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'

  // Determinar estado de inscripción
  const inscripcionCerrada = data?.inscriptionDeadline
    ? new Date(data.inscriptionDeadline) < new Date()
    : true
  const inscripcionInicio = data?.inscriptionStart ? formatDateLarga(data.inscriptionStart) : null
  const inscripcionFin = data?.inscriptionDeadline ? formatDateLarga(data.inscriptionDeadline) : null

  const textoExamen = examDate
    ? `Examen previsto para el ${examDate}`
    : 'Examen previsto primer semestre 2026'

  const textoInscripcion = inscripcionCerrada
    ? 'Plazo de inscripción cerrado.'
    : `Plazo de inscripción: del ${inscripcionInicio} al ${inscripcionFin}.`

  const estadisticas = [
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-blue-600" },
    { numero: "110", texto: "Preguntas test", color: "text-green-600" },
    { numero: "90", texto: "Minutos examen", color: "text-purple-600" },
    { numero: "ESO", texto: "Solo necesitas", color: "text-orange-600" }
  ]

  const serviciosPrincipales = [
    {
      icon: "📚",
      titulo: "Temarios Completos",
      descripcion: `${temasCount} temas del programa oficial según BOE ${boeFechaCorta}. 2 bloques: Organización pública y Actividad administrativa.`,
      enlace: "/auxiliar-administrativo-estado/temario",
      cta: "📚 Ver Temarios",
      stats: `${temasCount} temas • 2 bloques • BOE 2025`,
      color: "bg-blue-600 hover:bg-blue-700"
    },
    {
      icon: "🎯",
      titulo: "Tests y Exámenes",
      descripcion: "Tests específicos de cada tema y exámenes oficiales de convocatorias anteriores.",
      enlace: "/auxiliar-administrativo-estado/test",
      cta: "🎯 Empezar Tests",
      stats: "500+ preguntas • Todos los temas",
      color: "bg-green-600 hover:bg-green-700"
    }
  ]

  const faqs = [
    {
      pregunta: "¿Cuándo es el examen de Auxiliar Administrativo del Estado 2026?",
      respuesta: `La convocatoria fue publicada en el BOE el ${boeFechaLarga} (${boeRef}). ${textoExamen}. ${inscripcionCerrada ? `El plazo de inscripción fue del ${inscripcionInicio ?? '23 de diciembre de 2025'} al ${inscripcionFin ?? '22 de enero de 2026'}.` : `${textoInscripcion}`}`
    },
    {
      pregunta: "¿Cuál es el temario oficial de Auxiliar Administrativo del Estado?",
      respuesta: `El temario consta de ${temasCount} temas divididos en 2 bloques según BOE ${boeFechaCorta}: Bloque I - Organización pública (16 temas) y Bloque II - Actividad administrativa y ofimática (12 temas). Incluye novedades como políticas LGTBI y Copilot de Windows.`
    },
    {
      pregunta: "¿Qué requisitos necesito para presentarme a la oposición?",
      respuesta: `Debes tener nacionalidad española o de la UE, tener 16 años cumplidos y no exceder la edad de jubilación, tener el título de ${tituloRequerido}, y no estar inhabilitado para el ejercicio de funciones públicas.`
    },
    {
      pregunta: "¿Cómo es el examen de Auxiliar Administrativo del Estado?",
      respuesta: "El examen consta de un ejercicio único de 90 minutos con 110 preguntas tipo test: 60 preguntas sobre el programa oficial (30 teóricas + 30 psicotécnicas) y 50 preguntas sobre conocimientos ofimáticos de Windows y Microsoft 365."
    },
    {
      pregunta: "¿Cuál es el sueldo de un Auxiliar Administrativo del Estado?",
      respuesta: `El sueldo se sitúa entre 1.400-1.800€ brutos mensuales, perteneciendo al Grupo C2. Con complementos, trienios y pagas extra puede alcanzar los ${formatNumber(salarioMin)}-${formatNumber(salarioMax)}€ anuales dependiendo del destino.`
    },
    {
      pregunta: "¿Qué novedades tiene el temario de 2025?",
      respuesta: `Las principales novedades del BOE ${boeFechaCorta} son: inclusión de políticas de igualdad LGTBI (Tema 16), Copilot de Windows como asistente IA (Tema 22), y actualización a Microsoft 365 en todos los temas de ofimática.`
    }
  ]

  // Schema JSON-LD: FAQ
  const schemaFAQ = {
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

  // Schema JSON-LD: Evento del examen (para rich snippets en Google)
  const examHito = hitos.find(h => h.titulo.toLowerCase().includes('examen') && h.status !== 'completed')
  const schemaEvent = examHito ? {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "Examen Auxiliar Administrativo del Estado 2026",
    "description": examHito.descripcion ?? "Examen de oposición para Auxiliar Administrativo del Estado",
    "startDate": examHito.fecha,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": {
      "@type": "Organization",
      "name": "INAP - Instituto Nacional de Administración Pública"
    },
    "location": {
      "@type": "Place",
      "name": "Sedes de examen en toda España"
    }
  } : null

  return (
    <>
      {/* Schema JSON-LD */}
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
            <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-sm font-medium">
              🏛️ CONVOCATORIA PUBLICADA BOE {boeFechaCorta}
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Auxiliar Administrativo del Estado 2026
            </h1>

            <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
              <span className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">
                Convocatoria oficial publicada - {textoExamen}
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Prepárate con el temario actualizado según BOE y nuestro sistema completo de tests.
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

          {/* Información de la Convocatoria 2026 */}
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria 2026 - ¡Publicada en BOE!</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div>
                <div className="text-green-100 text-sm">Plazas libres</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatNumber(plazasPromocion)}</div>
                <div className="text-green-100 text-sm">Promoción int.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{temasCount}</div>
                <div className="text-green-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">110</div>
                <div className="text-green-100 text-sm">Preguntas</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-green-100 text-sm">
                <strong>{textoInscripcion}</strong> {textoExamen}.
              </p>
            </div>
            <p className="text-green-100 text-sm mt-4">
              Examen tipo test de 90 minutos. Novedades del temario: políticas LGTBI y Copilot de Windows.
            </p>
          </div>

          {/* Enlaces oficiales */}
          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (
                <a
                  href={programaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-emerald-300 transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-emerald-200 transition-colors">
                    📄
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">
                      Ver convocatoria en {data?.diarioOficial ?? 'BOE'}
                    </div>
                    <div className="text-sm text-gray-500">{boeRef} - {boeFechaCorta}</div>
                  </div>
                </a>
              )}
              {seguimientoUrl && (
                <a
                  href={seguimientoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">
                    🔍
                  </div>
                  <div>
                    <div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">
                      Seguimiento del proceso selectivo
                    </div>
                    <div className="text-sm text-gray-500">Estado actual, listas y documentos oficiales</div>
                  </div>
                </a>
              )}
            </div>
          )}

          {/* Estado del Proceso Selectivo - Timeline */}
          {hitos.length > 0 && (
            <section className="mb-10">
              <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
                📅 Estado del Proceso Selectivo
              </h2>
              <div className="max-w-3xl mx-auto">
                <div className="relative">
                  {/* Línea vertical */}
                  <div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

                  <div className="space-y-6">
                    {hitos.map((hito) => (
                      <div key={hito.id} className="relative flex items-start gap-4 md:gap-6">
                        {/* Indicador */}
                        <div className={`relative z-10 flex-shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base ${
                          hito.status === 'completed'
                            ? 'bg-green-100 text-green-600 border-2 border-green-500'
                            : hito.status === 'current'
                              ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse'
                              : 'bg-gray-100 text-gray-400 border-2 border-gray-300'
                        }`}>
                          {hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}
                        </div>

                        {/* Contenido */}
                        <div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              hito.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : hito.status === 'current'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-500'
                            }`}>
                              {formatDateCorta(hito.fecha)}
                            </span>
                            {hito.status === 'current' && (
                              <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>
                            )}
                          </div>
                          <h3 className={`font-semibold ${
                            hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'
                          }`}>
                            {hito.url ? (
                              <a
                                href={hito.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 hover:underline transition-colors"
                              >
                                {hito.titulo}
                              </a>
                            ) : (
                              hito.titulo
                            )}
                          </h3>
                          {hito.descripcion && (
                            <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Temario Oficial BOE */}
          <section className="mb-10">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">
              📋 Temario Oficial BOE 22/12/2025
            </h2>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {/* Bloque I */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <h3 className="text-xl font-bold text-blue-800 mb-4">
                  Bloque I: Organización pública
                </h3>
                <p className="text-sm text-gray-500 mb-4">16 temas (1-16)</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start"><span className="text-blue-500 mr-2">1.</span>La Constitución Española de 1978</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">2.</span>El Tribunal Constitucional. La reforma de la Constitución. La Corona</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">3.</span>Las Cortes Generales</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">4.</span>El Poder Judicial</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">5.</span>El Gobierno y la Administración</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">6.</span>El Gobierno Abierto y la Agenda 2030</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">7.</span>Ley 19/2013 de Transparencia, Acceso a la Información Pública y Buen Gobierno</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">8.</span>La Administración General del Estado</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">9.</span>La Organización territorial del Estado</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">10.</span>La organización de la Unión Europea</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">11.</span>Las Leyes del Procedimiento Administrativo</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">12.</span>La protección de datos personales</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">13.</span>El personal funcionario al servicio de las Administraciones públicas</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">14.</span>Derechos y deberes de los funcionarios</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">15.</span>El presupuesto del Estado en España</li>
                  <li className="flex items-start"><span className="text-blue-500 mr-2">16.</span>Políticas de igualdad y contra la violencia de género <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1 rounded">LGTBI nuevo</span></li>
                </ul>
              </div>

              {/* Bloque II */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <h3 className="text-xl font-bold text-green-800 mb-4">
                  Bloque II: Actividad administrativa y ofimática
                </h3>
                <p className="text-sm text-gray-500 mb-4">12 temas (17-28)</p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start"><span className="text-green-500 mr-2">17.</span>Atención al ciudadano</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">18.</span>Los servicios de información administrativa</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">19.</span>Concepto de documento, registro y archivo</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">20.</span>Administración electrónica y servicios al ciudadano</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">21.</span>Informática básica</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">22.</span>Introducción al sistema operativo Windows 11 <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 rounded">Copilot nuevo</span></li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">23.</span>El explorador de Windows 11</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">24.</span>Procesadores de texto: Word</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">25.</span>Hojas de cálculo: Excel</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">26.</span>Bases de datos: Access</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">27.</span>Correo electrónico</li>
                  <li className="flex items-start"><span className="text-green-500 mr-2">28.</span>La Red Internet</li>
                </ul>
              </div>
            </div>

            <div className="text-center mt-6">
              <Link
                href="/auxiliar-administrativo-estado/temario"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <span>📚</span>
                <span>Ver Temario Completo con Epígrafes</span>
              </Link>
            </div>
          </section>

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
                  Para acceder a esta oposición necesitas cumplir los <strong>requisitos básicos</strong>: tener nacionalidad española o de la UE, tener 16 años cumplidos y no exceder la edad de jubilación, poseer el título de Graduado en ESO o equivalente, y no estar inhabilitado para funciones públicas.
                </p>
                <p className="mb-6">
                  El proceso selectivo consiste en un <strong>examen único</strong> de 90 minutos con 110 preguntas tipo test: 60 preguntas sobre el programa oficial (30 teóricas + 30 psicotécnicas) y 50 preguntas de conocimientos ofimáticos sobre Windows y Microsoft 365.
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
