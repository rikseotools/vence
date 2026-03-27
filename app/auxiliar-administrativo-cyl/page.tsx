// app/auxiliar-administrativo-cyl/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Castilla y León 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Junta de Castilla y León: 362 plazas, temario oficial 28 temas, 2 bloques. Tests gratuitos.',
  keywords: ['auxiliar administrativo castilla y leon','oposiciones auxiliar cyl','temario auxiliar cyl','oposiciones junta castilla leon','28 temas auxiliar cyl'].join(', '),
  authors: [{ name: 'Vence' }], metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Auxiliar Administrativo Castilla y León | 362 Plazas', description: 'Temario oficial 28 temas.', url: `${SITE_URL}/auxiliar-administrativo-cyl`, siteName: 'Vence', locale: 'es_ES', type: 'website' },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-cyl` },
}

function formatNumber(n: number | null): string { if (n == null) return '—'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function formatDateLarga(dateStr: string | null): string { if (!dateStr) return ''; const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m, d] = dateStr.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}` }
function formatDateCorta(dateStr: string | null): string { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}` }

export default async function AuxiliarAdministrativoCyl() {
  const data = await getOposicionLandingData('auxiliar-administrativo-cyl')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-cyl')
  const plazasLibres = data?.plazasLibres ?? 362
  const temasCount = data?.temasCount ?? 28
  const boeRef = data?.boeReference ?? 'BOCYL 13/01/2026'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '13/01/2026'
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO o equivalente'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const oepDecreto = data?.oepDecreto ?? null
  const oepFecha = data?.oepFecha ? formatDateLarga(data.oepFecha) : null

  const textoExamen = examDate ? `Examen previsto para el ${examDate}` : 'Fecha de examen pendiente de confirmación'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas convocadas", color: "text-violet-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-blue-600" },
    { numero: "ESO", texto: "Título requerido", color: "text-orange-600" }
  ]
  const faqs = [
    { pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de CyL?", respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas.` },
    { pregunta: "¿Cuál es el programa oficial?", respuesta: `El programa consta de ${temasCount} temas en 2 grupos temáticos.` },
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
            <span className="bg-violet-100 text-violet-800 px-3 py-1 rounded-full text-sm font-medium">🏛️ JUNTA DE CASTILLA Y LEÓN - GRUPO C2</span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo de Castilla y León</h1>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Oposición para la Junta de CyL con <strong>{formatNumber(plazasLibres)} plazas convocadas</strong>.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-cyl/test" className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"><span className="text-2xl">🎯</span><span>Empezar a Practicar</span></Link>
              <Link href="/auxiliar-administrativo-cyl/temario" className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-violet-300 transition-all"><span className="text-xl">📚</span><span>Ver Temario</span></Link>
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

          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (<a href={programaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-violet-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-violet-200 transition-colors">📄</div><div><div className="font-bold text-gray-800 group-hover:text-violet-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOCYL'}</div><div className="text-sm text-gray-500">{boeFechaCorta}</div></div></a>)}
              {seguimientoUrl && (<a href={seguimientoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-blue-200 transition-colors">🔍</div><div><div className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Seguimiento del proceso selectivo</div><div className="text-sm text-gray-500">Estado actual, listas y documentos oficiales</div></div></a>)}
            </div>
          )}

          {hitos.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-8">📅 Estado del Proceso Selectivo</h2>
              <div className="max-w-3xl mx-auto"><div className="relative"><div className="absolute left-4 md:left-6 top-0 bottom-0 w-0.5 bg-gray-200" /><div className="space-y-6">
                {hitos.map((hito) => (<div key={hito.id} className="relative flex items-start gap-4 md:gap-6"><div className={`relative z-10 flex-shrink-0 w-9 h-9 md:w-12 md:h-12 rounded-full flex items-center justify-center text-sm md:text-base ${hito.status === 'completed' ? 'bg-green-100 text-green-600 border-2 border-green-500' : hito.status === 'current' ? 'bg-blue-100 text-blue-600 border-2 border-blue-500 animate-pulse' : 'bg-gray-100 text-gray-400 border-2 border-gray-300'}`}>{hito.status === 'completed' ? '✓' : hito.status === 'current' ? '●' : '○'}</div><div className={`flex-1 pb-2 ${hito.status === 'upcoming' ? 'opacity-60' : ''}`}><div className="flex flex-wrap items-center gap-2 mb-1"><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${hito.status === 'completed' ? 'bg-green-100 text-green-700' : hito.status === 'current' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{formatDateCorta(hito.fecha)}</span>{hito.status === 'current' && <span className="text-xs font-bold text-blue-600 uppercase">En curso</span>}</div><h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>{hito.url ? <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-violet-600 hover:underline transition-colors">{hito.titulo}</a> : hito.titulo}</h3>{hito.descripcion && <p className="text-sm text-gray-500 mt-1">{hito.descripcion}</p>}</div></div>))}
              </div></div></div>
            </section>
          )}

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-2">📋 Temario Oficial</h2>
            <p className="text-center text-gray-600 mb-8">{temasCount} temas en 2 grupos</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-violet-500">
                <p className="text-xs text-gray-500 mb-1">19 temas (1-19)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Grupo I</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. La Constitución Española de 1978</li>
                  <li>2. La Administración General del Estado: regulación y estructura</li>
                  <li>3. La Administración local y organización territorial de CyL</li>
                  <li>4. La Unión Europea. Las instituciones europeas</li>
                  <li>5. El Estatuto de Autonomía de Castilla y León</li>
                  <li>6. Las Cortes de Castilla y León</li>
                  <li>7. Instituciones propias de la Comunidad de Castilla y León</li>
                  <li>8. El Gobierno de la Comunidad de Castilla y León</li>
                  <li>9. La Administración de la Comunidad de Castilla y León</li>
                  <li>10. El sector público de la Comunidad de Castilla y León</li>
                  <li>11. Las fuentes del derecho administrativo</li>
                  <li>12. El acto administrativo. Revisión y recursos administrativos</li>
                  <li>13. El procedimiento administrativo común</li>
                  <li>14. Los órganos de las Administraciones Públicas</li>
                  <li>15. El Estatuto Básico del Empleado Público</li>
                  <li>16. La Ley de la Función Pública de Castilla y León</li>
                  <li>17. El derecho de sindicación y de huelga. Régimen de incompatibilidades</li>
                  <li>18. El presupuesto de la Comunidad de Castilla y León</li>
                  <li>19. Políticas de igualdad y no discriminación en Castilla y León</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">9 temas (20-28)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Grupo II</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>20. Derechos de las personas y atención al público</li>
                  <li>21. Oficinas de asistencia en materia de registros de CyL</li>
                  <li>22. La administración electrónica en CyL</li>
                  <li>23. Transparencia y protección de datos</li>
                  <li>24. El documento y archivo administrativo</li>
                  <li>25. Informática básica y Windows 11</li>
                  <li>26. Word y Excel para Microsoft 365</li>
                  <li>27. Correo electrónico e Internet</li>
                  <li>28. Seguridad y salud en el puesto de trabajo</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-cyl/temario" className="inline-flex items-center space-x-2 bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"><span>📚</span><span>Ver Temario Completo</span></Link>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, i) => (<div key={i} className="bg-white rounded-lg p-6 shadow-md"><h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3><p className="text-gray-600">{faq.respuesta}</p></div>))}
            </div>
          </section>

          <section className="bg-violet-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-violet-100 mb-6 max-w-xl mx-auto">Prepárate con tests tipo examen y temario oficial actualizado.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-cyl/test" className="bg-white text-violet-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">🎯 Empezar Tests</Link>
              <Link href="/auxiliar-administrativo-cyl/temario" className="bg-yellow-500 text-violet-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">📚 Ver Temario</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
