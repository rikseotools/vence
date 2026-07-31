'use strict'
/**
 * atajoCoherencia.js — NÚCLEO PURO: ¿el banco se contradice a sí mismo sobre un atajo de teclado?
 *
 * ## Por qué existe (T-354, 30/07/2026)
 *
 * El 30/07 el banco servía a la vez `Ctrl+Alt+O` (pregunta `987f0ad1`, examen OFICIAL, 242
 * exposiciones) y `Ctrl+Alt+F` (`1ee365af`) como atajo de «insertar nota al pie». Las dos activas.
 * Nadie lo vio, y no porque faltara rigor: **ningún detector busca contradicciones INTERNAS**. Todos
 * comparan una pregunta contra su fuente, y si la fuente también está mal —que era el caso, 6
 * artículos con el set de atajos inglés— el veredicto sale limpio. Costó retirar dos preguntas
 * CORRECTAS por creer al temario.
 *
 * La idea de este núcleo es que **no necesita saber cuál es la verdad**. Solo señala que no puede
 * haber dos. Es determinista, no consulta fuentes y no opina: por eso es barato y por eso no se
 * equivoca en la dirección peligrosa (no "corrige" nada).
 *
 * ## Bandas — por qué no todo desacuerdo es un defecto
 *
 * `Word 365` (común) y `Word 365 Escritorio` son contenedores DISTINTOS a propósito: el segundo
 * guarda lo que no existe en Office para la Web, donde varios atajos cambian. Así que una
 * divergencia entre hermanos puede ser legítima y la juzga una persona. Lo que no admite defensa es
 * la contradicción DENTRO de un mismo artículo o entre dos preguntas del mismo contenedor.
 *
 *   · `interna`   — el mismo texto se contradice a sí mismo. Certeza total, no hay nada que valorar.
 *   · `contenedor`— dos fuentes del MISMO contenedor discrepan. Defecto salvo prueba en contrario.
 *   · `familia`   — discrepan contenedores hermanos de la misma app (común vs Escritorio vs versión
 *                   anterior). Cola de revisión: puede ser una diferencia real de versión o soporte.
 */

/**
 * Acciones que interesan: las que Microsoft LOCALIZA (donde se cuela el set inglés) + las notas.
 *
 * **Los patrones van ANCLADOS al principio del texto limpio, y no es un detalle.** La primera
 * versión los buscaba en cualquier posición y la medición fue inservible: «abrir» juntaba en un solo
 * hallazgo *Abrir el Explorador*, *Abrir Cortana*, *Abrir Configuración* y *Abrir un documento* —
 * 30 teclas «contradiciéndose» sin que ninguna estuviera mal. Una acción es lo que la celda o la
 * frase AFIRMA, no una palabra que aparece por ahí.
 */
const ACCIONES = [
  ['guardar_como', /^(?:guardar como)\b/i],
  ['guardar', /^(?:guardar)\b(?!\s+como)/i],
  ['nuevo', /^(?:(?:crear\s+)?(?:un\s+|una\s+)?(?:documento|libro|presentaci[oó]n|archivo|elemento|mensaje)\s+nuev[oa]|nuev[oa]\s+(?:documento|libro|presentaci[oó]n|archivo|elemento|mensaje))\b/i],
  ['abrir_documento', /^(?:abrir)(?:\s+(?:un|el|una|la))?\s+(?:documento|libro|presentaci[oó]n|base de datos)\b/i],
  ['imprimir', /^(?:imprimir)\b/i],
  ['negrita', /^(?:(?:aplicar|poner|activar)\s+)?(?:formato\s+)?negrita\b/i],
  ['cursiva', /^(?:(?:aplicar|poner|activar)\s+)?(?:formato\s+)?cursiva\b/i],
  ['subrayado', /^(?:(?:aplicar|poner|activar)\s+)?(?:formato\s+)?subray/i],
  ['buscar', /^(?:buscar)\b(?!\s+y\s+reemplazar)(?!\s+equipos)(?!\s+en\s+la\s+red)/i],
  ['reemplazar', /^(?:reemplazar|buscar y reemplazar)\b/i],
  ['seleccionar_todo', /^(?:seleccionar todo)\b/i],
  ['nota_al_pie', /^(?:insertar\s+(?:una\s+)?)?nota\s+(?:al\s+|a\s+)?pie\b/i],
  ['nota_al_final', /^(?:insertar\s+(?:una\s+)?)?nota\s+al\s+final\b/i],
  ['hipervinculo', /^(?:insertar\s+(?:un\s+)?)?hiperv[ií]nculo\b/i],
  ['centrar', /^(?:centrar)\b/i],
  ['justificar', /^(?:justificar)\b/i],
  ['deshacer', /^(?:deshacer)\b/i],
  ['rehacer', /^(?:rehacer)\b/i],
]

/** Quita el ruido de markdown y de viñeta para que el ancla del patrón caiga sobre la acción. */
function limpiar(s) {
  return String(s || '')
    .replace(/[*`_>]/g, '')
    .replace(/^\s*(?:[-–•]|\d+\.)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Una línea que ADEMÁS de afirmar, CONTRASTA con el inglés («en inglés Ctrl+S», «Bold = Ctrl+B»)
 * no es un defecto: es justo la buena práctica. Sin esta guarda, los artículos bien escritos
 * —PowerPoint 2016, LibreOffice Calc, Procesadores texto CyL— serían los que más ruido darían.
 */
const CONTRASTE_EN = /\b(?:en ingl[eé]s|versi[oó]n ingl[eé]sa?|ingl[eé]sa?\)|footnote|endnote|\bbold\b|\bitalic\b|\bsave\b|\ball\b\)|\bopen\b|\bprint\b|\bfind\b|traducida)\b/i

const MOD = { control: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', mayus: 'Mayús', 'mayús': 'Mayús', shift: 'Mayús', win: 'Win', windows: 'Win', cmd: 'Cmd' }
const ORDEN = { Ctrl: 0, Alt: 1, Mayús: 2, Win: 3, Cmd: 4 }

const TECLA_RE = /\b((?:(?:ctrl|control|alt|may[uú]s|shift|win(?:dows)?|cmd)\s*\+\s*){1,3}(?:f[0-9]{1,2}|barra espaciadora|intro|supr|tab|inicio|fin|[a-z0-9]|[<>+\-]))/gi

/**
 * Canoniza una combinación para que `Alt+Ctrl+O`, `CTRL + ALT + o` y `Control+Alt+O` sean la MISMA.
 * Sin esto el detector inventaría contradicciones donde solo hay estilo de escritura.
 */
function normalizarTecla(raw) {
  const partes = String(raw).split('+').map((p) => p.trim().toLowerCase()).filter(Boolean)
  if (!partes.length) return null
  const mods = []
  let base = null
  for (const p of partes) {
    if (MOD[p]) { if (!mods.includes(MOD[p])) mods.push(MOD[p]) }
    else base = p
  }
  if (!base || !mods.length) return null
  mods.sort((a, b) => ORDEN[a] - ORDEN[b])
  const b = /^f[0-9]{1,2}$/.test(base) ? base.toUpperCase()
    : base.length === 1 ? base.toUpperCase()
    : base.charAt(0).toUpperCase() + base.slice(1)
  return mods.join('+') + '+' + b
}

/**
 * ¿Es un atajo COMPARABLE a efectos de localización? Solo los de **letra**.
 *
 * Microsoft localiza las mnemotecnias (Guardar→**G**, sEleccionar→**E**, n**O**ta), y ahí es donde
 * se cuela el set inglés. Las teclas de función NO se traducen, así que `Mayús+F12` (Guardar) y
 * `Ctrl+G` (Guardar) son **alias legítimos de la misma acción**, no una contradicción: mezclarlos
 * llenaba el informe de falsos positivos. Fuera del alcance también `Intro`, `Supr` o `Tab`.
 */
function esComparable(tecla) {
  return typeof tecla === 'string' && /\+[A-Z]$/.test(tecla)
}

/** Separa una fila de tabla markdown en celdas; devuelve null si no lo es. */
function celdas(linea) {
  const t = linea.trim()
  if (!t.startsWith('|')) return null
  const c = t.split('|').map((x) => x.trim()).filter((x) => x !== '')
  return c.length >= 2 ? c : null
}

/**
 * Un complemento puede cambiar la acción entera: «Subrayado **doble**», «Guardar el **registro**
 * actual», «Buscar el siguiente **error** gramatical». Si se dan por la misma acción, el detector
 * inventa contradicciones entre atajos que hacen cosas distintas — fue el segundo foco de ruido de
 * la primera medición.
 */
const MATIZA = /\b(?:doble|palabras|registro|registros|error|errores|siguiente|anterior|parcial|todos los|celda|celdas|control|hoja)\b/i

function accionesDe(texto) {
  const t = limpiar(texto)
  const out = []
  for (const [id, re] of ACCIONES) {
    const m = re.exec(t)
    if (!m) continue
    const resto = t.slice(m[0].length).trim()
    // el complemento tiene que ser corto y no cambiar de qué se habla
    if (resto.split(/\s+/).filter(Boolean).length > 4 || MATIZA.test(resto)) continue
    out.push(id)
  }
  // «Guardar como» satisface también el ancla de «guardar»; manda el más específico.
  if (out.includes('guardar_como')) return ['guardar_como']
  if (out.includes('nota_al_final')) return ['nota_al_final']
  return out
}

function teclasDe(texto) {
  const out = []
  let m
  TECLA_RE.lastIndex = 0
  while ((m = TECLA_RE.exec(texto)) !== null) {
    const n = normalizarTecla(m[1])
    if (n && esComparable(n) && !out.includes(n)) out.push(n)
  }
  return out
}

/**
 * Extrae pares (acción, tecla) afirmados por un texto. Solo emite cuando la atribución es
 * INEQUÍVOCA: una fila de tabla con su celda de tecla y su celda de acción, o una línea con
 * exactamente una tecla y una acción. Ante la duda NO emite — un detector de contradicciones que
 * inventa pares se contradice a sí mismo.
 */
function extraerAtajos(texto) {
  const out = []
  for (const linea of String(texto || '').split('\n')) {
    if (!linea.trim() || CONTRASTE_EN.test(linea)) continue
    const cs = celdas(linea)
    if (cs) {
      const conTecla = cs.map((c) => ({ c, t: teclasDe(c) })).filter((x) => x.t.length === 1)
      const conAccion = cs.map((c) => ({ c, a: accionesDe(c) })).filter((x) => x.a.length === 1 && teclasDe(x.c).length === 0)
      if (conTecla.length === 1 && conAccion.length === 1) out.push({ accion: conAccion[0].a[0], tecla: conTecla[0].t[0], linea: linea.trim() })
      continue
    }
    const t = teclasDe(linea)
    const a = accionesDe(linea)
    if (t.length === 1 && a.length === 1) out.push({ accion: a[0], tecla: t[0], linea: linea.trim() })
  }
  return out
}

/**
 * Agrupa afirmaciones y devuelve las contradicciones. Cada item de entrada:
 *   { accion, tecla, familia, contenedor, fuente, ref }
 * `fuente` es solo para el informe (de dónde salió); `ref` identifica el texto concreto (id de
 * artículo o de pregunta) y es lo que decide la banda `interna`.
 */
function contradicciones(items) {
  const porClave = new Map()
  for (const it of items) {
    const k = it.familia + '§' + it.accion
    if (!porClave.has(k)) porClave.set(k, [])
    porClave.get(k).push(it)
  }
  const out = []
  for (const [k, lista] of porClave) {
    const teclas = [...new Set(lista.map((x) => x.tecla))]
    if (teclas.length < 2) continue
    const [familia, accion] = k.split('§')
    // banda: la más grave que aplique
    const porRef = new Map()
    for (const x of lista) {
      if (!porRef.has(x.ref)) porRef.set(x.ref, new Set())
      porRef.get(x.ref).add(x.tecla)
    }
    const interna = [...porRef.values()].some((s) => s.size > 1)
    const contenedores = [...new Set(lista.map((x) => x.contenedor))]
    const banda = interna ? 'interna' : contenedores.length === 1 ? 'contenedor' : 'familia'
    out.push({ familia, accion, banda, teclas, afirmaciones: lista })
  }
  const peso = { interna: 0, contenedor: 1, familia: 2 }
  return out.sort((a, b) => peso[a.banda] - peso[b.banda] || b.afirmaciones.length - a.afirmaciones.length)
}

module.exports = { extraerAtajos, normalizarTecla, esComparable, contradicciones, ACCIONES, CONTRASTE_EN }
