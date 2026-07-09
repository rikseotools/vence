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
  /**
   * Texto pre-filtrado: una línea por disposición candidata a MODIFICACIÓN DE
   * TEMARIO/PROGRAMA (Ordenes de programas exigibles / materias). Se extrae del
   * MISMO sumario ya descargado, sin fetch extra. Alimenta el sensor
   * `temario_change` (cierra el gap del caso Cantabria PRE/12/2026).
   */
  temarioText: string
}

export interface BoletinAdapter {
  key: string
  regionName: string
  /** sensor_type para la señal — debe estar en el CHECK de oep_detection_signals. */
  sensorType: 'regional_scan' | 'boe_api'
  /**
   * `true` si el boletín NO expone el sumario por fecha (solo "boletín vigente"):
   * el sumario es el mismo para cualquier `date`. El servicio lo escanea UNA sola
   * vez por pasada (no por cada día de la ventana) y confía en el dedup por norma.
   * Patrón "leer lo último + dedup" (igual que bonAdapter en el radar).
   */
  dateless?: boolean
  /** Devuelve candidatos (convocatoria + temario) para esa fecha, o null si no hay boletín. */
  scan(date: Date): Promise<BoletinHit | null>
}

// --- Heurística compartida de pre-filtrado (la limpieza fina la hace el LLM) ---

// Contexto de un proceso selectivo de INGRESO de CUALQUIER cuerpo/grupo.
// Fase 0 "catalogar TODO" (04/07/2026): ya NO se excluye por grupo (A1/A2/B
// entran igual). NOISE_RE solo descarta lo que NO es una convocatoria de
// ingreso (hitos de proceso, laboral, libre designación), nunca por grupo.
const INGRESO_RE = /(proceso selectivo|pruebas selectivas|proceso de selecci[oó]n|concurso-oposici[oó]n|\boposici[oó]n|bolsa de empleo)/i
// Cosas que NUNCA son una convocatoria de ingreso (hitos de proceso, no-oposición).
// OJO: no filtrar por grupo — catedr/cuerpo superior/profesor/subgrupo a1|a2 SE ADMITEN.
const NOISE_RE = /(relaci[oó]n de aspirantes|lista de admitidos|lista provisional|lista definitiva|han superado|nombramiento|adjudicaci[oó]n de plazas|apartamentos|v[ií]as pecuarias|personal laboral|libre designaci[oó]n)/i

/** ¿Esta línea/disposición huele a convocatoria de ingreso C1/C2 (de cualquier cuerpo)? */
export function looksLikeC1C2Convocatoria(text: string): boolean {
  return INGRESO_RE.test(text) && !NOISE_RE.test(text)
}

// --- Heurística de MODIFICACIÓN DE TEMARIO / PROGRAMA (sensor temario_change) ---
//
// Ancla robusta: las Ordenes que definen o modifican el temario de un cuerpo
// hablan de "programas exigibles" / "programa de materias" / "temario". Ej. real
// que se nos escapó: Orden PRE/12/2026 "…por la que se modifica la Orden PRE/76/2024
// …por la que se hacen públicos los PROGRAMAS EXIGIBLES en los procesos selectivos…".
// El pre-filtro es amplio a propósito (recall); el LLM (extractTemarioChanges) afina.
const PROGRAMA_RE =
  /(programas?\s+exigibles|programas?\s+de\s+materias|materias\s+exigibles|relaci[oó]n\s+de\s+materias|cuestionario\s+de\s+materias|temario\s+(?:de|para|del|exigible)|programa\s+de\s+la\s+(?:fase|oposici[oó]n))/i
// Descarta lo que menciona "programa" pero NO es temario de oposición (ej. programas
// de subvenciones/ayudas/formación no reglada).
const PROGRAMA_NOISE_RE =
  /(programa\s+de\s+(?:ayudas|subvenciones|fomento|desarrollo\s+rural|cooperaci[oó]n|inversiones))/i

/** ¿Esta disposición huele a aprobación/modificación del TEMARIO/PROGRAMA de un cuerpo? */
export function looksLikeTemarioChange(text: string): boolean {
  return PROGRAMA_RE.test(text) && !PROGRAMA_NOISE_RE.test(text)
}

/**
 * Extrae de un sumario en texto las disposiciones candidatas a MODIFICACIÓN DE
 * TEMARIO/PROGRAMA. PURA: testeable con fixture. Misma mecánica que
 * extractCandidatesFromSumarioText pero con la heurística de temario.
 */
export function extractTemarioCandidatesFromSumarioText(text: string, maxPerDay = 20): string[] {
  const parts = text.split(DISPOSICION_SPLIT_RE)
  const hits: string[] = []
  for (const p of parts) {
    if (looksLikeTemarioChange(p)) {
      const title = p.slice(0, 300).replace(/\s+(BOCYL|BOE|BOJA|BOCM|BOC)-.*$/i, '').trim()
      if (title) hits.push(title)
    }
    if (hits.length >= maxPerDay) break
  }
  return hits
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
// Lookahead que trocea un sumario en disposiciones. Cubre MAYÚSCULAS (BOE, BOCYL)
// y Title Case (BOJA, BOPA, BOC-Cantabria… "Orden"/"Resolución"). NO matchea el
// "orden" en minúscula de la prosa (cabecera = primera letra mayúscula o todo caps).
// El negative lookbehind evita partir en referencias INTERNAS a otra norma dentro
// del mismo título ("…por la que se modifica la Orden PRE/76/2024…"): así el título
// completo (que puede citar la Orden que modifica) queda en un solo trozo.
const DISPOSICION_SPLIT_RE =
  /(?<!\b(?:la|el|de|del|las|los|una?|dicha|misma|citada|referida|mencionada)\s)(?=Resoluci[óo]n |RESOLUCI[ÓO]N |Orden |ORDEN |Acuerdo |ACUERDO |Decreto |DECRETO |Extracto |EXTRACTO )/

export function extractCandidatesFromSumarioText(text: string, maxPerDay = 40): string[] {
  const parts = text.split(DISPOSICION_SPLIT_RE)
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
    const text = htmlToText(html)
    const candidates = extractCandidatesFromSumarioText(text)
    const temario = extractTemarioCandidatesFromSumarioText(text)
    return {
      url,
      candidatesText: candidates.join('\n'),
      temarioText: temario.join('\n'),
    }
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
    const temario = titulos.filter((t) => looksLikeTemarioChange(t)).map((t) => t.slice(0, 300))
    return {
      url,
      candidatesText: candidates.join('\n'),
      temarioText: temario.join('\n'),
    }
  },
}

export const BOLETIN_ADAPTERS: BoletinAdapter[] = [bocylAdapter, boeAdapter]
