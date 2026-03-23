// app/auxiliar-administrativo-baleares/page.tsx
import Link from 'next/link'
import type { Metadata } from 'next'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import { getOposicionLandingData, getHitosConvocatoria } from '@/lib/api/convocatoria/queries'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
export const revalidate = 86400

export const metadata: Metadata = {
  title: 'Auxiliar Administrativo Illes Balears 2026 | Temario Oficial y Tests',
  description: 'Oposiciones Auxiliar Administrativo Illes Balears: 120 plazas, temario oficial 36 temas, 2 bloques. Requisito catalán B2. Tests gratuitos.',
  keywords: ['auxiliar administrativo baleares','oposiciones auxiliar baleares','temario auxiliar baleares','oposiciones illes balears','36 temas auxiliar baleares','catalan B2'].join(', '),
  authors: [{ name: 'Vence' }], metadataBase: new URL(SITE_URL),
  openGraph: { title: 'Auxiliar Administrativo Illes Balears | 120 Plazas', description: 'Temario oficial 36 temas en 2 bloques. Requisito catalán B2.', url: `${SITE_URL}/auxiliar-administrativo-baleares`, siteName: 'Vence', locale: 'es_ES', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Auxiliar Administrativo Illes Balears', description: '120 plazas. Temario 36 temas. Catalán B2.' },
  alternates: { canonical: `${SITE_URL}/auxiliar-administrativo-baleares` },
}

function formatNumber(n: number | null): string { if (n == null) return '—'; return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') }
function formatDateLarga(dateStr: string | null): string { if (!dateStr) return ''; const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']; const [y, m, d] = dateStr.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}` }
function formatDateCorta(dateStr: string | null): string { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}` }

export default async function AuxiliarAdministrativoBaleares() {
  const data = await getOposicionLandingData('auxiliar-administrativo-baleares')
  const hitos = await getHitosConvocatoria('auxiliar-administrativo-baleares')

  const plazasLibres = data?.plazasLibres ?? 120
  const plazasDiscapacidad = data?.plazasDiscapacidad ?? 8
  const temasCount = data?.temasCount ?? 36
  const boeRef = data?.boeReference ?? 'BOIB num. 29, 24/03/2025'
  const boeFechaLarga = data?.boePublicationDate ? formatDateLarga(data.boePublicationDate) : '24 de marzo de 2025'
  const boeFechaCorta = data?.boePublicationDate ? formatDateCorta(data.boePublicationDate) : '24/03/2025'
  const examDate = data?.examDate ? formatDateLarga(data.examDate) : null
  const programaUrl = data?.programaUrl ?? null
  const seguimientoUrl = data?.seguimientoUrl ?? null
  const tituloRequerido = data?.tituloRequerido ?? 'Graduado en ESO'
  const textoExamen = examDate ? `Examen previsto para el ${examDate}` : 'Fecha de examen pendiente de confirmación'

  const estadisticas = [
    { numero: formatNumber(plazasLibres), texto: "Plazas acceso libre", color: "text-cyan-600" },
    { numero: String(temasCount), texto: "Temas oficiales", color: "text-green-600" },
    { numero: String(data?.bloquesCount ?? 2), texto: "Bloques", color: "text-blue-600" },
    { numero: "B2", texto: "Catalán requerido", color: "text-orange-600" }
  ]

  const faqs = [
    { pregunta: "¿Cuántas plazas hay para Auxiliar Administrativo de las Illes Balears?", respuesta: `Se convocan ${formatNumber(plazasLibres)} plazas de acceso libre (${formatNumber(plazasDiscapacidad)} reservadas para discapacidad).` },
    { pregunta: "¿Cuál es el programa oficial?", respuesta: `El programa consta de ${temasCount} temas en 2 bloques: Materias Comunes (20 temas) y Ofimática (16 temas de Word y Excel).` },
    { pregunta: "¿Qué requisitos necesito para opositar?", respuesta: `Nacionalidad española o europea, tener 16 años cumplidos, título de ${tituloRequerido} o equivalente, certificado de catalán B2, y no estar inhabilitado para funciones públicas.` },
  ]

  const schemaFAQ = { "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs.map(faq => ({ "@type": "Question", "name": faq.pregunta, "acceptedAnswer": { "@type": "Answer", "text": faq.respuesta } })) }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <div className="min-h-screen bg-gray-50">
        <ClientBreadcrumbsWrapper />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-sm font-medium">🏝️ ILLES BALEARS - GRUPO C2</span>
            <h1 className="text-4xl font-bold text-gray-800 mt-4 mb-4">Auxiliar Administrativo Illes Balears</h1>
            <p className="text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
              <span className="inline-block bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full font-bold">Convocatoria publicada - {textoExamen}</span>
            </p>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">Oposición para la CAIB con <strong>{formatNumber(plazasLibres)} plazas de acceso libre</strong>. Requisito: catalán B2.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/auxiliar-administrativo-baleares/test" className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"><span className="text-2xl">🎯</span><span>Empezar a Practicar</span></Link>
              <Link href="/auxiliar-administrativo-baleares/temario" className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-800 px-6 py-4 rounded-xl font-semibold border-2 border-gray-200 hover:border-cyan-300 transition-all"><span className="text-xl">📚</span><span>Ver Temario</span></Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {estadisticas.map((stat, i) => (<div key={i} className="bg-white rounded-lg p-4 shadow-md"><div className={`text-2xl font-bold ${stat.color}`}>{stat.numero}</div><div className="text-sm text-gray-600">{stat.texto}</div></div>))}
            </div>
          </div>

          <div className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-lg shadow-lg p-6 text-white mb-10">
            <h2 className="text-2xl font-bold mb-3">🚀 Convocatoria</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center"><div className="text-2xl font-bold">{formatNumber(plazasLibres)}</div><div className="text-cyan-100 text-sm">Plazas libres</div></div>
              <div className="text-center"><div className="text-2xl font-bold">{temasCount}</div><div className="text-cyan-100 text-sm">Temas</div></div>
              <div className="text-center"><div className="text-2xl font-bold">C2</div><div className="text-cyan-100 text-sm">Grupo</div></div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-4">
              <h3 className="font-bold mb-2">📋 {boeRef} ({boeFechaLarga})</h3>
              <p className="text-cyan-100 text-sm">{textoExamen}.</p>
            </div>
          </div>

          {(programaUrl || seguimientoUrl) && (
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto mb-10">
              {programaUrl && (<a href={programaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg hover:border-cyan-300 transition-all group"><div className="flex-shrink-0 w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center text-2xl group-hover:bg-cyan-200 transition-colors">📄</div><div><div className="font-bold text-gray-800 group-hover:text-cyan-700 transition-colors">Ver convocatoria en {data?.diarioOficial ?? 'BOIB'}</div><div className="text-sm text-gray-500">{boeFechaCorta}</div></div></a>)}
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
                      <h3 className={`font-semibold ${hito.status === 'upcoming' ? 'text-gray-500' : 'text-gray-800'}`}>{hito.url ? <a href={hito.url} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-600 hover:underline transition-colors">{hito.titulo}</a> : hito.titulo}</h3>
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
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-cyan-500">
                <p className="text-xs text-gray-500 mb-1">20 temas (1-20)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Materias Comunes</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>1. CE y Estatuto de Autonomía de las Illes Balears</li>
                  <li>2. Parlamento, Presidente y Gobierno de las Illes Balears</li>
                  <li>3. Régimen Jurídico del Sector Público y organización administrativa</li>
                  <li>4. Fuentes del derecho y jerarquía normativa</li>
                  <li>5. Procedimiento Administrativo Común (I)</li>
                  <li>6. Procedimiento Administrativo Común (II)</li>
                  <li>7. Procedimiento Administrativo Común (III)</li>
                  <li>8. El Butlletí Oficial de les Illes Balears</li>
                  <li>9. Archivos y gestión documental en la Administración de las Illes Balears</li>
                  <li>10. Relaciones electrónicas con las administraciones públicas y atención a la ciudadanía</li>
                  <li>11. Oficinas de asistencia en materia de registros, registro electrónico y DIR3</li>
                  <li>12. Contratación administrativa: tipos y procedimientos</li>
                  <li>13. Personal funcionario: adquisición de la condición y procesos selectivos</li>
                  <li>14. Derechos, deberes, incompatibilidades y régimen disciplinario de los funcionarios</li>
                  <li>15. Presupuestos generales de las Illes Balears</li>
                  <li>16. Prevención de riesgos laborales en la Administración pública</li>
                  <li>17. Transparencia: publicidad activa y derecho de acceso a la información pública</li>
                  <li>18. Funcionamiento electrónico del sector público, interoperabilidad y plataformas digitales</li>
                  <li>19. Igualdad, no discriminación y prevención de la violencia de género</li>
                  <li>20. Herramientas de administración digital de la CAIB</li>
                </ul>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border-l-4 border-blue-500">
                <p className="text-xs text-gray-500 mb-1">16 temas (21-36)</p>
                <h3 className="text-base font-bold mb-3 text-gray-800">Ofimática: Word y Excel</h3>
                <ul className="space-y-1 text-xs text-gray-600">
                  <li>21. Word: conceptos básicos de edición de texto</li>
                  <li>22. Word: formato de fuente y párrafo, buscar y reemplazar</li>
                  <li>23. Word: estilos</li>
                  <li>24. Word: formato de página, encabezados, pies de página y numeración</li>
                  <li>25. Word: inserción de imágenes y tablas</li>
                  <li>26. Word: tabla de contenidos y notas al pie</li>
                  <li>27. Word: combinación de correspondencia</li>
                  <li>28. Word: corrección ortográfica y comparación de documentos</li>
                  <li>29. Word: formularios con controles de contenido</li>
                  <li>30. Excel: operaciones básicas, gestión de archivos y formato de celdas</li>
                  <li>31. Excel: tablas, gráficos y funciones de filtrado</li>
                  <li>32. Excel: diseño de página e impresión</li>
                  <li>33. Excel: fórmulas y funciones estadísticas</li>
                  <li>34. Excel: ortografía y protección de documentos</li>
                  <li>35. Excel: vistas y zoom</li>
                  <li>36. Excel: tablas dinámicas y análisis de escenarios</li>
                </ul>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/auxiliar-administrativo-baleares/temario" className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"><span>📚</span><span>Ver Temario Completo</span></Link>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-center mb-8">Preguntas Frecuentes</h2>
            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, i) => (<div key={i} className="bg-white rounded-lg p-6 shadow-md"><h3 className="text-lg font-bold mb-3 text-gray-800">{faq.pregunta}</h3><p className="text-gray-600">{faq.respuesta}</p></div>))}
            </div>
          </section>

          <section className="bg-cyan-600 rounded-lg shadow-lg p-6 text-white text-center mb-8">
            <h2 className="text-2xl font-bold mb-3">¿Listo para aprobar tu oposición?</h2>
            <p className="text-cyan-100 mb-6 max-w-xl mx-auto">Prepárate con tests tipo examen y temario oficial actualizado.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-sm mx-auto">
              <Link href="/auxiliar-administrativo-baleares/test" className="bg-white text-cyan-600 px-6 py-2 rounded font-bold hover:bg-gray-100 transition-colors w-full sm:w-auto text-sm">🎯 Empezar Tests</Link>
              <Link href="/auxiliar-administrativo-baleares/temario" className="bg-yellow-500 text-cyan-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition-colors w-full sm:w-auto text-sm">📚 Ver Temario</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
