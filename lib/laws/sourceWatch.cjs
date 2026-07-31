// lib/laws/sourceWatch.cjs
//
// Vigilancia por HASH de las fuentes legales que el monitor del BOE no cubre. Núcleo puro:
// sin red y sin BD, para poder fijar en tests las tres decisiones que importan. [T-026]
//
// ── POR QUÉ ASÍ, Y POR QUÉ SIN LLM (decisión de Manuel, 31/07/2026) ────────────────────────
//
// 160 leyes reales que sirven 4.893 preguntas quedan fuera del cron `check-boe-changes`, por
// tres exclusiones deliberadas suyas: sin `boe_url`, URL `doc.php` (documento puntual, sin
// texto consolidado) y `scope='eu'`. Para esas no hay página consolidada que consultar, pero
// sí un PDF o un boletín que se puede clonar una vez y comparar después.
//
// **Comparar dos textos es exactamente lo que hace un hash**: determinista, gratis, sin falsos
// positivos ni negativos y sin depender de nadie. Se descartó a propósito meter un modelo en
// este punto: el precedente está medido —el LLM que pre-masticaba documentos de convocatoria
// produjo 6.886 extracciones con CERO triadas (~17 USD) y dejó el cron a merced del saldo del
// proveedor (10 h sin servicio el 26/07)—. El modelo no aporta nada aquí; el juicio sobre QUÉ
// cambió lo pone una sesión de Claude cuando Manuel lo pide, igual que con las señales OEP.
//
// ── LAS DOS TRAMPAS QUE ESTE MÓDULO EVITA ─────────────────────────────────────────────────
//
// 1. **«No he podido descargar» NO es «ha cambiado».** Un boletín caído, un WAF o un TLS roto
//    dan texto vacío; tratarlo como cambio llenaría el panel de avisos falsos y en dos semanas
//    nadie miraría la señal. Son estados DISTINTOS y así se devuelven.
// 2. **Ruido de descarga que no es cambio de la norma.** Dos descargas del mismo PDF pueden
//    diferir en espacios, saltos de página o una fecha de consulta impresa por el servidor. Sin
//    normalizar, el hash cambiaría cada día y la señal sería inútil por el otro lado.

const crypto = require('crypto')

/** Por debajo de esto no es un documento: es un error, una redirección o un WAF. */
const MINIMO_SERVIBLE = 500

// Páginas que responden 200 y NO traen el documento: captcha, WAF, bloqueo por IP, error del
// servidor maquillado. Cazadas el 31/07 con el BORM, que devolvía una pantalla de captcha con
// un «incident id» DISTINTO en cada descarga: 810 caracteres —por encima del mínimo— y hash
// nuevo cada vez, o sea «cambiada» a diario para siempre. Es el mismo fenómeno que el detector
// `seguimiento_fuente_ciega` ya vigila en las convocatorias: un 200 no es contenido.
const FIRMAS_BLOQUEO = [
  /solve this captcha/i,
  /request unblock/i,
  /incident id:/i,
  /access denied/i,
  /attention required/i,
  /cloudflare/i,
  /forbidden/i,
  /su navegador no soporta|javascript.*(habilitad|enabled)/i,
]

/** ¿El texto descargado es una pantalla de bloqueo en vez del documento? */
function pareceBloqueo(texto) {
  const t = String(texto ?? '')
  // Solo se juzga como bloqueo si además es CORTO: un documento legal de verdad puede citar la
  // palabra «forbidden» o hablar de Cloudflare sin dejar de ser el documento.
  if (t.length > 12000) return false
  return FIRMAS_BLOQUEO.some((re) => re.test(t))
}

/**
 * Deja el texto en lo que de verdad identifica a la norma. Conservador a propósito: solo
 * aplasta variabilidad de FORMA (espaciado, mayúsculas, guiones de corte) y marcas de fecha de
 * consulta. No toca el contenido: si una norma cambia una palabra, el hash tiene que cambiar.
 */
function normalizarParaHash(texto) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    // Fechas de consulta/impresión que algunos boletines estampan al servir el documento.
    .replace(/(consultado|descargado|impreso|generado)\s+el\s+\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}[^\n]*/gi, ' ')
    .replace(/\bp[áa]gina\s+\d+\s+de\s+\d+/gi, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .toLowerCase()
    .trim()
}

/** Hash estable del contenido normalizado. */
function hashFuente(texto) {
  return crypto.createHash('sha256').update(normalizarParaHash(texto), 'utf8').digest('hex')
}

/**
 * @param {{hashPrevio?:string|null, textoDescargado?:string|null}} entrada
 * @returns {{estado:'sin_cambio'|'cambiada'|'inaccesible'|'linea_base', hash:string|null, motivo:string}}
 */
function clasificarVigilancia({ hashPrevio, textoDescargado }) {
  const texto = String(textoDescargado ?? '')
  if (pareceBloqueo(texto)) {
    // Un captcha NO es un cambio de la norma. Si se repite, el problema es de acceso (toca
    // fetcher headless, como ya hace `generic_source_checks.fetcher_type`), no de contenido.
    return { estado: 'inaccesible', hash: null, motivo: 'la fuente devolvió una pantalla de bloqueo/captcha, no el documento' }
  }
  if (texto.trim().length < MINIMO_SERVIBLE) {
    // Ojo: inaccesible NO es cambio. Repetido en el tiempo sí es un problema (la fuente se
    // movió o nos bloquean), pero eso lo decide quien acumula, no esta función.
    return { estado: 'inaccesible', hash: null, motivo: `descarga vacía o demasiado corta (<${MINIMO_SERVIBLE} chars)` }
  }
  const hash = hashFuente(texto)
  if (!hashPrevio) {
    return { estado: 'linea_base', hash, motivo: 'primera captura: se guarda como referencia, no hay nada con que comparar' }
  }
  if (hash === hashPrevio) return { estado: 'sin_cambio', hash, motivo: 'idéntica a la última captura' }
  return { estado: 'cambiada', hash, motivo: 'el contenido de la fuente oficial ha cambiado desde la última captura' }
}

module.exports = { normalizarParaHash, hashFuente, clasificarVigilancia, pareceBloqueo, MINIMO_SERVIBLE }
