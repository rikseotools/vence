// lib/convocatoria/documentoFuente.cjs
// Núcleo COMPARTIDO para trabajar con el DOCUMENTO OFICIAL de una convocatoria:
// descargarlo, convertirlo a texto (HTML o PDF) y comprobar que habla del proceso
// que decimos (anclas).
//
// POR QUÉ EXISTE (27/07/2026): esta lógica vivía suelta dentro de
// `scripts/convocatoria/repuntar-enlace-convocatoria.cjs` (T-134) —el escritor del botón
// oficial de la landing— sin un solo test, aunque es la que decide si una URL "es de verdad
// ese documento". Se extrae para poder fijarla con tests y para que cualquier otro script del
// runtime de frontend la reutilice en vez de escribir su tercera versión.
//
// ⚠️ NO es el clonador. Clonar un documento oficial al hub de provenance YA tiene herramienta
// canónica y es del backend: **`backend/scripts/clonar-documento.ts`** (CAPA 2; lee PDF y HTML,
// renderiza SPAs con la Lambda headless, marca `curado`, escribe por `ensure_convocatoria_documento`
// con `boletin_doc_key`). Si necesitas clonar, usa esa — no escribas otra.
//
// PARIDAD CROSS-RUNTIME: el criterio de "esto no es un documento, es una pared del portal"
// (`esParedDelPortal` en esa herramienta del backend) se replica aquí a propósito, igual que
// el espejo de detectores del sweep: un captcha de 711 caracteres pasaba de sobra un filtro de
// longitud mínima y se clonaba como si fuera la convocatoria (caso real del BORM, 16/07). Si
// se toca uno, se toca el otro.
//
// PURO salvo `descargar()` (única función con red), para que se pueda testear sin salir a
// internet. Consumidor hoy: `repuntar-enlace-convocatoria.cjs`.

const { execFileSync } = require('child_process')

// Mismas cabeceras que el cron de seguimiento: si un WAF nos trata distinto que a él,
// mejor enterarse aquí que en producción.
const CABECERAS = {
  'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0; +https://www.vence.es)',
  Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9',
}

/**
 * Umbral de "esto es un documento y no el cascarón de una SPA".
 * Igual que el del detector de fuentes ciegas: por debajo no hay nada que verificar.
 */
const MIN_CHARS = 600

const MARCA_PDF_ILEGIBLE = '__PDF_NO_LEIDO__'

/** Texto plano del documento: HTML sin etiquetas, o PDF pasado por `pdftotext`. */
function aTexto(buf, contentType) {
  if (/pdf/i.test(contentType || '') || buf.slice(0, 5).toString('latin1') === '%PDF-') {
    try {
      // `-layout` conserva columnas: las bases de un boletín en PDF son tablas con frecuencia.
      return execFileSync('pdftotext', ['-layout', '-', '-'], { input: buf, maxBuffer: 64 * 1024 * 1024 })
        .toString('utf8')
    } catch (e) {
      return `${MARCA_PDF_ILEGIBLE} ${e.message}`
    }
  }
  return buf
    .toString('utf8')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Normaliza para buscar anclas: sin tildes, minúsculas, espacios colapsados. */
const plano = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')

/**
 * ¿El texto menciona las anclas? Comparación insensible a tildes/mayúsculas/espacios.
 * @returns {{encontradas:string[], faltan:string[]}}
 */
function buscarAnclas(texto, anclas) {
  const txt = plano(texto)
  const lista = (anclas || []).filter(Boolean)
  const encontradas = lista.filter((a) => txt.includes(plano(a)))
  return { encontradas, faltan: lista.filter((a) => !encontradas.includes(a)) }
}

/**
 * ¿Esto es una pared del portal disfrazada de documento? Espejo de `esParedDelPortal()` de
 * `backend/scripts/clonar-documento.ts` — mismo criterio en los dos runtimes.
 *
 * **200 no significa documento:** el BORM devolvió una «Radware Captcha Page» con HTTP 200 y
 * 711 caracteres, suficiente para colarse por cualquier filtro de longitud.
 * @returns {string|null} motivo, o null si parece un documento de verdad
 */
function paredDelPortal(texto) {
  const t = String(texto || '').slice(0, 4000).toLowerCase()
  if (/captcha|are you a robot|you are a bot|verifique que no es un robot/.test(t)) return 'captcha / anti-bot'
  if (/acceso denegado|access denied|forbidden|403 error/.test(t)) return 'acceso denegado'
  if (/demasiadas (peticiones|solicitudes)|too many requests|rate limit/.test(t)) return 'rate limit'
  // El chrome de un portal: mucho menú y nada de norma (el DOCM sin /portaldocm/ daba justo esto).
  if (String(texto || '').length < 4000 && /b[úu]squeda avanzada|mapa web|pol[íi]tica de cookies/.test(t)
      && !/resoluci[óo]n|decreto|orden|convoca|plazas/.test(t)) return 'chrome del portal (sin norma)'
  return null
}

/**
 * Dictamen sobre un texto YA descargado. Separado de `descargar()` a propósito: es la parte
 * con criterio (y la que se testea), y así también sirve para documentos que ya tenemos.
 * @returns {{ok:boolean, motivo:string, chars:number, anclasEncontradas:string[], anclasFaltan:string[]}}
 */
function dictaminar(texto, anclas, { status = 200 } = {}) {
  const base = { chars: 0, anclasEncontradas: [], anclasFaltan: anclas || [] }
  if (status !== 200) return { ok: false, motivo: `HTTP ${status}`, ...base }
  if (typeof texto !== 'string') return { ok: false, motivo: 'sin texto', ...base }
  if (texto.startsWith(MARCA_PDF_ILEGIBLE)) {
    return { ok: false, motivo: `PDF ilegible (${texto.slice(MARCA_PDF_ILEGIBLE.length + 1, 90)})`, ...base }
  }
  if (texto.length < MIN_CHARS) {
    return { ok: false, motivo: `solo ${texto.length} chars de texto (¿shell de SPA o página vacía?)`, ...base, chars: texto.length }
  }
  const pared = paredDelPortal(texto)
  if (pared) return { ok: false, motivo: `no es el documento: ${pared}`, ...base, chars: texto.length }
  const { encontradas, faltan } = buscarAnclas(texto, anclas)
  if (faltan.length) {
    return { ok: false, motivo: `el documento no menciona: ${faltan.join(', ')}`, chars: texto.length, anclasEncontradas: encontradas, anclasFaltan: faltan }
  }
  return {
    ok: true,
    motivo: encontradas.length ? `documento legible y menciona ${encontradas.length}/${encontradas.length} anclas` : 'documento legible (sin anclas exigidas)',
    chars: texto.length,
    anclasEncontradas: encontradas,
    anclasFaltan: [],
  }
}

/** Única función con red. Nunca lanza: devuelve el error en el resultado. */
async function descargar(url, { timeoutMs = 45000 } = {}) {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: CABECERAS, signal: ctrl.signal, redirect: 'follow' })
    const buf = Buffer.from(await res.arrayBuffer())
    return { status: res.status, tipo: res.headers.get('content-type') || '', buf, error: null }
  } catch (e) {
    return { status: 0, tipo: '', buf: Buffer.alloc(0), error: e.message }
  } finally {
    clearTimeout(to)
  }
}

/**
 * Descarga + dictamen en un paso (lo que usan los scripts).
 * @returns {{ok:boolean, motivo:string, status:number, chars:number, texto:string,
 *            anclasEncontradas:string[], anclasFaltan:string[]}}
 */
async function verificar(url, anclas, opts) {
  const r = await descargar(url, opts)
  if (r.error) {
    return { ok: false, motivo: `no responde (${r.error})`, status: 0, chars: 0, texto: '', anclasEncontradas: [], anclasFaltan: anclas || [] }
  }
  const texto = r.status === 200 ? aTexto(r.buf, r.tipo) : ''
  const d = dictaminar(texto, anclas, { status: r.status })
  return { ...d, status: r.status, texto }
}

module.exports = { aTexto, plano, buscarAnclas, paredDelPortal, dictaminar, descargar, verificar, CABECERAS, MIN_CHARS, MARCA_PDF_ILEGIBLE }
