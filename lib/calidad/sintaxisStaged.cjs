// lib/calidad/sintaxisStaged.cjs — lógica PURA del check de sintaxis sobre lo que se va a commitear.
//
// ## Por qué existe (T-349, 31/07/2026)
//
// Un error de PARSEO en un `.cjs` no lo caza nadie hasta el CI, y para entonces ya está en `main`:
// a partir de ahí **ninguna sesión puede desplegar** hasta que alguien lo note. Ha pasado tres
// veces con el mismo modo de fallo, siempre igual — comentarios SQL dentro de un template literal
// con identificadores entre backticks de markdown, que cierran la plantilla:
//
//   · `scripts/health-sweep.cjs` — el barrido de salud llevaba tiempo sin arrancar ([T-282]).
//   · `data/pilotos/t291-escalon2-30jul/extraer-tanda2.cjs` — costó el deploy de la noche del 30/07.
//   · `scripts/temario/detect-temario-revision.cjs` — encontrado el 31/07 **estrenando este check**,
//     roto en `main` y sin que nadie lo supiera.
//
// El CI lo detecta perfectamente; lo que falla es el MOMENTO. Esto lo adelanta al commit, que es
// donde el arreglo cuesta diez segundos y no bloquea a nadie más.
//
// ## Qué comprueba, y qué NO
//
// Solo si el fichero **parsea**. No opina de estilo (para eso está el lint del CI, con sus 247
// warnings heredados, que es justo el motivo por el que el lint no está en este hook).
//
// ## El límite del JSX, que es la razón de `pareceJsx`
//
// `node --check` no entiende JSX: `const el = <Foo />` le parece un error de sintaxis. En este
// repo la UI vive en `.tsx`, así que hoy no hay ni un `.js` con JSX real — medido el 31/07 sobre
// **490 `.js`, 37 `.mjs` y 1.054 `.cjs`: 0 falsos positivos** (el único fallo era el defecto real
// de arriba). Pero un `.js` con JSX es legal en un proyecto Next, y bloquear un commit legítimo
// es exactamente como se aprende a escribir `--no-verify`, que apaga TAMBIÉN los demás
// guardarraíles del hook. Así que un fallo en un fichero con pinta de JSX **avisa y no bloquea**.
'use strict'

/** Extensiones que `node --check` sabe juzgar. `.ts`/`.tsx` van por `npm run typecheck` y CI. */
const EXTENSIONES = ['.cjs', '.mjs', '.js']

/**
 * De la lista de ficheros staged, los que tiene sentido comprobar.
 * Fuera: otras extensiones, dependencias y artefactos de build (no los escribimos nosotros).
 */
function ficherosAComprobar(rutas) {
  return (rutas || [])
    .map((r) => String(r || '').trim())
    .filter(Boolean)
    .filter((r) => EXTENSIONES.some((e) => r.endsWith(e)))
    .filter((r) => !/(^|\/)(node_modules|\.next|dist|build|coverage)\//.test(r))
}

/**
 * ¿El contenido tiene pinta de llevar JSX? Solo se usa para DEGRADAR un fallo a aviso, nunca
 * para saltarse un fichero por adelantado: si trae JSX y aun así parsea, mejor — no molesta.
 *
 * Busca una etiqueta de componente (`<Foo`, `</Foo>`) o el cierre corto `/>`, que es lo que
 * `node --check` no puede tragar. No vale con buscar `<div`: eso aparece dentro de plantillas
 * HTML en scripts que SÍ son JavaScript normal y que SÍ queremos vigilar.
 */
function pareceJsx(contenido) {
  const c = String(contenido || '')
  return /<[A-Z][A-Za-z0-9]*[\s/>]/.test(c) || /<\/[A-Za-z][A-Za-z0-9.]*>/.test(c) || /\/>\s*$/m.test(c)
}

/**
 * Reparte los resultados de `node --check` en las tres salidas posibles.
 * `resultados` = [{ ruta, ok, error, contenido }].
 *
 * Devuelve `{ rotos, avisos, ok, bloquea }`. `bloquea` es lo único que decide el exit code:
 * un fichero con JSX que no parsea NO bloquea (ver cabecera).
 */
function clasificar(resultados) {
  const rotos = []
  const avisos = []
  let ok = 0
  for (const r of resultados || []) {
    if (r.ok) { ok++; continue }
    if (pareceJsx(r.contenido)) avisos.push(r)
    else rotos.push(r)
  }
  return { rotos, avisos, ok, bloquea: rotos.length > 0 }
}

module.exports = { EXTENSIONES, ficherosAComprobar, pareceJsx, clasificar }
