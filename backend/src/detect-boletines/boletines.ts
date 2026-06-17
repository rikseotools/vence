// backend/src/detect-boletines/boletines.ts
//
// Adaptadores de BOLETINES OFICIALES para el sensor `detect-boletines`.
//
// CONTEXTO (17/06/2026): el scraper regional `detect-regional-oeps` (que leía
// las webs institucionales de `detection_sources`) se retiró el 01/06/2026 por
// alto ruido, y dejó sin vigilancia el descubrimiento de convocatorias nuevas
// de cuerpos fuera de catálogo. Caso real: la Escala Administrativa (C1) de la
// Universidad de León se publicó en el BOCYL el 17/06/2026 y NO se detectó —
// porque las webs de universidades son JS y porque no había fuente para ellas.
//
// Este sensor ataca el problema por la fuente FIABLE: el SUMARIO del boletín
// oficial, que es HTML estático (BOCYL, BOJA, BOCM…) o API (BOE) — sin navegador.
// Cada adaptador devuelve, para una fecha, un texto PRE-FILTRADO de candidatos
// de convocatoria que luego afina el filtro LLM (`extractRegionalOeps`).
//
// Funciones PURAS (salvo la llamada `fetch`): testeables con la fixture de HTML.

export interface BoletinHit {
  /** URL del sumario consultado (para trazabilidad en la señal). */
  url: string
  /** Texto pre-filtrado: una línea por disposición candidata a convocatoria C1/C2. */
  candidatesText: string
}

export interface BoletinAdapter {
  key: string
  regionName: string
  /** sensor_type para la señal — debe estar en el CHECK de oep_detection_signals. */
  sensorType: 'regional_scan' | 'boe_api'
  /** Devuelve candidatos de convocatoria para esa fecha, o null si no hay boletín. */
  scan(date: Date): Promise<BoletinHit | null>
}

// --- Heurística compartida de pre-filtrado (la limpieza fina la hace el LLM) ---

const CONVOCA_RE = /(se convoca|convoca proceso selectivo|pruebas selectivas|proceso selectivo para el ingreso|convocatoria del proceso selectivo)/i
const C1C2_RE = /(escala administrativa|escala auxiliar|auxiliar administrativ|cuerpo administrativo|cuerpo de gesti[oó]n|subgrupo c1|subgrupo c2|grupo c\b|t[eé]cnico administrativo|administrativ|subalterno|oficial)/i
// Cosas que NUNCA son una convocatoria de ingreso C1/C2 (resultados, A1/A2, laboral…)
const NOISE_RE = /(relaci[oó]n de aspirantes|lista de admitidos|lista provisional|lista definitiva|han superado|nombramiento|adjudicaci[oó]n de plazas|apartamentos|v[ií]as pecuarias|catedr|cuerpo superior|titulado superior|facultativo superior|personal laboral|libre designaci[oó]n|profesor|investigador|subgrupo a1|subgrupo a2)/i

/** ¿Esta línea/disposición huele a convocatoria de ingreso C1/C2? */
export function looksLikeC1C2Convocatoria(text: string): boolean {
  return CONVOCA_RE.test(text) && C1C2_RE.test(text) && !NOISE_RE.test(text)
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Extrae de un sumario en texto las disposiciones candidatas a convocatoria
 * C1/C2. PURA: se testea con una fixture. Parte por los encabezados de
 * disposición (RESOLUCIÓN/ORDEN/ACUERDO/EXTRACTO) y filtra por heurística.
 */
export function extractCandidatesFromSumarioText(text: string, maxPerDay = 40): string[] {
  const parts = text.split(/(?=RESOLUCI[ÓO]N|ORDEN |ACUERDO |EXTRACTO )/)
  const hits: string[] = []
  for (const p of parts) {
    if (looksLikeC1C2Convocatoria(p)) {
      // recorta a la frase de la disposición (hasta la ref del boletín o 260 chars)
      const title = p.slice(0, 260).replace(/\s+(BOCYL|BOE|BOJA|BOCM)-.*$/i, '').trim()
      if (title) hits.push(title)
    }
    if (hits.length >= maxPerDay) break
  }
  return hits
}

// ============================================================
// BOCYL — Boletín Oficial de Castilla y León (HTML por fecha)
// ============================================================
export const bocylAdapter: BoletinAdapter = {
  key: 'bocyl',
  regionName: 'Castilla y León (BOCYL)',
  sensorType: 'regional_scan',
  async scan(date: Date): Promise<BoletinHit | null> {
    const url = `https://bocyl.jcyl.es/boletin.do?fechaBoletin=${pad(date.getDate())}/${pad(
      date.getMonth() + 1,
    )}/${date.getFullYear()}`
    let html: string
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.status !== 200) return null
      html = await r.text()
    } catch {
      return null
    }
    // Sin sumario real (días sin boletín devuelven una página corta)
    if (html.length < 2000) return null
    const candidates = extractCandidatesFromSumarioText(htmlToText(html))
    return { url, candidatesText: candidates.join('\n') }
  },
}

// ============================================================
// BOE — Boletín Oficial del Estado (API JSON de sumario)
// ============================================================
/** Recorre el JSON del sumario del BOE y devuelve los títulos de disposiciones. */
export function collectBoeTitulos(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const x of node) collectBoeTitulos(x, acc)
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (typeof obj.titulo === 'string') acc.push(obj.titulo)
    for (const k of Object.keys(obj)) collectBoeTitulos(obj[k], acc)
  }
  return acc
}

export const boeAdapter: BoletinAdapter = {
  key: 'boe',
  regionName: 'Estado (BOE)',
  sensorType: 'boe_api',
  async scan(date: Date): Promise<BoletinHit | null> {
    const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    const url = `https://www.boe.es/datosabiertos/api/boe/sumario/${ymd}`
    let json: unknown
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      })
      if (r.status !== 200) return null
      json = await r.json()
    } catch {
      return null
    }
    const titulos = collectBoeTitulos(json)
    const candidates = titulos.filter((t) => looksLikeC1C2Convocatoria(t)).map((t) => t.slice(0, 260))
    return { url, candidatesText: candidates.join('\n') }
  },
}

export const BOLETIN_ADAPTERS: BoletinAdapter[] = [bocylAdapter, boeAdapter]
