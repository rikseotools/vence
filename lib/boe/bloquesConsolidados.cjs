/**
 * lib/boe/bloquesConsolidados.cjs — núcleo PURO para leer los bloques de una norma consolidada
 * del BOE (API de datos abiertos) y traducirlos a filas de `articles`.
 *
 * ## POR QUÉ EXISTE (T-726, 08/08/2026)
 *
 * Nuestro extractor de leyes **no toca los anexos** (limitación conocida y documentada en
 * `docs/maintenance/monitoreo-boe-y-crear-leyes-nuevas.md`), así que hay normas importadas cuyo
 * temario promete la ley entera y sirve solo el articulado. En reglamentos de prevención eso es
 * casi toda la norma: las cifras que se examinan (colores, dimensiones, lux, temperaturas) viven
 * en los anexos, no en los artículos, que son remisiones de dos líneas.
 *
 * Lo encontró **un usuario** (`casterpepe76`, Ordenanza de Córdoba) dos veces seguidas: primero el
 * RD 486/1997 ([T-676]) y, al día siguiente, el RD 485/1997 ([T-726]). Que el mismo aviso llegue
 * dos veces es la señal de que esto no era un caso suelto: por eso el criterio deja de vivir
 * dentro de un script de una ley y pasa a un núcleo con pruebas.
 *
 * ## LO QUE DECIDE ESTE FICHERO
 *
 * `aTexto` es la pieza que decide si el anexo queda **VERBATIM o destrozado**, y es justo la que
 * produjo el estado que estamos reparando: recortar el HTML de `act.php` por marcadores es lo que
 * genera los "anexos resumidos" de los que se quejó el usuario. Aquí no se recorta nada: la API
 * entrega el bloque ya delimitado por el propio BOE y solo se pasa de XML a texto conservando los
 * saltos de párrafo (los anexos son listas numeradas; aplanarlos los vuelve ilegibles).
 */

/** Entidades HTML que aparecen de verdad en los textos del BOE. */
const ENTIDADES = [
  [/&aacute;/g, 'á'], [/&eacute;/g, 'é'], [/&iacute;/g, 'í'], [/&oacute;/g, 'ó'], [/&uacute;/g, 'ú'],
  [/&Aacute;/g, 'Á'], [/&Eacute;/g, 'É'], [/&Iacute;/g, 'Í'], [/&Oacute;/g, 'Ó'], [/&Uacute;/g, 'Ú'],
  [/&ntilde;/g, 'ñ'], [/&Ntilde;/g, 'Ñ'], [/&uuml;/g, 'ü'], [/&ordm;/g, 'º'], [/&ordf;/g, 'ª'],
  [/&deg;/g, '°'], [/&nbsp;/g, ' '], [/&lt;/g, '<'], [/&gt;/g, '>'], [/&quot;/g, '"'],
  [/&amp;/g, '&'],
]

/** Texto de una celda: sin etiquetas, con las entidades resueltas y las barras escapadas. */
function textoDeCelda(html) {
  let t = String(html).replace(/<[^>]+>/g, ' ')
  for (const [re, ch] of ENTIDADES) t = t.replace(re, ch)
  return t.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
}

/**
 * `<table>` del BOE → tabla Markdown (`| a | b |`), que es lo que el render de teoría sabe pintar
 * (`lib/teoria/formatLegalText.ts` conserva las filas `| … |` contiguas).
 *
 * **Por qué no se aplana:** una tabla convertida en una lista de celdas sueltas es exactamente el
 * defecto `tablas-articulos.md` que el sweep detecta (`detectFlattenedTable`) — y en el Anexo II
 * del RD 485/1997 la tabla ES el contenido examinable (qué significa cada color de seguridad).
 * Importarla aplanada sería cambiar un hueco por un defecto con detector propio.
 *
 * **`rowspan`:** Markdown no lo tiene. El valor se REPITE en las filas que la celda abarca, que es
 * lo que el rowspan afirma (en el BOE, «Rojo.» cubre sus tres filas). Dejar la celda vacía se
 * leería como «sin valor», y ahí sí estaríamos perdiendo información del original.
 */
function tablaAMarkdown(xmlTabla) {
  const filas = []
  const arrastre = [] // [{ col, texto, quedan }] pendientes de rowspan
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let tr
  while ((tr = trRe.exec(xmlTabla))) {
    const celdas = []
    // Primero se colocan las celdas arrastradas de un rowspan anterior, y se consumen AQUÍ: si se
    // descontaran al final de la fila, la celda que abre el rowspan gastaría su propio turno y el
    // valor no llegaría a las filas siguientes.
    for (const a of arrastre) if (a.quedan > 0) { celdas[a.col] = a.texto; a.quedan-- }

    const tdRe = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/gi
    let td
    while ((td = tdRe.exec(tr[1]))) {
      let col = 0
      while (celdas[col] !== undefined) col++
      const texto = textoDeCelda(td[2])
      celdas[col] = texto
      const span = Number((td[1].match(/rowspan="(\d+)"/i) || [])[1] || 1)
      if (span > 1) arrastre.push({ col, texto, quedan: span - 1 })
    }
    if (celdas.length) filas.push(Array.from(celdas, (x) => x || ''))
  }
  if (!filas.length) return ''

  const ancho = Math.max(...filas.map((f) => f.length))
  const pinta = (f) => `| ${Array.from({ length: ancho }, (_, i) => f[i] || '').join(' | ')} |`
  // Markdown EXIGE separador tras la primera fila; el BOE marca la cabecera con `cabeza_tabla`,
  // pero cuando no la trae la primera fila hace de cabecera igual (si no, no se pinta como tabla).
  return [pinta(filas[0]), `| ${Array.from({ length: ancho }, () => '---').join(' | ')} |`,
    ...filas.slice(1).map(pinta)].join('\n')
}

/**
 * XML de un bloque → texto plano, párrafo a párrafo.
 *
 * ⚠️ `&amp;` se sustituye EL ÚLTIMO a propósito: hacerlo antes convertiría `&amp;aacute;` en
 * `á` (doble desescapado), que es la forma silenciosa de alterar un texto que juramos verbatim.
 */
function aTexto(xml) {
  let cuerpo = String(xml)
    .replace(/^[\s\S]*?<version[^>]*>/, '')
    .replace(/<\/version>[\s\S]*$/, '')

  // Las tablas se convierten ANTES de partir por `</p>` (sus celdas son `<p>` y el split las
  // desmontaría). Cada una deja un párrafo propio con el Markdown ya hecho.
  const tablas = []
  cuerpo = cuerpo.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (t) => {
    const md = tablaAMarkdown(t)
    if (!md) return ''
    tablas.push(md)
    return `<p>TABLA${tablas.length - 1}</p>`
  })

  const texto = cuerpo
    .split(/<\/p>/i)
    .map((p) => {
      let t = p.replace(/<[^>]+>/g, '')
      for (const [re, ch] of ENTIDADES) t = t.replace(re, ch)
      return t.replace(/[ \t]+/g, ' ').trim()
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()

  return texto.replace(/TABLA(\d+)/g, (m, i) => (tablas[Number(i)] !== undefined ? tablas[Number(i)] : m))
}

/** Índice consolidado (XML) → lista de bloques `{id, tipo, titulo}`, en el orden del BOE. */
function indiceBloques(xml) {
  const out = []
  const re = /<bloque\s+id="([^"]+)"\s+tipo="([^"]+)"(?:\s+titulo="([^"]*)")?\s*\/?>/g
  let m
  while ((m = re.exec(String(xml)))) out.push({ id: m[1], tipo: m[2], titulo: m[3] || '' })
  return out
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const ORDINALES = {
  primera: 1, segunda: 2, tercera: 3, cuarta: 4, quinta: 5,
  sexta: 6, séptima: 7, septima: 7, octava: 8, novena: 9, décima: 10, decima: 10,
}
const FAMILIAS = { adicional: 'DA', transitoria: 'DT', derogatoria: 'DD', final: 'DF' }

/**
 * Bloque del índice → cómo se llamaría en `articles.article_number`, siguiendo la convención que
 * la BD ya usa para estas normas (`AI`, `AII`… · `DAunica`, `DDunica`, `DF1`, `DF2`).
 *
 * Devuelve `null` para lo que NO se importa por esta vía (preámbulo, firma, articulado): el
 * articulado ya lo trae el extractor normal y duplicarlo desde aquí crearía dos escritores del
 * mismo contenido.
 */
function clasificarBloque({ tipo, titulo }) {
  const t = String(titulo || '').trim()

  const anexo = t.match(/^ANEXO\s+([IVX]+)$/i)
  if (anexo) {
    const romano = anexo[1].toUpperCase()
    if (!ROMANOS.includes(romano)) return null
    return { clase: 'anexo', articleNumber: `A${romano}`, romano }
  }

  const disp = t.match(/^Disposici[óo]n\s+(adicional|transitoria|derogatoria|final)\s+(.+)$/i)
  if (disp && tipo === 'precepto') {
    const familia = FAMILIAS[disp[1].toLowerCase()]
    const cual = disp[2].trim().toLowerCase().replace(/\.$/, '')
    if (/^[úu]nica$/.test(cual)) return { clase: 'disposicion', articleNumber: `${familia}unica` }
    const n = ORDINALES[cual]
    if (!n) return null
    return { clase: 'disposicion', articleNumber: `${familia}${n}` }
  }

  return null
}

/**
 * Texto plano de un bloque → `{ title, content }` con la forma que ya tienen estas filas en BD.
 *
 * - **Anexo**: el contenido conserva su cabecera (`ANEXO I` + subtítulo), y el `title` es
 *   `Anexo I — <subtítulo>`. Es como quedó el RD 486/1997 en [T-676]; cambiarlo aquí dejaría dos
 *   convenciones conviviendo en la misma tabla.
 * - **Disposición**: la primera línea es la rúbrica (`Disposición derogatoria única. <rúbrica>.`)
 *   y NO se guarda en el contenido: se convierte en el `title`, que es como están las del 486.
 */
function tituloYCuerpo(texto, clase, romano) {
  const lineas = String(texto).split('\n\n')

  if (clase === 'anexo') {
    const subtitulo = (lineas[1] || '').trim()
    const title = subtitulo ? `Anexo ${romano} — ${subtitulo}` : `Anexo ${romano}`
    return { title, content: texto }
  }

  const cabecera = (lineas[0] || '').trim()
  const rubrica = cabecera.match(/^Disposici[óo]n[^.]*\.\s*(.+?)\.?$/i)
  return {
    title: rubrica ? rubrica[1].trim() : cabecera,
    content: lineas.slice(1).join('\n\n').trim(),
  }
}

module.exports = { aTexto, indiceBloques, clasificarBloque, tituloYCuerpo }
