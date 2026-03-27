// app/administrativo-estado/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const revalidate = 86400 // ISR 24h

export const metadata: Metadata = {
  title: 'Administrativo del Estado 2026 | Tests y Temario Gratis Online',
  description: 'Prepara la oposición de Administrativo del Estado con tests gratuitos y temarios actualizados. 45 temas oficiales BOE 2025, 2.512 plazas convocatoria publicada.',
  keywords: [
    'administrativo del estado',
    'oposiciones administrativo estado',
    'test administrativo del estado',
    'temario administrativo del estado gratis',
    'oposiciones 2026',
    'convocatoria administrativo estado 2026',
    '45 temas administrativo',
    'preparar administrativo estado gratis',
    'examenes administrativo estado',
    'plazas administrativo estado 2026'
  ].join(', '),
  authors: [{ name: 'Vence - Preparación Oposiciones' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Administrativo del Estado 2026 | Preparación Completa Gratuita',
    description: 'Tests gratuitos y temario oficial BOE 22/12/2025 para la oposición de Administrativo del Estado. ¡Convocatoria publicada! 2.512 plazas.',
    url: `${SITE_URL}/administrativo-estado`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Administrativo del Estado 2026 | Convocatoria Publicada',
    description: '2.512 plazas turno libre. Temario 45 temas BOE 22/12/2025. Tests gratuitos online.'
  },
  alternates: {
    canonical: `${SITE_URL}/administrativo-estado`,
  },
  robots: { index: true, follow: true },
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

export default async function AdministrativoEstado() {
  const data = await getOposicionLandingData('administrativo-estado')
  const hitos = await getHitosConvocatoria('administrativo-estado')

  const plazasLibres = data?.plazasLibres ?? 2512
  const plazasPromocion = data?.plazasPromocionInterna ?? 6178
  const temasCount = data?.temasCount ?? 45
  const boeRef = data?.boeReference ?? 'BOE-A-2025-26262'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '22 de diciembre de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '22/12/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const salarioMin = data?.salarioMin ?? 22000
  const salarioMax = data?.salarioMax ?? 30000
  const tituloRequerido = data?.tituloRequerido ?? 'Bachillerato o Técnico FP'

  const inscripcionCerrada = data?.inscriptionDeadline
    ? new Date(data.inscriptionDeadline) < new Date()
    : true
  const inscripcionInicio = data?.inscriptionStart ? formatDateLarga(data.inscriptionStart) : null
  const inscripcionFin = data?.inscriptionDeadline ? formatDateLarga(data.inscriptionDeadline) : null

  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null

  const textoExamen = examDate
    ? `Examen previsto para el ${examDate}`
    : 'Examen previsto primer semestre 2026'

  const textoInscripcion = inscripcionCerrada
    ? 'Plazo de inscripción cerrado.'
    : `Plazo de inscripción: del ${inscripcionInicio} al ${inscripcionFin}.`

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas libres", color: "text-blue-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 6), texto: "Bloques", color: "text-purple-600" },
    { numero: "Bach.", texto: "Título requerido", color: "text-orange-600" }
  ]

  const faqs = [
    {
      pregunta: "¿Cuándo es el examen de Administrativo del Estado 2026?",
      respuesta: `La convocatoria fue publicada en BOE el ${boeFechaLarga} (${boeRef}). ${textoExamen}. ${inscripcionCerrada ? `El plazo de inscripción fue del ${inscripcionInicio ?? '23 de diciembre de 2025'} al ${inscripcionFin ?? '22 de enero de 2026'}.` : textoInscripcion}`
    },
    {
      pregunta: "¿Cuántas plazas hay para Administrativo del Estado 2026?",
      respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas en turno libre y ${formatNumber(plazasPromocion)} plazas en promoción interna.`
    },
    {
      pregunta: "¿Cuál es el programa oficial de Administrativo del Estado?",
      respuesta: `El programa según BOE ${boeFechaCorta} consta de ${temasCount} temas en 6 bloques: Organización del Estado (11), Organización de Oficinas (4), Derecho Administrativo (7), Gestión de Personal (9), Gestión Financiera (6) e Informática y Ofimática (8).`
    },
    {
      pregunta: "¿Qué requisitos necesito para opositar a Administrativo del Estado?",
      respuesta: `Nacionalidad española o europea, tener 16 años y no exceder edad de jubilación, título de ${tituloRequerido}, y no estar inhabilitado para funciones públicas.`
    },
    {
      pregunta: "¿En qué consiste el examen de Administrativo del Estado?",
      respuesta: "El proceso selectivo consiste en un ejercicio único tipo test que incluye parte teórica sobre los 45 temas del programa y supuestos prácticos."
    },
    {
      pregunta: "¿Cuál es el sueldo de un Administrativo del Estado?",
      respuesta: `El sueldo del Grupo C1 se sitúa entre 1.600-2.000€ brutos mensuales. Con complementos, trienios y pagas extra puede alcanzar ${formatNumber(salarioMin)}-${formatNumber(salarioMax)}€ anuales dependiendo del destino.`
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
    "name": "Examen Administrativo del Estado 2026",
    "description": examHito.descripcion ?? "Examen de oposición para Administrativo del Estado",
    "startDate": examHito.fecha,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "organizer": { "@type": "Organization", "name": "INAP" },
    "location": { "@type": "Place", "name": "Sedes de examen en toda España" }
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      {schemaEvent && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaEvent) }} />}

      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              🏢 ADMINISTRACIÓN GENERAL DEL ESTADO - GRUPO C1
            </span>

            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">
              Administrativo del Estado 2026
            </h1>

            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                Convocatoria oficial publicada - {textoExamen}
              </span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Oposición de nivel superior (C1) con <strong>{formatNumber(plazasLibres)} plazas en turno libre</strong>.
              Temario oficial según BOE {boeFechaCorta}.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/administrativo-estado/test"
                className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                <span className="text-2xl">🎯</span><span>Empezar a Practicar</span>
              </Link>
              <Link href="/administrativo-estado/temario"
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
                <div className="text-2xl font-bold">{formatNumber(plazasPromocion)}</div>
                <div className="text-blue-100 text-sm">Promoción int.</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{temasCount}</div>
                <div className="text-blue-100 text-sm">Temas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{data?.bloquesCount ?? 6}</div>
                <div className="text-blue-100 text-sm">Bloques</div>
              </div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-blue-100 text-sm">
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

          {/* Temario Oficial BOE - 6 bloques */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial BOE {boeFechaCorta}</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 6 bloques</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Bloque I */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">11 temas (1-11)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque I: Organización del Estado</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li>
                  <li>2. La Jefatura del Estado. La Corona</li>
                  <li>3. Las Cortes Generales</li>
                  <li>4. El Poder Judicial</li>
                  <li>5. El Gobierno y la Administración</li>
                  <li>6. El Gobierno Abierto. Agenda 2030</li>
                  <li>7. La Ley 19/2013 de Transparencia</li>
                  <li>8. La Administración General del Estado</li>
                  <li>9. La Organización Territorial del Estado</li>
                  <li>10. La Administración Local</li>
                  <li>11. La Organización de la Unión Europea</li>
                </ul>
              </div>
              {/* Bloque II */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 mb-1">4 temas (12-15)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque II: Organización de Oficinas Públicas</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>12. Atención al Público</li>
                  <li>13. Documento, Registro y Archivo</li>
                  <li>14. Administración Electrónica</li>
                  <li>15. Protección de Datos Personales</li>
                </ul>
              </div>
              {/* Bloque III */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 mb-1">7 temas (16-22)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque III: Derecho Administrativo General</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>16. Las Fuentes del Derecho Administrativo</li>
                  <li>17. El Acto Administrativo</li>
                  <li>18. Las Leyes del Procedimiento Administrativo</li>
                  <li>19. Los Contratos del Sector Público</li>
                  <li>20. Procedimientos y Formas de la Actividad Administrativa</li>
                  <li>21. La Responsabilidad Patrimonial</li>
                  <li>22. Políticas de Igualdad <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1 rounded">LGTBI nuevo</span></li>
                </ul>
              </div>
              {/* Bloque IV */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-orange-500">
                <p className="text-xs text-gray-500 mb-1">9 temas (23-31)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque IV: Gestión de Personal</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>23. El Personal al Servicio de las Administraciones Públicas</li>
                  <li>24. Selección de Personal</li>
                  <li>25. El Personal Funcionario</li>
                  <li>26. Adquisición y Pérdida de la Condición de Funcionario</li>
                  <li>27. Provisión de Puestos de Trabajo</li>
                  <li>28. Las Incompatibilidades y Régimen Disciplinario</li>
                  <li>29. El Régimen de la Seguridad Social de los Funcionarios</li>
                  <li>30. El Personal Laboral</li>
                  <li>31. El Régimen de la Seguridad Social del Personal Laboral</li>
                </ul>
              </div>
              {/* Bloque V */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-red-500">
                <p className="text-xs text-gray-500 mb-1">6 temas (32-37)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque V: Gestión Financiera</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>32. El Presupuesto</li>
                  <li>33. El Presupuesto del Estado en España</li>
                  <li>34. El Procedimiento de Ejecución del Presupuesto de Gasto</li>
                  <li>35. Las Retribuciones e Indemnizaciones</li>
                  <li>36. Gastos para la Compra de Bienes y Servicios</li>
                  <li>37. Gestión Económica y Financiera</li>
                </ul>
              </div>
              {/* Bloque VI */}
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-indigo-500">
                <p className="text-xs text-gray-500 mb-1">8 temas (38-45)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque VI: Informática Básica y Ofimática</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>38. Informática Básica</li>
                  <li>39. Sistema Operativo Windows <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1 rounded">Copilot nuevo</span></li>
                  <li>40. El Explorador de Windows</li>
                  <li>41. Procesadores de Texto: Word 365</li>
                  <li>42. Hojas de Cálculo: Excel 365</li>
                  <li>43. Bases de Datos: Access 365</li>
                  <li>44. Correo Electrónico: Outlook 365</li>
                  <li>45. La Red Internet</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/administrativo-estado/temario"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors">
                <span>📚</span><span>Ver Temario Completo con Epígrafes</span>
              </Link>
            </div>
          </section>

          {/* Descripción SEO */}
          <section className="mb-12">
            <div className="bg-white rounded-lg shadow-md p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">
                ¿Qué es la Oposición de Administrativo del Estado?
              </h2>
              <div className="prose max-w-none text-gray-700">
                <p className="text-lg mb-4">
                  La <strong>oposición de Administrativo del Estado</strong> es uno de los procesos selectivos más demandados del <strong>Grupo C1</strong> en la Administración General del Estado. Es el nivel superior al de Auxiliar Administrativo y ofrece mayores responsabilidades y retribución.
                </p>
                <h3 className="text-xl font-semibold mt-6 mb-3">Funciones del Administrativo del Estado</h3>
                <p className="mb-4">
                  Los administrativos del Estado realizan tareas de <strong>gestión administrativa de nivel medio-alto</strong> en ministerios y organismos públicos:
                </p>
                <ul className="list-disc pl-6 mb-6 space-y-2">
                  <li>Gestión y tramitación de expedientes complejos</li>
                  <li>Elaboración de informes y propuestas administrativas</li>
                  <li>Gestión presupuestaria y contratación pública</li>
                  <li>Coordinación de equipos de auxiliares administrativos</li>
                  <li>Atención especializada al ciudadano</li>
                </ul>
                <h3 className="text-xl font-semibold mt-6 mb-3">Ventajas de ser Administrativo del Estado</h3>
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">💼 Estabilidad Laboral</h4>
                    <p className="text-sm text-green-700">Trabajo fijo con todas las garantías del empleo público</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">💰 Mayor Retribución</h4>
                    <p className="text-sm text-blue-700">Sueldo superior al C2, entre {formatNumber(salarioMin)}-{formatNumber(salarioMax)}€ anuales</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">📈 Desarrollo Profesional</h4>
                    <p className="text-sm text-purple-700">Promoción interna a Grupo B y formación continua</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">🌍 Movilidad Geográfica</h4>
                    <p className="text-sm text-orange-700">Destinos en toda España según preferencias</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQs */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">
              Preguntas Frecuentes sobre Administrativo del Estado
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
          <section className="bg-blue-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-blue-100 mb-6 max-w-xl mx-auto">
              Únete a miles de opositores que se preparan con nuestro material gratuito.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/administrativo-estado/test"
                className="bg-white text-blue-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">
                🎯 Empezar Tests
              </Link>
              <Link href="/administrativo-estado/temario"
                className="bg-yellow-500 text-blue-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">
                📚 Ver Temarios
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
