// ¿Cuántos guardarraíles llevan una lista de RUTAS escrita a mano?
//
// La lista no está mal el día que se escribe: se queda vieja sola, y entonces el guardarraíl da
// verde sobre un universo que ya no es el real. Ya pasó cuatro veces (T-130, T-339, T-689, T-624).
// Antes de convertir nada hay que saber cuántos son y cuáles son TRINQUETES a propósito.
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')
const DIR = path.join(REPO, '__tests__')

function ficheros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) ficheros(p, out)
    else if (/\.(ts|tsx|js|cjs)$/.test(e.name)) out.push(p)
  }
  return out
}

// Una constante en MAYÚSCULAS con un array de literales que PARECEN rutas de fichero.
const RE_CONST = /const\s+([A-Z][A-Z0-9_]{2,})\s*(?::[^=]+)?=\s*(?:new Set\()?\[([\s\S]{0,4000}?)\]/g
const RE_RUTA = /['"`]([a-zA-Z0-9_@./-]+\.(?:ts|tsx|js|cjs|mjs|sql|md|py))['"`]/g

const hallazgos = []
for (const f of ficheros(DIR)) {
  const src = fs.readFileSync(f, 'utf8')
  for (const m of src.matchAll(RE_CONST)) {
    const rutas = [...m[2].matchAll(RE_RUTA)].map((x) => x[1])
    if (rutas.length < 2) continue
    // ¿El propio fichero ya descubre? (recorre el árbol) — entonces la lista es otra cosa.
    const descubre = /readdirSync|globSync|execFileSync\(\s*['"]git['"]/.test(src)
    hallazgos.push({
      fichero: path.relative(REPO, f),
      constante: m[1],
      n: rutas.length,
      descubre,
      // Señal de TRINQUETE: el propio comentario dice que solo puede encoger / es línea base.
      trinquete: /solo puede (ENCOGER|encoger)|l[íi]nea base|trinquete|ratchet|ZONA_CIEGA|TECHO_/i
        .test(src.slice(Math.max(0, m.index - 600), m.index + 200)),
    })
  }
}

hallazgos.sort((a, b) => b.n - a.n)
const trinquetes = hallazgos.filter((h) => h.trinquete)
const conDescubrimiento = hallazgos.filter((h) => !h.trinquete && h.descubre)
const aConvertir = hallazgos.filter((h) => !h.trinquete && !h.descubre)

console.log(`constantes con lista de rutas: ${hallazgos.length}`)
console.log(`  · TRINQUETES (la lista ES el mecanismo, NO tocar): ${trinquetes.length}`)
console.log(`  · el fichero YA descubre además de listar:         ${conDescubrimiento.length}`)
console.log(`  · ⚠️  lista fija que pretende ser exhaustiva:      ${aConvertir.length}`)
console.log('\nlas candidatas a convertir:')
for (const h of aConvertir.slice(0, 20)) console.log(`   ${String(h.n).padStart(3)} rutas · ${h.constante}  (${h.fichero})`)
console.log('\ntrinquetes detectados (se dejan como están):')
for (const h of trinquetes.slice(0, 8)) console.log(`   ${String(h.n).padStart(3)} · ${h.constante}  (${h.fichero})`)
