// backend/src/detect-boletines/ccaa-boletines.ts
//
// Adapters de TEMARIO por Comunidad Autónoma (sensor `temario_change`).
//
// Cierra el gap del caso Cantabria (Orden PRE/12/2026 en el BOC): ningún sensor
// vigilaba el temario. Aquí montamos 1 config por boletín autonómico. Son
// TEMARIO-ONLY (candidatesText='') para NO duplicar la detección de CONVOCATORIAS,
// competencia de la Capa 1 del radar (en transición). Ambos subsistemas conviven
// sin pisarse.
//
// Cada boletín expone su sumario de forma distinta. La factory soporta 3 estrategias:
//   - sumarioUrl : URL fija del "boletín vigente" (dateless).
//   - buildUrl   : sumario por fecha (date-based, se escanea la ventana de días).
//   - resolveUrl : 2 pasos (portada → enlace al último sumario), dateless.
//
// Patrón general "leer lo último + dedup": las Ordenes de temario son raras; el
// dedup por (boletín, norma) las colapsa aunque el sumario vigente se relea.

import {
  collectBoeTitulos,
  extractTemarioCandidatesFromSumarioText,
  htmlToText,
  looksLikeTemarioChange,
  type BoletinAdapter,
  type BoletinHit,
} from './boletines'

// Chrome UA: el más aceptado por los WAF de los boletines (La Rioja/BOR devuelve
// 403 al UA de Firefox pero 200 a Chrome). Verificado en los 14 boletines.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export interface CcaaBoletinConfig {
  key: string
  regionName: string
  // html: sumario HTML (se trocea por disposición). boe-json: API sumario BOE
  // (campos `titulo` recursivos). json: API de datos abiertos (array de registros;
  // se leen los `titleFields` de cada uno). pdf: sumario PDF (se extrae texto con
  // pdf-parse y se trocea como html).
  format: 'html' | 'boe-json' | 'json' | 'pdf'
  /** Para format='json': campos de cada registro que contienen el título. */
  titleFields?: string[]
  /** Para format='json': clave del array de registros si no es el top-level (p.ej. 'disposiciones'). */
  jsonArrayField?: string
  /** Longitud mínima del cuerpo para considerar que hay sumario (evita páginas de error). */
  minLength?: number
  /** Codificación del boletín (BOPV sirve ISO-8859-1). Default utf-8. */
  encoding?: 'utf-8' | 'latin1'
  // --- Una de estas cuatro estrategias de URL (excluyentes): ---
  /** dateless: URL fija del boletín vigente. */
  sumarioUrl?: string
  /** date-based: construye la URL del sumario para una fecha. */
  buildUrl?: (date: Date) => string
  /** date-based multi-fichero: varias URLs por fecha (p.ej. secciones del DOG) → se concatenan. */
  buildUrls?: (date: Date) => string[]
  /** 2 pasos: resuelve la URL del último sumario (p.ej. leer portada y extraer enlace). */
  resolveUrl?: () => Promise<string | null>
}

/**
 * Extrae, de un JSON de datos abiertos, los valores de los `fields` de título.
 * El array de registros puede ser el top-level, o estar bajo `arrayField`
 * (p.ej. DOGV: `{disposiciones:[...]}`) o bajo `result` (CKAN).
 */
export function collectJsonTitles(
  json: unknown,
  fields: string[],
  arrayField?: string,
): string[] {
  const asObj = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  const rows = Array.isArray(json)
    ? json
    : arrayField && asObj && Array.isArray(asObj[arrayField])
      ? (asObj[arrayField] as unknown[])
      : asObj && Array.isArray(asObj.result)
        ? (asObj.result as unknown[])
        : asObj && Array.isArray(asObj.disposiciones)
          ? (asObj.disposiciones as unknown[])
          : []
  const out: string[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    for (const f of fields) {
      if (typeof r[f] === 'string' && r[f]) {
        out.push(r[f] as string)
        break // un título por registro
      }
    }
  }
  return out
}

async function fetchText(
  url: string,
  format: 'html' | 'boe-json' | 'json' | 'pdf',
  encoding: 'utf-8' | 'latin1' = 'utf-8',
): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept:
          format === 'html'
            ? 'text/html,application/xhtml+xml,*/*;q=0.8'
            : 'application/json',
      },
      redirect: 'follow',
    })
    if (r.status !== 200) return null
    if (encoding === 'latin1') {
      const buf = await r.arrayBuffer()
      return new TextDecoder('latin1').decode(buf)
    }
    return await r.text()
  } catch {
    return null // fail-open por boletín
  }
}

/** Descarga un PDF y extrae su texto (pdf-parse). Devuelve null si falla. */
async function fetchPdfText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/pdf' },
      redirect: 'follow',
    })
    if (r.status !== 200) return null
    const buf = Buffer.from(await r.arrayBuffer())
    // Import directo del lib interno para evitar el código de debug del index de pdf-parse.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (b: Buffer) => Promise<{ text: string }>
    const parsed = await pdfParse(buf)
    return parsed.text?.replace(/\s+/g, ' ').trim() ?? null
  } catch {
    return null
  }
}

/** Extrae de la portada de un boletín el primer enlace absoluto que casa `linkRe`. */
export function resolvePortalLink(
  portalUrl: string,
  linkRe: RegExp,
  base: string,
): () => Promise<string | null> {
  return async () => {
    const html = await fetchText(portalUrl, 'html')
    if (!html) return null
    const m = html.match(linkRe)
    if (!m) return null
    const href = m[1] ?? m[0]
    if (href.startsWith('http')) return href
    return base.replace(/\/$/, '') + (href.startsWith('/') ? href : '/' + href)
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const ymdCompact = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
export const ymdDash = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

/**
 * Crea un BoletinAdapter TEMARIO-ONLY a partir de una config de CCAA.
 * PURO salvo el `fetch`; la extracción reusa las funciones testeadas de boletines.ts.
 */
export function makeCcaaTemarioAdapter(cfg: CcaaBoletinConfig): BoletinAdapter {
  return {
    key: cfg.key,
    regionName: cfg.regionName,
    sensorType: 'regional_scan',
    // date-based (buildUrl/buildUrls) se escanea la ventana; el resto son dateless.
    dateless: !cfg.buildUrl && !cfg.buildUrls,
    async scan(date: Date): Promise<BoletinHit | null> {
      // Multi-fichero (DOG por secciones): fetch de todas y concat.
      if (cfg.buildUrls) {
        const urls = cfg.buildUrls(date)
        const bodies = await Promise.all(
          urls.map((u) => fetchText(u, cfg.format, cfg.encoding)),
        )
        const joined = bodies.filter(Boolean).join(' ')
        if (joined.length < (cfg.minLength ?? 2000)) return null
        const temario = extractTemarioCandidatesFromSumarioText(htmlToText(joined))
        return { url: urls[0], candidatesText: '', temarioText: temario.join('\n') }
      }

      const url = cfg.buildUrl
        ? cfg.buildUrl(date)
        : cfg.resolveUrl
          ? await cfg.resolveUrl()
          : cfg.sumarioUrl
      if (!url) return null

      // Sumario en PDF (BORM): descargar binario y extraer texto con pdf-parse.
      if (cfg.format === 'pdf') {
        const text = await fetchPdfText(url)
        if (!text || text.length < (cfg.minLength ?? 500)) return null
        const temario = extractTemarioCandidatesFromSumarioText(text)
        return { url, candidatesText: '', temarioText: temario.join('\n') }
      }

      const body = await fetchText(url, cfg.format, cfg.encoding)
      if (!body || body.length < (cfg.minLength ?? 2000)) return null

      let temario: string[]
      if (cfg.format === 'boe-json' || cfg.format === 'json') {
        let json: unknown
        try {
          json = JSON.parse(body)
        } catch {
          return null
        }
        const titles =
          cfg.format === 'json'
            ? collectJsonTitles(json, cfg.titleFields ?? [], cfg.jsonArrayField)
            : collectBoeTitulos(json)
        temario = titles.filter(looksLikeTemarioChange).map((t) => t.slice(0, 300))
      } else {
        temario = extractTemarioCandidatesFromSumarioText(htmlToText(body))
      }

      return { url, candidatesText: '', temarioText: temario.join('\n') }
    },
  }
}

// ============================================================
// REGISTRO DE BOLETINES CCAA (1 fila por comunidad)
// URLs de sumario vigente VERIFICADAS en vivo (2026-07-08).
// ============================================================
export const CCAA_BOLETINES: CcaaBoletinConfig[] = [
  // --- Grupo A (verificado) ---
  {
    key: 'boja',
    regionName: 'Andalucía (BOJA)',
    format: 'html',
    sumarioUrl: 'https://www.juntadeandalucia.es/BOJA',
  },
  {
    key: 'boa',
    regionName: 'Aragón (BOA)',
    format: 'html',
    // La home boa.aragon.es es SPA Angular → vacía a fetch plano. Endpoint legacy
    // BRSCGI devuelve el sumario del día en HTML plano (date-based con PUBL).
    buildUrl: (d) =>
      `https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VERLST&BASE=BOLE&DOCS=1-200&SEC=SUMARIO&OUTPUTMODE=HTML&SEPARADOR=&&PUBL=${ymdCompact(d)}`,
  },
  {
    key: 'bopa-asturias',
    regionName: 'Asturias (BOPA)',
    format: 'html',
    sumarioUrl:
      'https://miprincipado.asturias.es/es/bopa/ultimos-boletines?p_r_p_summaryLastBopa=true',
  },
  {
    key: 'boib',
    regionName: 'Baleares (BOIB)',
    format: 'html',
    // 2 pasos: portada → enlace al último sumario (id interno, no fecha).
    resolveUrl: resolvePortalLink(
      'https://www.caib.es/eboibfront/ES',
      /href="(\/eboibfront\/ES\/2026\/\d+\/[^"]*)"/i,
      'https://www.caib.es',
    ),
  },
  {
    key: 'boc-canarias',
    regionName: 'Canarias (BOC)',
    format: 'html',
    // Portada lista /boc/YYYY/NNN (sin barra final); el 1º es el sumario del día.
    resolveUrl: resolvePortalLink(
      'https://www.gobiernodecanarias.org/boc/',
      /href="(\/boc\/\d{4}\/\d+)"/i,
      'https://www.gobiernodecanarias.org',
    ),
  },
  {
    key: 'boc-cantabria',
    regionName: 'Cantabria (BOC)',
    format: 'html',
    // CRÍTICO: aquí salió la Orden PRE/12/2026. "Último BOC publicado", directo.
    sumarioUrl: 'https://boc.cantabria.es/boces/boletines.do?boton=UltimoBOCPublicado',
  },

  // --- Grupo B (verificado) ---
  {
    key: 'docm',
    regionName: 'Castilla-La Mancha (DOCM)',
    format: 'html',
    buildUrl: (d) => `https://docm.jccm.es/docm/cambiarBoletin.do?fecha=${ymdCompact(d)}`,
  },
  {
    key: 'doe',
    regionName: 'Extremadura (DOE)',
    format: 'html',
    buildUrl: (d) => `https://doe.juntaex.es/ultimosdoe/mostrardoe.php?fecha=${ymdCompact(d)}&t=o`,
  },
  {
    key: 'dog',
    regionName: 'Galicia (DOG)',
    format: 'html',
    // Sumario partido en ficheros estáticos por sección; I=disposiciones generales,
    // III=otras disposiciones (donde van Ordenes de programas). Concatenamos.
    buildUrls: (d) => {
      const y = d.getUTCFullYear()
      const ymd = ymdCompact(d)
      return [1, 2, 3, 4].map(
        (s) => `https://www.xunta.gal/dog/Publicados/${y}/${ymd}/Secciones${s}_es.html`,
      )
    },
  },
  // La Rioja (BOR) → movido a PENDING: el WAF Liferay de web.larioja.org responde
  // de forma intermitente (200 con disposiciones ↔ 403 con página-reto de ~5.7 KB),
  // no es fiable con fetch plano. Se cubrirá vía headless (Incremento 2b).

  // --- Grupo C (verificado) ---
  {
    key: 'bocm',
    regionName: 'Madrid (BOCM)',
    format: 'html',
    // La home enlaza "Último BOCM" como /boletin/bocm-YYYYMMDD-NNN (solo secciones);
    // lo transformamos al "boletín-completo" que SÍ trae todos los títulos.
    resolveUrl: async () => {
      const home = await fetchText('https://www.bocm.es/', 'html')
      if (!home) return null
      const m = home.match(/bocm-(\d{8})-(\d+)/i)
      if (!m) return null
      return `https://www.bocm.es/boletin-completo/BOCM-${m[1]}/${m[2]}`
    },
  },
  {
    key: 'bopv',
    regionName: 'País Vasco (BOPV)',
    format: 'html',
    encoding: 'latin1', // el BOPV sirve ISO-8859-1
    sumarioUrl: 'https://www.euskadi.eus/y22-bopv/es/bopv2/datos/Ultimo.shtml',
  },
  {
    key: 'bon',
    regionName: 'Navarra (BON)',
    format: 'html',
    sumarioUrl: 'https://bon.navarra.es/es/boletin',
  },
  {
    key: 'bome',
    regionName: 'Melilla (BOME)',
    format: 'html',
    resolveUrl: resolvePortalLink(
      'https://bomemelilla.es/',
      /href="([^"]*\/bome\/BOME-B-\d{4}-\d+)"/i,
      'https://bomemelilla.es',
    ),
  },

  // --- Datos abiertos (SPA resueltas por su API JSON, no scraping) ---
  {
    key: 'dogc',
    regionName: 'Cataluña (DOGC)',
    format: 'json',
    // API SODA/Socrata (Dades Obertes de Catalunya): normativa DOGC al día.
    // Últimas 300 normas por fecha desc; el dedup por norma colapsa relecturas.
    titleFields: ['t_tol_de_la_norma', 't_tol_de_la_norma_es'],
    sumarioUrl:
      'https://analisi.transparenciacatalunya.cat/resource/n6hn-rmy7.json?$order=data_de_publicaci_del_diari%20DESC&$limit=300',
    minLength: 10,
  },
  {
    key: 'dogv',
    regionName: 'C. Valenciana (DOGV)',
    format: 'json',
    // Backend JSON real de la SPA (dogv-portal). Date-based YYYY-MM-DD; `lang` obligatorio.
    // Día sin boletín → {disposiciones:null} (se ignora).
    titleFields: ['titulo'],
    jsonArrayField: 'disposiciones',
    buildUrl: (d) => `https://dogv.gva.es/dogv-portal/dogv?date=${ymdDash(d)}&lang=es`,
    minLength: 10,
  },
  {
    key: 'borm',
    regionName: 'Murcia (BORM)',
    format: 'pdf',
    // El sitio es SPA y el sumario solo se publica en PDF. `/services/boletin/ultimo`
    // (JSON) da el nº del día; con él construimos la URL del PDF del sumario.
    resolveUrl: async () => {
      const meta = await fetchText('https://www.borm.es/services/boletin/ultimo', 'json')
      if (!meta) return null
      try {
        const j = JSON.parse(meta) as { numero?: number; ano?: number }
        if (!j.numero || !j.ano) return null
        return `https://www.borm.es/services/boletin/ano/${j.ano}/numero/${j.numero}/sumario/pdf`
      } catch {
        return null
      }
    },
  },
]

export const CCAA_BOLETIN_ADAPTERS: BoletinAdapter[] =
  CCAA_BOLETINES.map(makeCcaaTemarioAdapter)

// ============================================================
// PENDIENTES (NO son cabos silenciosos — documentados y logueados en cada run).
// Cobertura actual: 16/17 CCAA + Melilla + Estado (BOE). Faltan:
//
//   - La Rioja (BOR): LÍMITE EXTERNO REAL, no una carencia nuestra. Se agotaron
//     todas las vías (08/07/2026): web.larioja.org tiene WAF (403 a fetch plano,
//     a navegador headless —timeout del reto JS—, a los PDF y al RSS);
//     ias1.larioja.org exige login CAS con JavaScript; no hay dataset del BOR en
//     datos.gob.es ni CKAN accesible. Requeriría un feed licenciado/proxy de pago
//     o monitoreo manual. Respaldado por el diseño multi-detector (competitor-diff
//     + feedback-as-sensor cazarían un cambio de temario riojano por otra vía).
//   - Ceuta (BOCCE): ciudad autónoma (no CCAA); sumario PDF vía jdownloads (2 pasos).
// ============================================================
export const CCAA_BOLETINES_PENDING: Array<{ key: string; region: string; motivo: string }> = [
  { key: 'bor', region: 'La Rioja (BOR)', motivo: 'WAF + CAS + sin API abierta (todas las vías agotadas 08/07)' },
  { key: 'bocce', region: 'Ceuta (BOCCE)', motivo: 'ciudad autónoma; sumario PDF vía jdownloads (2 pasos)' },
]
