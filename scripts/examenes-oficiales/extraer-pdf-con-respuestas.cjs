#!/usr/bin/env node
/**
 * [T-368] Extrae el texto de una plantilla oficial de examen (PDF) marcando en rojo la
 * respuesta correcta — sin `pdftotext`/`pdftoppm`/`magick`, que este entorno NO tiene
 * instalados (medido: `which pdftotext pdftoppm magick` → los tres sin resultado).
 *
 * POR QUÉ HACE FALTA UN DECODIFICADOR PROPIO
 *
 * `docs/maintenance/importar-examen-oficial-completo.md` asume `pdftotext -layout` para
 * leer la plantilla. Sin él, `pdfjs-dist` (ya es dependencia del repo) da el TEXTO plano
 * correctamente, pero pierde toda la información de FORMATO — y el Gobierno de Canarias
 * marca la respuesta correcta con COLOR (rojo/granate), no con un símbolo en el texto. Sin
 * el color, no hay forma de saber cuál es la respuesta correcta desde el PDF mismo.
 *
 * Este script interpreta el content stream del PDF a mano (vía `pdf-lib`, que da acceso a
 * los bytes crudos) seleccionando: fuente activa (`Tf`), color de relleno (`rg`/`g`) y
 * cadenas de texto (`Tj`/`TJ`), y envuelve en `<<...>>` cualquier fragmento pintado en rojo.
 * Sigue los XObject `/Form` (`Do`) porque en las plantillas de Canarias el texto real vive
 * DENTRO de un form, no en el content stream de la página.
 *
 * Decodifica cada fuente vía su propio `/ToUnicode` (bfchar + bfrange), 1 o 2 bytes según
 * declare el `codespacerange` — no asume Identity-H de memoria.
 *
 * VERIFICADO CONTRA LA FUENTE (07/08/2026): en la plantilla del segundo ejercicio C2 LI
 * (08/07/2024), el criterio de color coincide con el título del documento ("preguntas y
 * respuestas correctas") pregunta a pregunta — el rojo cae SIEMPRE en una única opción por
 * pregunta y varía de posición (no es "siempre la primera"), que es justo el patrón que
 * tendría una respuesta marcada de verdad y no un artefacto de maquetación.
 *
 * USO:
 *   node scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs <archivo.pdf> [salida.txt]
 *
 * SOLO LEE el PDF de entrada. No escribe nada salvo el .txt de salida.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { PDFDocument, PDFName, PDFArray, PDFRawStream, PDFHexString, PDFString } = require('pdf-lib')

function inflate(bytes) {
  try {
    return zlib.inflateSync(Buffer.from(bytes))
  } catch {
    return Buffer.from(bytes) // sin comprimir
  }
}

function streamBytes(streamObj) {
  const filter = streamObj.dict.get(PDFName.of('Filter'))
  const raw = Buffer.from(streamObj.contents)
  if (!filter) return raw
  const name = filter instanceof PDFName ? filter.asString() : filter.toString()
  if (name.includes('FlateDecode')) return inflate(raw)
  return raw
}

/** Parsea un CMap /ToUnicode (bfchar + bfrange) → Map<codeString(hex), string unicode>. También
 *  devuelve el nº de bytes por código declarado en el codespacerange (1 o 2). */
function parseToUnicodeCMap(text) {
  const map = new Map()
  let bytesPerCode = 1
  const csr = text.match(/begincodespacerange([\s\S]*?)endcodespacerange/)
  if (csr) {
    const hex = csr[1].match(/<([0-9A-Fa-f]+)>/)
    if (hex) bytesPerCode = hex[1].length / 2
  }
  const hexToStr = (hex) => {
    let out = ''
    for (let i = 0; i < hex.length; i += 4) {
      const cp = parseInt(hex.slice(i, i + 4) || hex.slice(i, i + 2), 16)
      out += String.fromCodePoint(cp)
    }
    return out
  }
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      map.set(m[1].toUpperCase(), hexToStr(m[2]))
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(m[1], 16)
      const hi = parseInt(m[2], 16)
      const dstBase = parseInt(m[3], 16)
      const width = m[1].length
      for (let c = lo; c <= hi; c++) {
        map.set(c.toString(16).toUpperCase().padStart(width, '0'), String.fromCodePoint(dstBase + (c - lo)))
      }
    }
  }
  return { map, bytesPerCode }
}

/** Resuelve los fonts de un dict de Resources → Map<'/F1', {map, bytesPerCode}>. Fuentes sin
 *  ToUnicode (raro en estas plantillas) se dejan sin entrada y sus bytes se pierden — se avisa.
 *
 * ⚠️ TRAMPA (encontrada 07/08/2026 comparando contra una extracción manual verbatim de
 * referencia — sin ese contraste este bug habría publicado un examen mal transcrito):
 * el `codespacerange` que declara el `/ToUnicode` de una fuente **NO** dice cuántos bytes
 * ocupa cada carácter en el content stream — eso lo dice el `Subtype` de la fuente. Una
 * fuente SIMPLE (`/TrueType`, `/Type1`) usa SIEMPRE 1 byte por carácter en el stream, aunque
 * su ToUnicode declare `<0000> <FFFF>` (habitual, y no significa 2 bytes — las herramientas
 * de generación de PDF a menudo declaran ese rango ancho "por si acaso"). Solo una fuente
 * COMPUESTA (`/Type0`) usa el ancho que de verdad declara su CMap (típicamente 2 bytes,
 * Identity-H). Confiar en el codespacerange para fuentes simples partía cada carácter en dos
 * y perdía la mitad del texto («CUERPO AUXILIAR» → «UEO AUXIAR»), un error MUY difícil de ver
 * a simple vista si no se contrasta letra a letra contra otra extracción independiente.
 */
function resolveFonts(ctx, resourcesDict) {
  const fonts = new Map()
  if (!resourcesDict) return fonts
  const fontDict = resourcesDict.lookup(PDFName.of('Font'))
  if (!fontDict) return fonts
  for (const key of fontDict.keys()) {
    const fontRef = fontDict.get(key)
    const fontObj = ctx.lookup(fontRef)
    if (!fontObj || !fontObj.get) continue
    const toUniRef = fontObj.get(PDFName.of('ToUnicode'))
    if (!toUniRef) { fonts.set(key.asString(), null); continue }
    const toUniStream = ctx.lookup(toUniRef)
    const decoded = streamBytes(toUniStream).toString('latin1')
    const parsed = parseToUnicodeCMap(decoded)
    const subtype = fontObj.get(PDFName.of('Subtype'))
    const isComposite = subtype && subtype.asString() === '/Type0'
    if (!isComposite) parsed.bytesPerCode = 1
    fonts.set(key.asString(), parsed)
  }
  return fonts
}

function decodeShowTextArg(raw, font) {
  // raw: PDFHexString | PDFString (de pdf-lib), o buffer crudo ya extraído a mano
  const isHex = raw instanceof PDFHexString
  const bytes = isHex
    ? Buffer.from(raw.asBytes())
    : Buffer.from(raw.asBytes ? raw.asBytes() : raw, 'latin1')
  if (!font) return bytes.toString('latin1') // sin ToUnicode: mejor esfuerzo, puede salir basura
  const { map, bytesPerCode } = font
  let out = ''
  for (let i = 0; i + bytesPerCode <= bytes.length; i += bytesPerCode) {
    const code = bytes.subarray(i, i + bytesPerCode).toString('hex').toUpperCase()
    out += map.get(code) ?? '�'
  }
  return out
}

function isRed([r, g, b]) {
  return r > 0.5 && g < 0.5 && b < 0.5
}

/** Interpreta un content stream (bytes ya descomprimidos) usando pdf-lib para el TOKENIZADO
 *  (evita reescribir un lexer PDF a mano) y devuelve el texto con `<<...>>` en rojo. */
function interpretContentStream(bytes, resourcesDict, ctx, emitOut) {
  // pdf-lib no expone un parser de operadores público y estable para esto: se tokeniza el
  // content stream a mano con regex (hex+literal, con resolución de fuente por Tf).
  const text = bytes.toString('latin1')
  const fonts = resolveFonts(ctx, resourcesDict)
  let currentFont = null
  let color = 'black'
  // Tokeniza: Tf, rg, g, (lit)Tj, [array]TJ, <hex>Tj, [array con <hex> y (lit)]TJ
  const tokenRe =
    /\/(\S+)\s+[\d.]+\s+Tf|([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+rg|([\d.]+)\s+g\b|<([0-9A-Fa-f]*)>\s*Tj|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]]|\\.)*)\]\s*TJ|\bBT\b|\bET\b/g
  let m
  while ((m = tokenRe.exec(text)) !== null) {
    if (m[1] !== undefined) {
      currentFont = fonts.get('/' + m[1]) || fonts.get(m[1]) || null
    } else if (m[2] !== undefined) {
      const r = parseFloat(m[2]), g = parseFloat(m[3]), b = parseFloat(m[4])
      color = isRed([r, g, b]) ? 'red' : (r === 0 && g === 0 && b === 0 ? 'black' : 'other')
    } else if (m[5] !== undefined) {
      color = parseFloat(m[5]) === 0 ? 'black' : 'other'
    } else if (m[6] !== undefined) {
      const decoded = decodeHexHelper(m[6], currentFont)
      emitOut(decoded, color)
    } else if (m[7] !== undefined) {
      emitOut(decodeLiteralHelper(m[7], currentFont), color)
    } else if (m[8] !== undefined) {
      const inner = m[8]
      const partRe = /<([0-9A-Fa-f]*)>|\(((?:[^()\\]|\\.)*)\)/g
      let pm
      let chunk = ''
      while ((pm = partRe.exec(inner)) !== null) {
        chunk += pm[1] !== undefined ? decodeHexHelper(pm[1], currentFont) : decodeLiteralHelper(pm[2], currentFont)
      }
      emitOut(chunk, color)
    }
  }
}

function decodeHexHelper(hex, font) {
  if (!font) return Buffer.from(hex, 'hex').toString('latin1')
  const { map, bytesPerCode } = font
  const bytes = Buffer.from(hex.padEnd(hex.length + (hex.length % 2), '0'), 'hex')
  let out = ''
  for (let i = 0; i + bytesPerCode <= bytes.length; i += bytesPerCode) {
    const code = bytes.subarray(i, i + bytesPerCode).toString('hex').toUpperCase()
    out += map.get(code) ?? '�'
  }
  return out
}

function decodeLiteralHelper(lit, font) {
  // Des-escapa \n \r \t \( \) \\ y octales \ddd
  let s = ''
  for (let i = 0; i < lit.length; i++) {
    if (lit[i] === '\\') {
      const c = lit[i + 1]
      if (c === 'n') { s += '\n'; i++ }
      else if (c === 'r') { s += '\r'; i++ }
      else if (c === 't') { s += '\t'; i++ }
      else if (c === '(' || c === ')' || c === '\\') { s += c; i++ }
      else if (/[0-7]/.test(c)) {
        let oct = ''; let j = i + 1
        while (j < lit.length && oct.length < 3 && /[0-7]/.test(lit[j])) { oct += lit[j]; j++ }
        s += String.fromCharCode(parseInt(oct, 8))
        i = j - 1
      } else { s += c; i++ }
    } else s += lit[i]
  }
  if (!font) return s
  // Fuente simple con ToUnicode: 1 byte = 1 código, igual que decodeHexHelper.
  const bytes = Buffer.from(s, 'latin1')
  const { map, bytesPerCode } = font
  let out = ''
  for (let i = 0; i + bytesPerCode <= bytes.length; i += bytesPerCode) {
    const code = bytes.subarray(i, i + bytesPerCode).toString('hex').toUpperCase()
    out += map.has(code) ? map.get(code) : bytes.subarray(i, i + bytesPerCode).toString('latin1')
  }
  return out
}

async function extraerPdf(pdfPath) {
  const bytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(bytes)
  const pages = pdfDoc.getPages()
  let out = ''

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const ctx = page.doc.context
    out += `\n=== PAGINA ${i + 1} ===\n`
    const resources = page.node.Resources()
    const emit = (txt, color) => { out += color === 'red' ? `<<${txt}>>` : txt }

    // Content stream(s) de la propia página.
    const contentsRef = page.node.Contents()
    const streams = []
    if (contentsRef && contentsRef.constructor.name === 'PDFArray') {
      for (let j = 0; j < contentsRef.size(); j++) streams.push(ctx.lookup(contentsRef.get(j)))
    } else if (contentsRef) {
      streams.push(contentsRef)
    }
    for (const s of streams) interpretContentStream(streamBytes(s), resources, ctx, emit)

    // XObjects tipo /Form referenciados desde la página (el texto real de las plantillas de
    // Canarias vive aquí, no en el content stream de la página).
    const xobjDict = resources && resources.lookup(PDFName.of('XObject'))
    if (xobjDict) {
      for (const key of xobjDict.keys()) {
        const xobj = ctx.lookup(xobjDict.get(key))
        if (!xobj || !xobj.dict) continue
        const subtype = xobj.dict.get(PDFName.of('Subtype'))
        if (!subtype || subtype.asString() !== '/Form') continue
        const formResources = xobj.dict.lookup(PDFName.of('Resources'))
        interpretContentStream(streamBytes(xobj), formResources || resources, ctx, emit)
      }
    }
  }
  return out
}

if (require.main === module) {
  const pdfPath = process.argv[2]
  const outPath = process.argv[3] || pdfPath.replace(/\.pdf$/i, '.txt')
  if (!pdfPath) {
    console.error('uso: node extraer-pdf-con-respuestas.cjs <archivo.pdf> [salida.txt]')
    process.exit(1)
  }
  extraerPdf(pdfPath).then((text) => {
    fs.writeFileSync(outPath, text)
    const rojos = (text.match(/<</g) || []).length
    console.log(`✅ ${outPath} (${text.length} caracteres, ${rojos} fragmentos en rojo)`)
  }).catch((e) => { console.error('❌', e); process.exit(1) })
}

module.exports = { extraerPdf, parseToUnicodeCMap }
