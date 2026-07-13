// lib/nav/repasoFallosUrl.ts
//
// Construye la URL del repaso de fallos (/test/repaso-fallos-v2) scopeada a la
// oposición del usuario. PURO → testeable. Usado por el atajo "Practicar mis
// fallos" de la pantalla de resultados (gateado premium por practicidad).
//
// `positionType` (snake_case, p.ej. auxiliar_administrativo_valencia) da scope
// estricto por oposición. Sin él, repaso-fallos-v2 ya se aísla por las leyes
// permitidas del usuario (getAllowedLawIds), así que la URL sigue siendo segura.

export interface RepasoFallosOpts {
  n?: number
  order?: 'recent' | 'most_failed' | 'worst_accuracy' | 'oldest' | 'random'
  days?: number
}

export function buildRepasoFallosUrl(positionType?: string | null, opts?: RepasoFallosOpts): string {
  const p = new URLSearchParams()
  const pt = (positionType || '').trim()
  if (pt) p.set('positionType', pt)
  p.set('n', String(opts?.n ?? 20))
  p.set('order', opts?.order ?? 'recent')
  p.set('days', String(opts?.days ?? 365))
  return `/test/repaso-fallos-v2?${p.toString()}`
}
