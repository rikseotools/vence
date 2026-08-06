#!/usr/bin/env node
// scripts/temario/generar-bloques-por-oposicion.cjs
//
// Convierte las `getBlockInfo` de los `app/<oposicion>/temario/[slug]/TopicContentView.tsx`
// en DATO (lib/temario/bloquesPorOposicion.ts) y congela su comportamiento en un fixture
// de test (__tests__/temario/fixtures/bloques-originales.json).
//
// Se deriva del COMPORTAMIENTO, no del texto: cada función se transpila y se EJECUTA para
// n = 1..MAX_TEMA, y de ahí salen los tramos. Así la migración es equivalente por
// construcción y la equivalencia queda demostrada, no supuesta.
//
// Es de UN SOLO USO (T-611): una vez borrados los originales no hay de dónde derivar nada.
// Se conserva porque es la prueba de cómo se generó el dato y permite re-derivarlo desde
// git si alguien duda. NO lo ejecutes para "refrescar" nada: el dato manda desde ya.
//
//   node scripts/temario/generar-bloques-por-oposicion.cjs [--escribir]

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const ts = require('typescript')

// Los temarios por bloques NO numeran 1..N: numeran 201..204, 301..307, 601..608.
// El máximo real en BD es 608 (`select max(topic_number) from topics`). Muestrear hasta
// 120 —como hacía la primera versión— daba "0 divergencias" y había perdido los bloques
// II a VI de administrativo-estado: la comprobación tenía EL MISMO punto ciego que la
// generación, porque medía sobre el rango truncado. De ahí el techo alto y, sobre todo,
// la comprobación de LITERALES de más abajo, que mira el código en vez de muestrearlo.
const MAX_TEMA = 999
const escribir = process.argv.includes('--escribir')

function copias(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) copias(p, out)
    else if (e.name === 'TopicContentView.tsx') out.push(p)
  }
  return out
}

// La primera '{' tras la firma es la del TIPO DE RETORNO, no la del cuerpo. La del
// cuerpo es la ÚLTIMA de la línea de la firma; confundirlas recorta la función a su
// cabecera y todo lo demás sale en silencio.
function extraerFuncion(src) {
  const i = src.indexOf('function getBlockInfo')
  if (i < 0) return null
  const finLinea = src.indexOf('\n', i)
  const j = src.lastIndexOf('{', finLinea)
  if (j < i) return null
  let prof = 0
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') prof++
    else if (src[k] === '}') {
      prof--
      if (prof === 0) return src.slice(i, k + 1)
    }
  }
  return null
}

function evaluar(fuente) {
  const js = ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2020 } })
    .outputText
  const ctx = { resultado: null }
  vm.createContext(ctx)
  vm.runInContext(`${js}\nresultado = getBlockInfo;`, ctx)
  return ctx.resultado
}

// Igual que `aTramos` pero SIN descartar los tramos sin bloque: para el fixture hacen
// falta, porque son justamente el caso por defecto que el dato no almacena y que hay que
// demostrar que se sigue resolviendo igual.
function aTramosConHuecos(puntos) {
  const filas = []
  let act = null
  for (const p of puntos) {
    const offset = p.n - p.displayNum
    if (act && act[2] === p.block && act[3] === offset && p.n === act[1] + 1) {
      act[1] = p.n
      continue
    }
    act = [p.n, p.n, p.block, offset]
    filas.push(act)
  }
  return filas
}

function aTramos(puntos) {
  const tramos = []
  let act = null
  for (const p of puntos) {
    const offset = p.n - p.displayNum
    if (act && act.bloque === p.block && act.offset === offset && p.n === act.hasta + 1) {
      act.hasta = p.n
      continue
    }
    act = { desde: p.n, hasta: p.n, bloque: p.block, offset }
    tramos.push(act)
  }
  // El tramo con bloque '' es el `return` por defecto de la original: no es dato,
  // es la ausencia de dato. `resolverBloque` ya devuelve eso mismo si no hay tramo.
  return tramos.filter((t) => t.bloque !== '')
}

const files = copias('app').sort()
const porOposicion = {}
const fixture = {}
const fallos = []

for (const f of files) {
  const slug = f.split(path.sep)[1]
  const fuente = extraerFuncion(fs.readFileSync(f, 'utf8'))
  if (!fuente) {
    fallos.push(`${slug}: sin getBlockInfo`)
    continue
  }
  let g
  try {
    g = evaluar(fuente)
  } catch (e) {
    fallos.push(`${slug}: no evalúa (${e.message})`)
    continue
  }
  // Comprobación por OTRO camino que el muestreo: si el código original menciona un
  // número de tema por encima del techo, hay tramos que no estamos muestreando y el
  // resultado sería un recorte silencioso (pasó con administrativo-estado, 601..608).
  // Solo CÓDIGO: los comentarios llevan la referencia del boletín ('BOP … nº 93/2024')
  // y los nombres de bloque llevan años y ordinales. Contarlos daría falsos positivos.
  const soloCodigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, " '' ")
    .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ')
    .replace(/`(?:[^`\\]|\\.)*`/g, ' `` ')
  const literales = (soloCodigo.match(/\d+/g) || []).map(Number)
  const tope = literales.length ? Math.max(...literales) : 0
  if (tope > MAX_TEMA) {
    fallos.push(`${slug}: menciona el tema ${tope}, por encima del techo ${MAX_TEMA}`)
    continue
  }

  const puntos = []
  for (let n = 1; n <= MAX_TEMA; n++) {
    const r = g(n)
    puntos.push({ n, block: r.block, displayNum: r.displayNum })
  }
  porOposicion[slug] = aTramos(puntos)
  // El fixture guarda el comportamiento original COMPRIMIDO en tramos, INCLUIDOS los
  // huecos sin bloque (que el dato no guarda: los resuelve el caso por defecto). El test
  // lo expande tema a tema, así que la comprobación sigue siendo exhaustiva y el fichero
  // baja de 4,7 MB a unos pocos KB. Guardar 130.869 filas para probar esto era bloat.
  fixture[slug] = aTramosConHuecos(puntos)
}

console.log(`copias                : ${files.length}`)
console.log(`convertidas a dato    : ${Object.keys(porOposicion).length}`)
console.log(`fallos                : ${fallos.length}`)
for (const x of fallos) console.log(`   ⚠️  ${x}`)
if (fallos.length) {
  console.error('\n❌ No se escribe nada: una copia sin convertir es una oposición que perdería sus bloques.')
  process.exit(1)
}

// Verificación en el propio generador: el dato reproduce el comportamiento original.
// (El test lo repite contra el fixture; aquí se comprueba ANTES de escribir.)
const { resolverBloque } = (() => {
  const src = fs.readFileSync('lib/temario/bloquesTemario.ts', 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText
  const ctx = { exports: {}, module: { exports: {} } }
  ctx.module.exports = ctx.exports
  vm.createContext(ctx)
  vm.runInContext(js, ctx)
  return ctx.exports
})()

let divergencias = 0
let comprobados = 0
for (const [slug, filas] of Object.entries(fixture)) {
  for (const [desde, hasta, block, offset] of filas) {
    for (let n = desde; n <= hasta; n++) {
      comprobados++
      const r = resolverBloque(porOposicion[slug], n)
      if (r.block !== block || r.displayNum !== n - offset) divergencias++
    }
  }
}
console.log(`\ncomprobaciones        : ${comprobados}`)
console.log(`divergencias          : ${divergencias}`)
if (divergencias > 0) {
  console.error('❌ El dato NO reproduce el comportamiento original. No se escribe nada.')
  process.exit(1)
}

if (!escribir) {
  console.log('\n(simulación — repite con --escribir)')
  process.exit(0)
}

const cabecera = `// lib/temario/bloquesPorOposicion.ts
//
// GENERADO por scripts/temario/generar-bloques-por-oposicion.cjs (T-611).
//
// Los bloques del temario de cada oposición, sacados de las 131 \`getBlockInfo\` que
// vivían copiadas en \`app/<oposicion>/temario/[slug]/TopicContentView.tsx\`. No eran
// código: eran una tabla de rangos escrita a mano 131 veces, y por eso el componente
// tenía que estar duplicado. Ahora el componente es UNO y esto es su dato.
//
// La clave es el SLUG de la ruta (\`app/<slug>/…\`), que es lo que la página ya pasa
// como \`oposicion=\`. Su equivalencia con las funciones originales está congelada en
// \`__tests__/temario/fixtures/bloques-originales.json\`.
//
// AL DAR DE ALTA UNA OPOSICIÓN: añade aquí su entrada. Si no, su temario se sirve sin
// bloques y con el número de tema crudo — y el guardarraíl de
// \`__tests__/temario/bloquesPorOposicion.test.ts\` te para antes.
import type { TramoBloque } from './bloquesTemario'

export const BLOQUES_POR_OPOSICION: Record<string, TramoBloque[]> = {
`

const cuerpo = Object.entries(porOposicion)
  .map(([slug, tramos]) => {
    if (!tramos.length) return `  '${slug}': [], // temario sin bloques`
    const filas = tramos
      .map(
        (t) =>
          `    { desde: ${t.desde}, hasta: ${t.hasta}, offset: ${t.offset}, bloque: ${JSON.stringify(t.bloque)} },`,
      )
      .join('\n')
    return `  '${slug}': [\n${filas}\n  ],`
  })
  .join('\n')

fs.writeFileSync('lib/temario/bloquesPorOposicion.ts', `${cabecera}${cuerpo}\n}\n`)
fs.mkdirSync('__tests__/temario/fixtures', { recursive: true })
fs.writeFileSync(
  '__tests__/temario/fixtures/bloques-originales.json',
  JSON.stringify(
    {
      _leeme:
        'Comportamiento REAL de las 131 getBlockInfo originales, muestreado tema a tema (n=1..' +
        MAX_TEMA +
        ') ANTES de unificar el componente (T-611) y guardado comprimido en tramos. Es la prueba de que bloquesPorOposicion.ts no cambió lo que ve el opositor; el test lo EXPANDE y compara tema a tema. Incluye los tramos SIN bloque a propósito: son el caso por defecto, que el dato no almacena. NO regenerar: los originales ya no existen.',
      maxTema: MAX_TEMA,
      formato: '[desde, hasta, bloque, offset]  ·  nºMostrado = nºTema - offset',
      oposiciones: fixture,
    },
    null,
    1,
  ),
)
console.log('\n✅ escritos:')
console.log('   lib/temario/bloquesPorOposicion.ts')
console.log('   __tests__/temario/fixtures/bloques-originales.json')
