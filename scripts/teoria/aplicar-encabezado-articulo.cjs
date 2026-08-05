#!/usr/bin/env node
/**
 * Codemod: que la tarjeta del temario deje de colgar su encabezado de `article.title` (T-596).
 *
 * ## Por qué un script y no 131 ediciones a mano
 *
 * `TopicContentView.tsx` está COPIADO una vez por oposición: **131 copias, todas con distinto md5**
 * (han ido divergiendo) y **todas con el mismo defecto**, en solo dos variantes sintácticas:
 *
 *   A (53 ficheros)  {article.title && <h3 className="…">{article.title}</h3>}
 *   B (78 ficheros)  {article.title && (\n  <h3 className="…">\n    {article.title}\n  </h3>\n)}
 *
 * A mano son 131 ocasiones de equivocarse y ninguna de comprobar. Aquí el cambio es determinista,
 * se cuenta, y lo que no encaje con el patrón **no se toca y se reporta** (nunca un reemplazo «a la
 * fuerza»: un fichero que haya divergido de verdad tiene que salir a la luz, no quedar arreglado a
 * medias).
 *
 * El encabezado pasa a salir de `encabezadoArticulo()` (`lib/teoria/encabezadoArticulo.ts`), que es
 * el ÚNICO sitio donde se decide qué se lee — el mismo que usa el detector de salud.
 *
 * Uso:  node scripts/teoria/aplicar-encabezado-articulo.cjs [--apply]
 *       (sin --apply: dry-run, no escribe nada)
 */
const fs = require('fs')
const path = require('path')

const APLICAR = process.argv.includes('--apply')
const RAIZ = path.join(__dirname, '..', '..')
const IMPORT = "import { encabezadoArticulo } from '@/lib/teoria/encabezadoArticulo'"

/** Bloque nuevo, con la indentación del sitio donde se inserta. */
function bloqueNuevo(ind) {
  return [
    `${ind}{(() => {`,
    `${ind}  // T-596: el encabezado NO puede colgar de \`title\` — 23% del banco lo tiene a NULL`,
    `${ind}  // teniendo el texto guardado, y esas tarjetas se servían mudas.`,
    `${ind}  const encabezado = encabezadoArticulo(article)`,
    `${ind}  return encabezado ? (`,
    `${ind}    <h3 className="font-medium text-gray-900 dark:text-white truncate">{encabezado}</h3>`,
    `${ind}  ) : null`,
    `${ind}})()}`,
  ].join('\n')
}

// Variante A: todo en una línea.
const RE_A = /^([ \t]*)\{article\.title && <h3 className="font-medium text-gray-900 dark:text-white truncate">\{article\.title\}<\/h3>\}[ \t]*$/m
// Variante B: abierta en varias líneas. Se ancla en el cierre exacto para no comerse JSX de más.
const RE_B = /^([ \t]*)\{article\.title && \(\s*\n[ \t]*<h3 className="font-medium text-gray-900 dark:text-white truncate">\s*\n[ \t]*\{article\.title\}\s*\n[ \t]*<\/h3>\s*\n[ \t]*\)\}[ \t]*$/m

function ficheros() {
  const out = []
  const appDir = path.join(RAIZ, 'app')
  for (const op of fs.readdirSync(appDir)) {
    const dir = path.join(appDir, op, 'temario')
    if (!fs.existsSync(dir)) continue
    for (const slug of fs.readdirSync(dir)) {
      const f = path.join(dir, slug, 'TopicContentView.tsx')
      if (fs.existsSync(f)) out.push(f)
    }
  }
  return out.sort()
}

/** Mete el import junto a los demás, y solo si falta (idempotente: se puede correr dos veces). */
function conImport(src) {
  if (src.includes("lib/teoria/encabezadoArticulo")) return src
  const lineas = src.split('\n')
  let ultimo = -1
  for (let i = 0; i < lineas.length; i++) if (/^import .+ from ['"]/.test(lineas[i])) ultimo = i
  if (ultimo === -1) return null // sin imports: no es el fichero que creemos
  lineas.splice(ultimo + 1, 0, IMPORT)
  return lineas.join('\n')
}

const res = { a: 0, b: 0, ya: 0, sinPatron: [], sinImports: [] }

for (const f of ficheros()) {
  const src = fs.readFileSync(f, 'utf8')
  const rel = path.relative(RAIZ, f)

  if (src.includes('encabezadoArticulo(article)')) { res.ya++; continue }

  let nuevo = null
  if (RE_A.test(src)) { nuevo = src.replace(RE_A, (_m, ind) => bloqueNuevo(ind)); res.a++ }
  else if (RE_B.test(src)) { nuevo = src.replace(RE_B, (_m, ind) => bloqueNuevo(ind)); res.b++ }
  else { res.sinPatron.push(rel); continue }

  const conImp = conImport(nuevo)
  if (!conImp) { res.sinImports.push(rel); continue }
  if (APLICAR) fs.writeFileSync(f, conImp, 'utf8')
}

console.log(`\n🔧 Encabezado de artículo — ${APLICAR ? 'APLICADO' : 'DRY-RUN (no se ha escrito nada)'}\n`)
console.log(`   variante A (una línea) : ${res.a}`)
console.log(`   variante B (bloque)    : ${res.b}`)
console.log(`   ya estaban al día      : ${res.ya}`)
console.log(`   TOTAL tocados          : ${res.a + res.b}`)
if (res.sinPatron.length) {
  console.log(`\n   ⚠️ ${res.sinPatron.length} sin el patrón esperado (NO tocados — míralos a mano):`)
  res.sinPatron.slice(0, 15).forEach((f) => console.log(`      ${f}`))
  if (res.sinPatron.length > 15) console.log(`      … y ${res.sinPatron.length - 15} más`)
}
if (res.sinImports.length) console.log(`\n   ⚠️ sin bloque de imports reconocible: ${res.sinImports.join(', ')}`)
if (!APLICAR) console.log('\n   → repite con --apply para escribir\n')

process.exit(res.sinPatron.length || res.sinImports.length ? 1 : 0)
