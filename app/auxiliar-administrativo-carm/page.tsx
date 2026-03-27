// app/auxiliar-administrativo-carm/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo CARM 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Comunidad Autónoma de la Región de Murcia: 52 plazas, temario oficial 21 temas, 2 bloques. Tests gratuitos.',
  keywords: ['auxiliar administrativo murcia','oposiciones auxiliar carm','temario auxiliar murcia','oposiciones region de murcia','21 temas auxiliar carm','plazas auxiliar murcia'].join(', '),
  authors: [{ name: 'Vence' }], metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Auxiliar Administrativo CARM | 52 Plazas', description: 'Temario oficial 21 temas en 2 bloques.', url: `${SITE_URL}/auxiliar-administrativo-carm`, siteName: 'Vence', locale: 'es_ES', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Auxiliar Administrativo CARM', description: '52 plazas. Temario 21 temas.' },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-carm` },
}

function formatNumber(n: number | null): string { if (n == null) return '—'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function formatDateLarga(dateStr: string | null): string { if (!dateStr) return ''; const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m, d] = dateStr.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}` }
function formatDateCorta(dateStr: string | null): string { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}` }

export default async function AuxiliarAdministrativoCarm() {
  const data = await getOposicionLandingData('auxiliar-administrativo-carm')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-carm')

  const plazasLibres = data?.plazasLibres ?? 52
  const plazasDiscapacidad = data?.plazasDiscapacidad ?? 6
  const temasCount = data?.temasCount ?? 21
  const boeRef = data?.boeReference ?? 'BORM num. 262, 12/11/2025'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '12 de noviembre de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '12/11/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'
  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null

  const textoExamen = examDate ? `Examen previsto para el ${examDate}` : 'Fecha de examen pendiente de confirmación'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas acceso libre", color: "text-rose-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const faqs = [
    { pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de la CARM?", respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre (${formatNumber(plazasDiscapacidad)} reservadas para discapacidad).` },
    { pregunta: "¿Cuál es el programa oficial?", respuesta: `El programa consta de ${temasCount} temas en 2 bloques: Derecho y Administración (9 temas), Gestión Administrativa (7 temas) y Ofimática (5 temas).` },
    { pregunta: "¿Qué requisitos necesito para opositar?", respuesta: `Nacionalidad española o europea, tener 16 años cumplidos, título de ${tituloRequerido} (Grupo C2), y no estar inhabilitado para funciones públicas.` },
  ]

  const schemaFAQ = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(faq => ({ "@type": "Question", "name": faq.pregunta, "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta } })) }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-sm font-medium">🏛️ REGIÓN DE MURCIA - GRUPO C2</span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo CARM</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-rose-100 text-rose-700 px-3 py-1 rounded-full font-bold">Convocatoria publicada - {textoExamen}</span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Oposición para la CARM con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-carm/test" className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"><span className="text-2xl">🎯</span><span>Empezar a Practicar</span></Link>
              <Link href="/auxiliar-administrativo-carm/temario" className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-rose-300 transition-all"><span className="text-xl">📚</span><span>Ver Temario</span></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, i) => (<div key={i} className="bg-white rounded-lg p-4 shadow-md"><div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div><div className="text-sm text-gray-600">{stat.texto}</div></div>))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-rose-600 to-rose-700 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center"><div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div><div className="text-rose-100 text-sm">Plazas libres</div></div>
              <div className="text-center"><div className="text-2xl font-bold">{temasCount}</div><div className="text-rose-100 text-sm">Temas</div></div>
              <div className="text-center"><div className="text-2xl font-bold">C2</div><div className="text-rose-100 text-sm">Grupo</div></div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-rose-100 text-sm">{textoExamen}.</p>
            </div>
            {oepDecreto && (
              <p className="text-sm mt-2 opacity-80">
                OEP: {oepDecreto}{oepFecha ? ` (${oepFecha})` : ''}
              </p>
            )}
          </div>

          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (<a href={programaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-rose-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-rose-200 transition-colors">📄</div><div><div className="font-bold text-gray-800 group-hover:text-rose-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BORM'}</div><div className="text-sm text-gray-500">{boeFechaCorta}</div></div></a>)}
              {seguimientoUrl && (<a href={seguimientoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">🔍</div><div><div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Seguimiento del proceso selectivo</div><div className="text-sm text-gray-500">Estado actual, listas y documentos oficiales</div></div></a>)}
            </div>
          )}

          {hitos.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">📅 Estado del Proceso Selectivo</h2>
              <div className="max-w-3xl mx-auto"><div className="relative"><div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" /><div className="space-y-6">
                {hitos.map((hito) => (
                  <div key={hito.id} className="relative flex items-start gap-4 md:gap-6">
                    <div className={`relative z-10 flex-shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base ${hito.status === 'completed' ? 'bg-green-100 text-green-600 border-2 border-green-500' : hito.status === 'current' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse' : 'bg-gray-100 text-gray-400 border-2 border-gray-300'}`}>{hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}</div>
                    <div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hito.status === 'completed' ? 'bg-green-100 text-green-700' : hito.status === 'current' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{formatDateCorta(hito.fecha)}</span>
                        {hito.status === 'current' && <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>}
                      </div>
                      <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>{hito.url ? <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-rose-600 hover:underline transition-colors">{hito.titulo}</a> : hito.titulo}</h3>
                      {hito.descripcion && <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>}
                    </div>
                  </div>
                ))}
              </div></div></div>
            </section>
          )}

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 2 bloques</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-rose-500">
                <p className="text-xs text-gray-500 mb-1">9 temas (1-9)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Derecho y Administración</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li>
                  <li>2. Estatuto de Autonomía de la Región de Murcia</li>
                  <li>3. El Presidente y Consejo de Gobierno de Murcia</li>
                  <li>4. Régimen Jurídico del Sector Público</li>
                  <li>5. Disposiciones y actos administrativos</li>
                  <li>6. El procedimiento administrativo</li>
                  <li>7. Revisión de actos en vía administrativa</li>
                  <li>8. Estatuto Básico del Empleado Público</li>
                  <li>9. Contratos del Sector Público</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">12 temas (10-21)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Gestión Administrativa y Ofimática</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>10. Hacienda de la Región de Murcia</li>
                  <li>11. Administración electrónica</li>
                  <li>12. Información administrativa y atención al ciudadano</li>
                  <li>13. Archivos y Patrimonio Documental de Murcia</li>
                  <li>14. Los documentos administrativos</li>
                  <li>15. Prevención de Riesgos Laborales</li>
                  <li>16. Igualdad, Transparencia y Protección de datos</li>
                  <li>17. Presentaciones con PowerPoint 2016</li>
                  <li>18. Hoja de cálculo Excel 2016</li>
                  <li>19. Firma electrónica y certificados digitales</li>
                  <li>20. Procesador de textos Word 2016</li>
                  <li>21. Outlook 365</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-carm/temario" className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"><span>📚</span><span>Ver Temario Completo</span></Link>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, i) => (<div key={i} className="bg-white rounded-lg p-6 shadow-md"><h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3><p className="text-gray-600">{faq.respuesta}</p></div>))}
            </div>
          </section>

          <section className="bg-rose-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-rose-100 mb-6 max-w-xl mx-auto">Prepárate con tests tipo examen y temario oficial actualizado.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-carm/test" className="bg-white text-rose-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">🎯 Empezar Tests</Link>
              <Link href="/auxiliar-administrativo-carm/temario" className="bg-yellow-500 text-rose-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">📚 Ver Temario</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
