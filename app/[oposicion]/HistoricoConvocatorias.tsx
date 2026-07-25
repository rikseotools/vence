// app/[oposicion]/HistoricoConvocatorias.tsx
// Apartado "histórico de convocatorias" de la landing (server component, solo lectura).
// Muestra la evolución año a año (plazas, fechas, plazos, participación) para que Vence
// sea la fuente de datos más completa y verificada de cada oposición → SEO + confianza.
// Cifras de plazas/fechas de `convocatorias`; el AÑO y los decretos de OEP de la ENTIDAD `oep`
// (T-108, vía `resumenHistorico`). Los plazos y ratios se derivan en render. Dato ausente → "—".
import { formatNumber, formatDateCorta } from '@/lib/utils/format'
import { celdaConvocatoria, type HistoricoResumen, type ConvocatoriaHistoricaCalculada } from '@/lib/convocatoria/historico'

interface Props {
  resumen: HistoricoResumen
  oposicionNombre: string
  colors: { badge: string; linkHover: string }
}

/** Formatea un nº de días como "≈ N meses" (o "N días" si <45). null → "—". */
function fmtPlazo(dias: number | null): string {
  if (dias == null) return '—'
  if (dias < 45) return `${dias} días`
  const meses = Math.round(dias / 30)
  return `≈ ${meses} meses`
}

function fmtRatio(r: number | null): string {
  if (r == null) return '—'
  return r >= 10 ? formatNumber(Math.round(r)) : r.toFixed(1)
}

function celdaFecha(iso: string | null): string {
  return iso ? formatDateCorta(iso) : '—'
}

/** Enlace oficial de la convocatoria: programa_url, o el BOE construido desde la referencia. */
function urlConvocatoria(c: ConvocatoriaHistoricaCalculada): string | null {
  if (c.programaUrl) return c.programaUrl
  if (c.boeReference) return `https://www.boe.es/diario_boe/txt.php?id=${c.boeReference}`
  return null
}

export default function HistoricoConvocatorias({ resumen, oposicionNombre, colors }: Props) {
  // El histórico solo aporta comparando años. Con menos de 2 no se pinta.
  if (resumen.totalAños < 2) return null

  const { convocatorias, mediaDiasConvocatoriaAExamen, mediaInscritosPorPlaza } = resumen

  return (
    <section className="mb-10 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
        📊 Histórico de convocatorias
      </h2>
      <p className="text-center text-gray-600 mb-6 max-w-2xl mx-auto text-sm">
        Datos oficiales de las últimas convocatorias de {oposicionNombre}, con sus plazas,
        fechas y plazos reales. Útil para prever cuándo saldrá la próxima y con cuántas plazas.
      </p>

      {/* Medias destacadas (solo las que tengan dato) */}
      {(mediaDiasConvocatoriaAExamen != null || mediaInscritosPorPlaza != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {mediaDiasConvocatoriaAExamen != null && (
            <div className="bg-white rounded-xl shadow-md p-5 text-center border border-gray-100">
              <div className={`text-2xl font-bold ${colors.linkHover}`}>
                {fmtPlazo(Math.round(mediaDiasConvocatoriaAExamen))}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                de media desde la convocatoria hasta el examen
              </div>
            </div>
          )}
          {mediaInscritosPorPlaza != null && (
            <div className="bg-white rounded-xl shadow-md p-5 text-center border border-gray-100">
              <div className={`text-2xl font-bold ${colors.linkHover}`}>
                {fmtRatio(mediaInscritosPorPlaza)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                inscritos por plaza de media (competencia real)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabla por años */}
      <div className="overflow-x-auto rounded-xl shadow-md border border-gray-100 bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 font-semibold">Año</th>
              <th className="px-4 py-3 font-semibold">Plazas libres</th>
              <th className="px-4 py-3 font-semibold">OEP</th>
              <th className="px-4 py-3 font-semibold">Convocatoria</th>
              <th className="px-4 py-3 font-semibold">Examen</th>
              <th className="px-4 py-3 font-semibold">Conv.→examen</th>
              <th className="px-4 py-3 font-semibold">Inscritos</th>
              <th className="px-4 py-3 font-semibold">Insc./plaza</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {convocatorias.map((c: ConvocatoriaHistoricaCalculada) => (
              <tr key={c.añoMostrado} className={c.isCurrent ? 'bg-green-50' : ''}>
                <td className="px-4 py-3 font-bold text-gray-800 whitespace-nowrap">
                  {c.añoMostrado}
                  {c.isCurrent && (
                    <span className="ml-2 text-[10px] font-bold uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full align-middle">
                      Actual
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.plazasLibres != null ? formatNumber(c.plazasLibres) : (c.plazasTotal != null ? formatNumber(c.plazasTotal) : '—')}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {c.oepDecretos.length > 0
                    ? <span title={c.oepFecha ? formatDateCorta(c.oepFecha) : undefined}>{c.oepDecretos.join(', ')}</span>
                    : celdaFecha(c.oepFecha)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                  {(() => {
                    const conv = celdaConvocatoria(c)
                    if (conv.pendiente) return <span className="italic text-gray-400">Pendiente de convocar</span>
                    const url = urlConvocatoria(c)
                    return url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className={`${colors.linkHover} hover:underline`}>
                        {celdaFecha(conv.fecha)}
                      </a>
                    ) : celdaFecha(conv.fecha)
                  })()}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{celdaFecha(c.examDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtPlazo(c.diasConvocatoriaAExamen)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {c.inscritos != null ? formatNumber(c.inscritos) : '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{fmtRatio(c.inscritosPorPlaza)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Fuente: Boletín Oficial del Estado (BOE) y organismos convocantes. «—» = dato no publicado oficialmente.
      </p>
    </section>
  )
}
