// lib/laws/annulledAudit.ts
//
// Orquestación del audit de "incisos anulados por el TC no marcados" (T-009).
// La LÓGICA PURA de detección vive en `annulledProvisions.ts` (fuente única,
// con tests). Aquí solo va la parte de RED (llamadas a la API datosabiertos del
// BOE) + el pegamento por-ley, para que el endpoint de cron y el runner CLI
// compartan exactamente el mismo criterio.
//
// v1 (rápido): "el TC anuló un artículo que servimos sin nota de vigencia".
// v2 (default): además exige que el BOE RETENGA el inciso anulado en el bloque
//   consolidado (nota inline). Si el artículo se reformó (texto limpio) = falsa
//   alarma → NO se flaguea. Baja el ruido ~4× (medido: 15→4 en 60 leyes).
//
// GOTCHA (ver memoria project-detector-incisos-anulados-tc): la API pide
// `Accept: application/json` en analisis/indice, pero `application/xml` en el
// bloque (el JSON da 400 en bloque). El discriminador DEFINITIVO es a nivel de
// PREGUNTA (¿alguna clave usa el inciso anulado?) → este audit deja el hallazgo
// para revisión HUMANA, nunca auto-corrige la clave.

import {
  extractTcAnnulments,
  assessLawAnnulments,
  boeBlockRetainsAnnulment,
} from './annulledProvisions'

export interface LawToAudit {
  id: string
  short_name: string
  boe_url: string | null
}

export interface AnnulledAuditFinding {
  law: string
  law_id: string
  article: string
  sentencia: string | null
  id_norma: string | null
  texto: string
}

const boeIdFromUrl = (u: string | null): string | null => {
  const m = (u || '').match(/(BOE-A-\d{4}-\d+)/)
  return m ? m[1] : null
}

const normNum = (n: string): string =>
  String(n).replace(/\s+/g, ' ').trim().toLowerCase()

async function fetchAnalisis(boeId: string): Promise<any | null> {
  try {
    const r = await fetch(
      `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/analisis`,
      { headers: { Accept: 'application/json' } },
    )
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function fetchArticleBlockMap(
  boeId: string,
): Promise<Map<string, string> | null> {
  try {
    const r = await fetch(
      `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/indice`,
      { headers: { Accept: 'application/json' } },
    )
    if (!r.ok) return null
    const j = await r.json()
    const map = new Map<string, string>()
    for (const b of j?.data?.[0]?.bloque ?? []) {
      const m = String(b?.titulo || '').match(/art[íi]culo\s+(\d+(?:\s*bis)?)/i)
      if (m && b?.id) map.set(normNum(m[1]), b.id)
    }
    return map
  } catch {
    return null
  }
}

async function fetchBlockText(
  boeId: string,
  blockId: string,
): Promise<string | null> {
  try {
    const r = await fetch(
      `https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/${boeId}/texto/bloque/${blockId}`,
      { headers: { Accept: 'application/xml' } },
    )
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

export interface AuditOneLawResult {
  /** true si la ley tenía análisis BOE (se pudo evaluar). */
  analysed: boolean
  /** true si el BOE registra alguna anulación del TC para esta ley. */
  hasAnnulment: boolean
  findings: AnnulledAuditFinding[]
}

/**
 * Audita UNA ley. `articlesByNumber` es el mapa de los artículos que NOSOTROS
 * servimos (clave = número normalizado, valor = content), que el llamador saca
 * de la BD. La red (BOE) se hace aquí; la decisión, con la lógica pura.
 *
 * `deps` permite inyectar los fetch en tests (por defecto, los reales).
 */
export async function auditOneLaw(
  law: LawToAudit,
  articlesByNumber: Map<string, string>,
  opts: {
    v2?: boolean
    deps?: {
      fetchAnalisis: (boeId: string) => Promise<any | null>
      fetchArticleBlockMap: (boeId: string) => Promise<Map<string, string> | null>
      fetchBlockText: (boeId: string, blockId: string) => Promise<string | null>
    }
  } = {},
): Promise<AuditOneLawResult> {
  const v2 = opts.v2 !== false
  const d = opts.deps ?? { fetchAnalisis, fetchArticleBlockMap, fetchBlockText }

  const boeId = boeIdFromUrl(law.boe_url)
  if (!boeId) return { analysed: false, hasAnnulment: false, findings: [] }

  const analisis = await d.fetchAnalisis(boeId)
  if (!analisis) return { analysed: false, hasAnnulment: false, findings: [] }

  const annuls = extractTcAnnulments(analisis)
  if (!annuls.length)
    return { analysed: true, hasAnnulment: false, findings: [] }

  const candidates = assessLawAnnulments(annuls, articlesByNumber)
  const toFinding = (c: {
    articleNumber: string
    sentencia: string | null
    idNorma: string | null
    texto: string
  }): AnnulledAuditFinding => ({
    law: law.short_name,
    law_id: law.id,
    article: c.articleNumber,
    sentencia: c.sentencia,
    id_norma: c.idNorma,
    texto: c.texto.slice(0, 220),
  })

  if (!v2)
    return { analysed: true, hasAnnulment: true, findings: candidates.map(toFinding) }

  // v2: solo REAL si el BOE retiene el inciso anulado en el bloque consolidado.
  const blockMap = await d.fetchArticleBlockMap(boeId)
  if (!blockMap)
    // Sin índice localizable → conservador: no flaguear (evita ruido).
    return { analysed: true, hasAnnulment: true, findings: [] }

  const findings: AnnulledAuditFinding[] = []
  const blockCache = new Map<string, string | null>()
  for (const c of candidates) {
    const bid = blockMap.get(normNum(c.articleNumber))
    if (!bid) continue
    let block = blockCache.get(bid)
    if (block === undefined) {
      block = await d.fetchBlockText(boeId, bid)
      blockCache.set(bid, block)
    }
    if (!block || !boeBlockRetainsAnnulment(block)) continue // reformado → falsa alarma
    findings.push(toFinding(c))
  }
  return { analysed: true, hasAnnulment: true, findings }
}
