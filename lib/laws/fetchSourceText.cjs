// lib/laws/fetchSourceText.cjs
//
// Descarga el texto de una fuente legal (boletín autonómico, PDF, sede universitaria).
//
// ── POR QUÉ ESTÁ AQUÍ Y NO DENTRO DE UN SCRIPT ────────────────────────────────────────────
//
// Vivía dentro de `scripts/verify-law-source.cjs`, que verifica la completitud. Al montar la
// vigilancia por hash [T-026] hacía falta exactamente lo mismo, y copiarlo habría creado dos
// descargadores que **con el tiempo divergen**: uno aprende a saltarse un WAF, el otro no, y
// entonces la misma fuente se lee distinto según quién pregunte — con lo que el hash de la
// vigilancia dejaría de comparar contra lo que verificó la otra herramienta. Un hash solo vale
// si las dos partes leen igual.
//
// Los tres detalles que costaron sangre y por eso están comentados:
//   · El tipo se detecta por MAGIC-BYTES (`%PDF`), no por la extensión: muchos boletines
//     sirven PDF en URLs sin `.pdf` (BORM `/pdf`, BOA `BRSCGI`).
//   · `curl -k`: algunos boletines autonómicos tienen la cadena TLS rota y si no, no hay
//     descarga posible.
//   · El HTML se lee como UTF-8: en latin1 se rompe la palabra «Artículo», que es justo el
//     ancla con la que se trocea el articulado.

const fs = require('fs')
const { execSync } = require('child_process')

/**
 * @param {string} url
 * @returns {Promise<string|null>} texto plano, o null si no se pudo descargar/convertir.
 */
async function fetchSourceText(url) {
  const tmp = `/tmp/lawsrc_${Date.now()}_${Math.floor(process.hrtime()[1] % 1e6)}`
  try {
    execSync(`curl -skL --max-time 45 -A "Mozilla/5.0" "${url}" -o ${tmp}.bin`, { stdio: 'ignore' })
    if (!fs.existsSync(`${tmp}.bin`) || fs.statSync(`${tmp}.bin`).size < 500) return null
    const head = fs.readFileSync(`${tmp}.bin`).slice(0, 5).toString('latin1')
    if (head.startsWith('%PDF')) {
      execSync(`pdftotext -layout ${tmp}.bin ${tmp}.txt 2>/dev/null`, { stdio: 'ignore' })
      return fs.existsSync(`${tmp}.txt`) ? fs.readFileSync(`${tmp}.txt`, 'utf8') : null
    }
    const html = fs.readFileSync(`${tmp}.bin`, 'utf8')
    return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/[ \t]+/g, ' ')
  } catch { return null }
  finally { try { fs.rmSync(`${tmp}.bin`, { force: true }); fs.rmSync(`${tmp}.txt`, { force: true }) } catch {} }
}

module.exports = { fetchSourceText }
