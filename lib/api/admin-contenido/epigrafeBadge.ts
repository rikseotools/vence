// lib/api/admin-contenido/epigrafeBadge.ts
//
// Helper PURO (sin deps de servidor) para el badge de epígrafe (Sistema 2) en
// /admin/contenido. Vive aparte de queries.ts porque lo consumen tanto el
// query de servidor como el componente cliente y el test — y queries.ts importa
// getDb (Drizzle), que no puede entrar en un client component.

export type EpigrafeTone = 'ok' | 'warn' | 'partial' | 'none'

export interface EpigrafeCounts {
  epi_topics: number
  epi_literal: number
  epi_drift: number
  epi_provisional: number
  epi_stale: number
  epi_never: number
}

/**
 * Estado del epígrafe de una oposición. Semántica:
 *   - none    (—):  ningún tema tiene fuente verificada (todo never_sourced).
 *   - warn    (⚠):  hay drift (texto diverge del oficial) o stale (cambió el
 *                    epígrafe/programa y hay que re-verificar).
 *   - partial:      sin drift/stale pero faltan temas por verificar.
 *   - ok      (✓):  todos los temas activos son verified_literal.
 * provisional (editorial, sin articulado BOE) NO penaliza: cuenta como resuelto
 * a efectos de "faltan por verificar", pero tampoco suma a literal.
 */
export function epigrafeBadge(
  row: EpigrafeCounts,
): { tone: EpigrafeTone; label: string; title: string } {
  const total = row.epi_topics || 0
  const sourced = row.epi_literal + row.epi_drift + row.epi_provisional + row.epi_stale
  if (total === 0 || sourced === 0) {
    return { tone: 'none', label: '—', title: 'Epígrafe sin verificar contra la convocatoria' }
  }
  const base = `${row.epi_literal}/${total} literal`
  const extra = [
    row.epi_drift ? `${row.epi_drift} drift` : '',
    row.epi_stale ? `${row.epi_stale} stale` : '',
    row.epi_provisional ? `${row.epi_provisional} editorial` : '',
    row.epi_never ? `${row.epi_never} sin verificar` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const title = extra ? `${base} · ${extra}` : base
  if (row.epi_drift > 0 || row.epi_stale > 0) {
    return { tone: 'warn', label: `${row.epi_literal}/${total} ⚠`, title }
  }
  if (row.epi_never > 0) {
    return { tone: 'partial', label: `${row.epi_literal}/${total}`, title }
  }
  return { tone: 'ok', label: `${total}/${total} ✓`, title }
}

/** Clases Tailwind por tono (compartidas UI). */
export const EPIGRAFE_TONE_CLS: Record<EpigrafeTone, string> = {
  ok: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  partial: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  none: 'bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400',
}
