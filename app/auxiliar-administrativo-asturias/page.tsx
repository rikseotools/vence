// app/auxiliar-administrativo-asturias/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Principado de Asturias 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Principado de Asturias: 7 plazas, temario oficial 25 temas, 3 bloques. Tests gratuitos.',
  keywords: ['auxiliar administrativo asturias','oposiciones auxiliar asturias','temario auxiliar asturias','oposiciones principado asturias','25 temas auxiliar asturias'].join(', '),
  authors: [{ name: 'Vence' }], metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Auxiliar Administrativo Principado de Asturias | 7 Plazas', description: 'Temario oficial 25 temas en 3 bloques.', url: `${SITE_URL}/auxiliar-administrativo-asturias`, siteName: 'Vence', locale: 'es_ES', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Auxiliar Administrativo Asturias', description: '7 plazas. Temario 25 temas.' },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-asturias` },
}

function formatNumber(n: number | null): string { if (n == null) return '—'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function formatDateLarga(dateStr: string | null): string { if (!dateStr) return ''; const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m, d] = dateStr.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}` }
function formatDateCorta(dateStr: string | null): string { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}` }

export default async function AuxiliarAdministrativoAsturias() {
  const data = await getOposicionLandingData('auxiliar-administrativo-asturias')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-asturias')

  const plazasLibres = data?.plazasLibres ?? 7
  const temasCount = data?.temasCount ?? 25
  const boeRef = data?.boeReference ?? 'BOPA num. 240, 29/12/2025'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '29 de diciembre de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '29/12/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'
  const textoExamen = examDate ? `Examen previsto para el ${examDate}` : 'Fecha de examen pendiente de confirmación'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas acceso libre", color: "text-green-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-blue-600" },
    { numero: String(data?.bloquesCount ?? 3), texto: "Bloques", color: "text-purple-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]

  const faqs = [
    { pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo del Principado de Asturias?", respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre. Concurso-oposición.` },
    { pregunta: "¿Cuál es el programa oficial?", respuesta: `El programa consta de ${temasCount} temas en 3 bloques: Derecho Constitucional (6 temas), Derecho Administrativo y Función Pública (14 temas) y Ofimática (5 temas).` },
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
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">🏛️ PRINCIPADO DE ASTURIAS - GRUPO C2</span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo Principado de Asturias</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">Convocatoria publicada - {textoExamen}</span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Oposición para el Principado de Asturias con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>. Concurso-oposición.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-asturias/test" className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"><span className="text-2xl">🎯</span><span>Empezar a Practicar</span></Link>
              <Link href="/auxiliar-administrativo-asturias/temario" className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-green-300 transition-all"><span className="text-xl">📚</span><span>Ver Temario</span></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, i) => (<div key={i} className="bg-white rounded-lg p-4 shadow-md"><div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div><div className="text-sm text-gray-600">{stat.texto}</div></div>))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center"><div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div><div className="text-green-100 text-sm">Plazas libres</div></div>
              <div className="text-center"><div className="text-2xl font-bold">{temasCount}</div><div className="text-green-100 text-sm">Temas</div></div>
              <div className="text-center"><div className="text-2xl font-bold">C2</div><div className="text-green-100 text-sm">Grupo</div></div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-green-100 text-sm">{textoExamen}.</p>
            </div>
          </div>

          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (<a href={programaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-green-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-green-200 transition-colors">📄</div><div><div className="font-bold text-gray-800 group-hover:text-green-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOPA'}</div><div className="text-sm text-gray-500">{boeFechaCorta}</div></div></a>)}
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
                      <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>{hito.url ? <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-green-600 hover:underline transition-colors">{hito.titulo}</a> : hito.titulo}</h3>
                      {hito.descripcion && <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>}
                    </div>
                  </div>
                ))}
              </div></div></div>
            </section>
          )}

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 3 bloques</p>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 mb-1">6 temas (1-6)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Derecho Constitucional</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978 (I)</li>
                  <li>2. La Constitución Española de 1978 (II)</li>
                  <li>3. La Constitución Española de 1978 (III)</li>
                  <li>4. La Administración General del Estado</li>
                  <li>5. El Estatuto de Autonomía del Principado de Asturias</li>
                  <li>6. El Presidente y Consejo de Gobierno del Principado</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">14 temas (7-20)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Derecho Administrativo y Función Pública</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>7. El Tratado de la Unión Europea</li>
                  <li>8. Ley 39/2015 de Procedimiento Administrativo Común</li>
                  <li>9. Ley 40/2015 de Régimen Jurídico del Sector Público</li>
                  <li>10. Régimen Jurídico de la Administración del Principado</li>
                  <li>11. El Estatuto Básico del Empleado Público</li>
                  <li>12. Función Pública del Principado de Asturias</li>
                  <li>13. Convenio Colectivo del personal laboral del Principado</li>
                  <li>14. Régimen Económico y Presupuestario del Principado</li>
                  <li>15. La Ley General de la Seguridad Social (I)</li>
                  <li>16. La Ley General de la Seguridad Social (II)</li>
                  <li>17. Atención Ciudadana en el Principado de Asturias</li>
                  <li>18. La documentación administrativa</li>
                  <li>19. Protección de datos y transparencia</li>
                  <li>20. Igualdad y discapacidad</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-purple-500">
                <p className="text-xs text-gray-500 mb-1">5 temas (21-25)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Ofimática</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>21. Sistema operativo Windows</li>
                  <li>22. Explorador de Windows</li>
                  <li>23. Procesador de textos Word</li>
                  <li>24. Hoja de cálculo Excel</li>
                  <li>25. Base de datos Access</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-asturias/temario" className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"><span>📚</span><span>Ver Temario Completo</span></Link>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, i) => (<div key={i} className="bg-white rounded-lg p-6 shadow-md"><h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3><p className="text-gray-600">{faq.respuesta}</p></div>))}
            </div>
          </section>

          <section className="bg-green-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-green-100 mb-6 max-w-xl mx-auto">Prepárate con tests tipo examen y temario oficial actualizado.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-asturias/test" className="bg-white text-green-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">🎯 Empezar Tests</Link>
              <Link href="/auxiliar-administrativo-asturias/temario" className="bg-yellow-500 text-green-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">📚 Ver Temario</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
