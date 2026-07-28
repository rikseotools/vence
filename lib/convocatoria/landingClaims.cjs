'use strict'
// lib/convocatoria/landingClaims.cjs — NÚCLEO PURO (sin red, sin BD) de las AFIRMACIONES
// numéricas que hace la landing de una oposición, y de su contraste contra la fuente.
//
// ## Por qué existe (T-142, 26/07/2026)
//
// La auditoría manual de `policia-nacional` —con el plazo de solicitudes ABIERTO— encontró dos
// defectos que ningún detector veía y que son de la MISMA familia:
//   · una FAQ afirmaba *"psicotécnicos (80 preguntas, 60 min)"* — cifras que **no están en el
//     BOE de la convocatoria**; venían de otra convocatoria y llevaban meses publicadas;
//   · el hero decía *"46 temas del programa"* mientras la FAQ decía *"45 temas"* y el Anexo I
//     tiene 45: **dos superficies de la misma página contándose cosas distintas**.
//
// Ninguno era detectable con lo que había: `landing_incompleta` mira campos VACÍOS, `plaza_card`
// compara una tarjeta contra las columnas de la convocatoria, y nadie contrastaba lo que la
// página AFIRMA contra el documento oficial… teniendo los documentos clonados (medido: 6.414 con
// texto útil en `convocatoria_documentos`, 117 de 123 landings activas con al menos uno).
//
// ## Las dos preguntas que contesta
//
//   1. `verificarAfirmaciones` — ¿cada cifra que la landing afirma aparece en el documento
//      oficial? Es una comprobación de RESPALDO, no de verdad: que un número esté en el documento
//      no prueba que la frase sea correcta, pero que NO esté es una señal fortísima de invención
//      o de copia de otra convocatoria.
//   2. `detectarContradicciones` — ¿dos superficies de la misma página dicen números distintos
//      del mismo hecho? Esto no necesita fuente ninguna: es incoherencia interna, siempre un bug.
//
// ## Calibración (por qué no marca lo que no debe)
//
//   · **Solo se comprueban conceptos verificables** (plazas, preguntas, minutos, temas). El
//     salario NO se comprueba: no está en la convocatoria y marcarlo sería ruido garantizado.
//   · **Los boletines escriben las cifras en LETRA** ("cien preguntas", "cincuenta minutos",
//     "dos mil setecientas cuatro plazas"). Antes de buscar, el texto del documento se normaliza
//     con el núcleo compartido `lib/laws/spanishNumber.js` — el mismo que usa la auditoría de
//     leyes, no una copia. Sin esto, TODA cifra correcta saldría como "sin respaldo".
//   · **Las variantes de formato cuentan como el mismo número**: `2.704`, `2704` y `2 704`.
//   · Si no hay documento con texto, no se opina (`sinDocumento`), nunca se marca a ciegas.

const { spanishTextToNumber } = require('../laws/spanishNumber.js')

// Conceptos cuyas cifras SÍ deben estar en el documento oficial de la convocatoria.
// `re` captura el número en el grupo 1 (o 2 si el patrón lo lleva delante).
const CONCEPTOS = [
  {
    tipo: 'plazas',
    etiqueta: 'plazas convocadas',
    re: /\b([\d][\d.\s]{0,8}\d|\d)\s*plazas\b/gi,
    contexto: /plazas?/gi,
  },
  {
    tipo: 'preguntas',
    etiqueta: 'preguntas del examen',
    re: /\b([\d][\d.\s]{0,5}\d|\d)\s*preguntas\b/gi,
    contexto: /preguntas?/gi,
  },
  {
    tipo: 'minutos',
    etiqueta: 'duración del ejercicio',
    re: /\b([\d][\d.\s]{0,5}\d|\d)\s*(?:minutos|min\b)/gi,
    contexto: /minutos?\b/gi,
  },
  {
    tipo: 'temas',
    etiqueta: 'temas servidos',
    re: /\b([\d][\d.\s]{0,5}\d|\d)\s*temas\b/gi,
    contexto: /temas?\b/gi,
    // Los temas tienen DOS conceptos distintos que se escriben igual y no deben compararse entre
    // sí: los del PROGRAMA OFICIAL (los que exige el boletín) y los que servimos, que pueden ser
    // más si añadimos apoyo (Policía Nacional: 45 del Anexo I + 1 bloque de inglés para el
    // requisito A2). Sin esta distinción, una landing legítima quedaría marcada para siempre —y
    // peor, chocaría con `temas_card`, que exige que la tarjeta cuadre con los topics servidos.
    // Solo lo que la página presenta como OFICIAL se contrasta contra el documento.
    subtipo: {
      re: /oficial|programa|anexo|temario oficial/i,
      tipo: 'temas_programa',
      etiqueta: 'temas del programa oficial',
    },
  },
]

// MATICES: una misma palabra cuenta cosas distintas según lo que la acompañe. Una landing puede
// decir legítimamente "585 plazas totales" y "264 plazas turno libre" en dos tarjetas, o "60
// preguntas del test" y "10 de reserva". Sin esto, el detector de contradicciones marcaba como
// error una página correcta — medido: administrativo-navarra, con sus dos tarjetas buenas.
const MATICES = [
  { re: /turno libre|acceso libre|\blibre\b/i, matiz: 'turno_libre' },
  { re: /promoci[oó]n/i, matiz: 'promocion_interna' },
  { re: /discapacidad/i, matiz: 'discapacidad' },
  { re: /reserva/i, matiz: 'reserva' },
  { re: /totales?\b|en total/i, matiz: 'total' },
]

/** Conceptos que se contrastan contra el documento oficial (el resto son datos nuestros). */
const TIPOS_VERIFICABLES = new Set(['plazas', 'preguntas', 'minutos', 'temas_programa'])

// Ventana alrededor de la palabra-concepto donde se admite el número como respaldo. 90 caracteres
// cubre "un cuestionario de cien preguntas" o "Se convocan 2.704 plazas de alumnos/as" sin abrir
// la puerta a que cualquier cifra suelta del documento valga como prueba.
const VENTANA_CONTEXTO = 90

/** "2.704" | "2 704" | "2704" → 2704. null si no es un entero. */
function aEntero(raw) {
  const limpio = String(raw || '').replace(/[.\s]/g, '')
  if (!/^\d+$/.test(limpio)) return null
  const n = parseInt(limpio, 10)
  return Number.isFinite(n) ? n : null
}

// Palabras que pueden formar un número en español (las que entiende spanishNumber).
const PALABRA_NUM =
  '(?:un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|' +
  'dieci[a-zé]+|veinte|veinti[a-zé]+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|' +
  'cien|ciento|[a-zé]+cientos|[a-zé]+cientas|mil|y)'
const RE_SECUENCIA = new RegExp(`\\b${PALABRA_NUM}(?:\\s+${PALABRA_NUM}){0,5}\\b`, 'gi')

/**
 * Devuelve una copia del texto donde las cifras escritas en LETRA se sustituyen por dígitos.
 * Conserva el original alrededor: solo cambia las secuencias que `spanishTextToNumber` reconoce.
 * @param {string} texto
 * @returns {string}
 */
function normalizarNumerosDelTexto(texto) {
  const t = String(texto || '')
  if (!t) return ''
  return t.replace(RE_SECUENCIA, (match) => {
    const n = spanishTextToNumber(match.trim())
    // El sufijo (bis/ter) no aplica aquí; si viene, no es una cifra suelta.
    if (n === null || /\s/.test(n)) return match
    return ` ${n} `
  })
}

/**
 * Extrae las afirmaciones numéricas de las superficies de una landing.
 * @param {Array<{superficie:string, texto:string}>} superficies  texto visible por superficie
 * @returns {Array<{tipo:string, valor:number, superficie:string, fragmento:string}>}
 */
function extraerAfirmaciones(superficies) {
  const out = []
  for (const s of superficies || []) {
    const texto = String(s && s.texto ? s.texto : '')
    if (!texto) continue
    for (const c of CONCEPTOS) {
      const re = new RegExp(c.re.source, c.re.flags)
      let m
      while ((m = re.exec(texto)) !== null) {
        const valor = aEntero(m[1])
        if (valor === null || valor === 0) continue
        const desde = Math.max(0, m.index - 40)
        const fragmento = texto.slice(desde, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim()
        // El subtipo se decide por el CONTEXTO de la propia frase: "45 temas del programa oficial"
        // no es la misma afirmación que "46 temas".
        const esSub = c.subtipo && c.subtipo.re.test(fragmento)
        const matiz = (MATICES.find((x) => x.re.test(fragmento)) || {}).matiz || null
        out.push({
          tipo: esSub ? c.subtipo.tipo : c.tipo,
          valor,
          superficie: s.superficie,
          matiz,
          fragmento,
        })
      }
    }
  }
  return out
}

/**
 * Sumandos candidatos: cifras que el DOCUMENTO PRESENTA COMO ESE CONCEPTO ("65 preguntas"), no
 * cualquier número cercano.
 *
 * ⚠️ La primera versión cogía todos los números de la ventana de ±90 caracteres y un test lo
 * tumbó enseguida: en un documento con "el artículo 90" y "el plazo de 63 días" cerca de una
 * mención de preguntas, **63 + 90 = 153 "respaldaba" una cifra inventada**. Un falso respaldo es
 * peor que un aviso de más: silencia justo lo que el detector existe para cazar.
 *
 * Con multiplicidad (hasta 2 por valor) porque "65 preguntas psicotécnicas y 65 preguntas del
 * temario" son dos sumandos legítimos de 65. Tope de 40 para acotar la búsqueda, que es O(n³).
 */
function numerosDelConcepto(docNormalizado, conceptoRe) {
  const re = new RegExp(conceptoRe.source, conceptoRe.flags)
  const veces = new Map()
  let m
  while ((m = re.exec(docNormalizado)) !== null) {
    const n = aEntero(m[1])
    if (n === null || n <= 0) continue
    veces.set(n, (veces.get(n) || 0) + 1)
  }
  const out = []
  for (const [n, c] of veces) { out.push(n); if (c > 1) out.push(n) }
  return out.slice(0, 40)
}

/**
 * ¿El valor afirmado se DERIVA de lo que el documento reparte, en vez de estar escrito tal cual?
 *
 * Por qué hace falta (medido 26-27/07): **el boletín casi nunca escribe el total, lo reparte**.
 * `subalterno-parlamento-andalucia` anuncia "153 preguntas" y su convocatoria dice 65
 * psicotécnicas + 65 del temario + reserva; `oficial-de-gestion-parlamento-de-andalucia` habla
 * de 105 preguntas que son 100 + 5 de reserva; y la Orden 1634/2026 numera del Tema 1 al 47 sin
 * decir "47 temas" en ninguna parte. Las tres landings son CORRECTAS y las tres salían "sin
 * respaldo", que es el ruido que impedía subir el detector al barrido nocturno.
 *
 * Deliberadamente CONSERVADOR — solo dos derivaciones, las dos explicables en una frase:
 *   · SUMA de 2 o 3 cifras del mismo concepto (más sumandos "demuestran" cualquier número).
 *   · CONTEO de la enumeración "Tema N" del documento (para los temas del programa).
 * Cualquier otra cosa se sigue marcando: el respaldo tiene que poder explicarse, no solo cuadrar.
 *
 * @returns {{como:string, detalle:string}|null}
 */
function derivarRespaldo(afirmacion, conceptoRe, docNormalizado) {
  const objetivo = afirmacion.valor

  // (a) Enumeración de temas: "Tema 1 … Tema 47" respalda "47 temas del programa".
  if (afirmacion.tipo === 'temas_programa') {
    const nums = [...String(docNormalizado).matchAll(/\btema\s+(\d{1,3})\b/gi)].map((m) => parseInt(m[1], 10))
    if (nums.length >= 5 && Math.max(...nums) === objetivo) {
      return { como: 'conteo', detalle: `el documento enumera del Tema 1 al Tema ${objetivo} sin escribir el total` }
    }
  }

  // (b) Suma de partes del mismo concepto (ordinarias + reserva, bloque I + bloque II…).
  const nums = numerosDelConcepto(docNormalizado, conceptoRe).filter((n) => n < objetivo)
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === objetivo) {
        return { como: 'suma', detalle: `${nums[i]} + ${nums[j]} = ${objetivo} (el documento reparte, no escribe el total)` }
      }
      for (let k = j + 1; k < nums.length; k++) {
        if (nums[i] + nums[j] + nums[k] === objetivo) {
          return { como: 'suma', detalle: `${nums[i]} + ${nums[j]} + ${nums[k]} = ${objetivo} (el documento reparte, no escribe el total)` }
        }
      }
    }
  }
  return null
}

/**
 * ¿Cada afirmación tiene respaldo en el texto del documento oficial?
 * @param {Array} afirmaciones  salida de extraerAfirmaciones
 * @param {string} textoDocumento  `convocatoria_documentos.extracted_text` (crudo)
 * @returns {{sinDocumento:boolean, respaldadas:Array, sinRespaldo:Array}}
 */
function verificarAfirmaciones(afirmaciones, textoDocumento) {
  const doc = String(textoDocumento || '')
  // Umbral igual al del detector de fuentes ciegas: por debajo no hay documento que consultar.
  if (doc.length < 600) return { sinDocumento: true, respaldadas: [], derivadas: [], sinRespaldo: [], sinBase: [] }
  const normalizado = normalizarNumerosDelTexto(doc)
  // Ventanas de texto alrededor de cada mención del concepto. Buscar el número a secas en un
  // documento de 150.000 caracteres encuentra CUALQUIER cifra pequeña (números de artículo,
  // porcentajes, plazos) y el detector no cazaría nada: medido con el caso real, "80 preguntas"
  // y "60 minutos" —ambos inventados— salían respaldados. El respaldo tiene que ser del concepto,
  // no del documento entero.
  const ventanasPorTipo = new Map()
  for (const c of CONCEPTOS) {
    const re = new RegExp(c.contexto.source, c.contexto.flags)
    const trozos = []
    let m
    while ((m = re.exec(normalizado)) !== null) {
      trozos.push(normalizado.slice(Math.max(0, m.index - VENTANA_CONTEXTO), m.index + VENTANA_CONTEXTO))
    }
    ventanasPorTipo.set(c.tipo, trozos)
    if (c.subtipo) ventanasPorTipo.set(c.subtipo.tipo, trozos)
  }

  const respaldadas = []
  const derivadas = []   // respaldadas por SUMA o CONTEO: correctas, con su explicación
  const sinRespaldo = []
  const sinBase = []
  for (const a of (afirmaciones || []).filter((x) => TIPOS_VERIFICABLES.has(x.tipo))) {
    // Se busca el número en cualquiera de sus formatos, con frontera de dígito a ambos lados
    // (para que 45 no case dentro de 450 ni de 2.045).
    const variantes = [String(a.valor), String(a.valor).replace(/\B(?=(\d{3})+(?!\d))/g, '.')]
    const patron = new RegExp(`(?<!\\d)(?:${variantes.map((v) => v.replace(/\./g, '\\.')).join('|')})(?!\\d)`)
    const ventanas = ventanasPorTipo.get(a.tipo) || []
    // Si el documento NO habla del concepto ni una vez, no es la fuente de esa afirmación y no se
    // opina. Medido sobre las 123 landings: sin esta guarda salían 278 avisos, la mayoría porque
    // el documento clonado era una resolución posterior (lista de admitidos) que ni menciona las
    // plazas. Una bandeja así no la mira nadie — lección T-047.
    if (!ventanas.length) { sinBase.push(a); continue }
    if (ventanas.some((v) => patron.test(v))) { respaldadas.push(a); continue }
    // No está escrita tal cual: puede seguir siendo correcta si el documento la REPARTE.
    const concepto = CONCEPTOS.find((c) => c.tipo === a.tipo || (c.subtipo && c.subtipo.tipo === a.tipo))
    const der = concepto ? derivarRespaldo(a, concepto.re, normalizado) : null
    if (der) { derivadas.push({ ...a, derivacion: der }); continue }
    sinRespaldo.push(a)
  }
  return { sinDocumento: false, respaldadas, derivadas, sinRespaldo, sinBase }
}

// Superficies que hablan del TOTAL. Las FAQ quedan fuera a propósito: enumeran subconjuntos
// ("6 temas de ofimática", "10 preguntas de reserva") y compararlas entre sí da falsos positivos
// en masa — medido: 89 "contradicciones", casi todas de este tipo. El caso real que motivó el
// detector (46 temas en la caja vs 45 en la tarjeta) vive entre superficies de resumen.
const SUPERFICIES_RESUMEN = new Set(['tarjeta_hero', 'temas_count', 'caja_convocatoria', 'hero', 'caja'])

/**
 * Superficies de la misma página que dan números DISTINTOS del mismo concepto.
 * No necesita fuente: es incoherencia interna y siempre es un bug de contenido.
 * @param {Array} afirmaciones  salida de extraerAfirmaciones
 * @returns {Array<{tipo:string, valores:number[], detalle:string}>}
 */
function detectarContradicciones(afirmaciones) {
  const porTipo = new Map()
  for (const a of afirmaciones || []) {
    if (!SUPERFICIES_RESUMEN.has(a.superficie)) continue
    // La clave incluye el MATIZ: "plazas totales" y "plazas turno libre" no son el mismo hecho.
    const clave = `${a.tipo}${a.matiz ? `:${a.matiz}` : ''}`
    if (!porTipo.has(clave)) porTipo.set(clave, [])
    porTipo.get(clave).push(a)
  }
  const out = []
  for (const [clave, lista] of porTipo) {
    const [tipo, matiz] = clave.split(':')
    const valores = [...new Set(lista.map((x) => x.valor))]
    if (valores.length < 2) continue
    const concepto =
      CONCEPTOS.find((c) => c.tipo === tipo) ||
      CONCEPTOS.map((c) => c.subtipo).find((x) => x && x.tipo === tipo)
    const porValor = valores.map((v) => {
      const sup = [...new Set(lista.filter((x) => x.valor === v).map((x) => x.superficie))]
      return `${v} (${sup.join(', ')})`
    })
    out.push({
      tipo,
      matiz: matiz || null,
      valores: valores.sort((a, b) => a - b),
      detalle:
        `${concepto ? concepto.etiqueta : tipo}${matiz ? ` (${matiz.replace('_', ' ')})` : ''}: ` +
        `la página dice ${porValor.join(' y ')}`,
    })
  }
  return out
}

module.exports = {
  derivarRespaldo,
  // Exportada para [T-202]: `sim-plazas-contexto.cjs` necesita saber qué cifras PRESENTA el
  // documento como plazas (no cuáles aparecen sueltas). Es la pieza que separa «la cifra está en
  // el texto» de «el texto la llama plazas», y duplicarla habría sido crear la tercera regla del
  // mismo hecho.
  numerosDelConcepto,
  CONCEPTOS,
  MATICES,
  SUPERFICIES_RESUMEN,
  TIPOS_VERIFICABLES,
  aEntero,
  normalizarNumerosDelTexto,
  extraerAfirmaciones,
  verificarAfirmaciones,
  detectarContradicciones,
}
