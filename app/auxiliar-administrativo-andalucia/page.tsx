// app/auxiliar-administrativo-andalucia/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Junta de Andalucía 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Junta de Andalucía: temario oficial 22 temas, 2 bloques BOJA 2024. Tests gratuitos.',
  keywords: ['auxiliar administrativo andalucia','oposiciones auxiliar andalucia','temario auxiliar andalucia','oposiciones junta andalucia','22 temas auxiliar andalucia'].join(', '),
  authors: [{ name: 'Vence' }], metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Auxiliar Administrativo Junta de Andalucía', description: 'Temario oficial 22 temas en 2 bloques.', url: `${SITE_URL}/auxiliar-administrativo-andalucia`, siteName: 'Vence', locale: 'es_ES', type: 'website' },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-andalucia` },
}

function formatNumber(n: number | null): string { if (n == null) return '—'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function formatDateLarga(dateStr: string | null): string { if (!dateStr) return ''; const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m, d] = dateStr.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}` }
function formatDateCorta(dateStr: string | null): string { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}` }

export default async function AuxiliarAdministrativoAndalucia() {
  const data = await getOposicionLandingData('auxiliar-administrativo-andalucia')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-andalucia')
  const plazasLibres = data?.plazasLibres ?? null
  const temasCount = data?.temasCount ?? 22
  const boeRef = data?.boeReference ?? 'BOJA 2024'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : ''
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null

  const textoExamen = examDate ? `Examen previsto para el ${examDate}` : 'Pendiente de convocatoria'

  const estadisticas = [
    { numero: plazasLibres ? formatNumber(plazasLibres) : "—", texto: "Plazas", color: "text-green-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-blue-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-purple-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]
  const faqs = [
    { pregunta: "¿Cuál es el programa oficial de Auxiliar Administrativo Andalucía?", respuesta: `El programa consta de ${temasCount} temas en 2 bloques según BOJA 2024.` },
    { pregunta: "¿Qué requisitos necesito?", respuesta: `Título de ${tituloRequerido}, nacionalidad española o europea, 16 años cumplidos.` },
  ]
  const schemaFAQ = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(faq => ({ "@type": "Question", "name": faq.pregunta, "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta } })) }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">🏛️ JUNTA DE ANDALUCÍA - GRUPO C2</span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo Junta de Andalucía</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto"><span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">{textoExamen}</span></p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Oposición para la Junta de Andalucía. Temario oficial BOJA 2024.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-andalucia/test" className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"><span className="text-2xl">🎯</span><span>Empezar a Practicar</span></Link>
              <Link href="/auxiliar-administrativo-andalucia/temario" className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-green-300 transition-all"><span className="text-xl">📚</span><span>Ver Temario</span></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, i) => (<div key={i} className="bg-white rounded-lg p-4 shadow-md"><div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div><div className="text-sm text-gray-600">{stat.texto}</div></div>))}
            </div>
            {oepDecreto && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                OEP: {oepDecreto}{oepFecha ? ` (${oepFecha})` : ''}
              </p>
            )}
          </div>
          {(programaUrl || seguimientoUrl) && (<div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">{programaUrl && (<a href={programaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-green-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-green-200 transition-colors">📄</div><div><div className="font-bold text-gray-800 group-hover:text-green-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOJA'}</div></div></a>)}{seguimientoUrl && (<a href={seguimientoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">🔍</div><div><div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Seguimiento del proceso selectivo</div></div></a>)}</div>)}
          {hitos.length > 0 && (<section className="mb-10"><h2 className="text-2xl font-bold text-gray-800 text-center mb-8">📅 Estado del Proceso Selectivo</h2><div className="max-w-3xl mx-auto"><div className="relative"><div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" /><div className="space-y-6">{hitos.map((hito) => (<div key={hito.id} className="relative flex items-start gap-4 md:gap-6"><div className={`relative z-10 flex-shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base ${hito.status === 'completed' ? 'bg-green-100 text-green-600 border-2 border-green-500' : hito.status === 'current' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse' : 'bg-gray-100 text-gray-400 border-2 border-gray-300'}`}>{hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}</div><div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hito.status === 'completed' ? 'bg-green-100 text-green-700' : hito.status === 'current' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{formatDateCorta(hito.fecha)}</span></div><h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>{hito.titulo}</h3>{hito.descripcion && <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>}</div></div>))}</div></div></div></section>)}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 2 bloques</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-green-500">
                <p className="text-xs text-gray-500 mb-1">12 temas (1-12)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque I</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li><li>2. La organización territorial del Estado</li><li>3. El Estatuto de Autonomía para Andalucía</li><li>4. Organización institucional de la Comunidad Autónoma de Andalucía</li><li>5. La Administración de la Junta de Andalucía</li><li>6. El Derecho Administrativo</li><li>7. El procedimiento administrativo común</li><li>8. Igualdad de género</li><li>9. Políticas públicas de igualdad de género en Andalucía</li><li>10. Los presupuestos de la Comunidad Autónoma de Andalucía</li><li>11. La función pública en la Administración de la Junta de Andalucía</li><li>12. El régimen de Seguridad Social del personal al servicio de la Junta de Andalucía</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">10 temas (13-22)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Bloque II</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>13. Comunicación y atención al público</li><li>14. Tratamiento y gestión de la documentación</li><li>15. Los sistemas de información y comunicación</li><li>16. La administración electrónica en la Junta de Andalucía</li><li>17. La contratación administrativa en la Junta de Andalucía</li><li>18. La protección de datos personales</li><li>19. El patrimonio de la Junta de Andalucía</li><li>20. La prevención de riesgos laborales</li><li>21. El sistema de calidad y modernización en la Junta de Andalucía</li><li>22. Las tecnologías de la información: LibreOffice</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6"><Link href="/auxiliar-administrativo-andalucia/temario" className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"><span>📚</span><span>Ver Temario Completo</span></Link></div>
          </section>
          <section className="mb-12"><h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2><div className="max-w-3xl mx-auto space-y-4">{faqs.map((faq, i) => (<div key={i} className="bg-white rounded-lg p-6 shadow-md"><h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3><p className="text-gray-600">{faq.respuesta}</p></div>))}</div></section>
          <section className="bg-green-600 rounded-lg shadow-lg p-6 text-white text-center mb-8"><h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2><p className="text-green-100 mb-6 max-w-xl mx-auto">Prepárate con tests tipo examen y temario oficial actualizado.</p><div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto"><Link href="/auxiliar-administrativo-andalucia/test" className="bg-white text-green-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">🎯 Empezar Tests</Link><Link href="/auxiliar-administrativo-andalucia/temario" className="bg-yellow-500 text-green-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">📚 Ver Temario</Link></div></section>
        </div>
      </div>
    </>
  )
}
