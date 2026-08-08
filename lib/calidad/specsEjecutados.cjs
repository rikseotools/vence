// lib/calidad/specsEjecutados.cjs — ¿algún proyecto que CI EJECUTE recoge este spec? [T-713]
//
// ## El problema, medido el 08/08/2026
//
// 6 de los 8 specs de Playwright **no se ejecutaban nunca**. No estaban rotos ni desactivados:
// simplemente ningún workflow invocaba el proyecto que los recoge.
//
//   · `prod` y `preview-aws` filtran por `smoke-*.spec.ts` → cogen 2.
//   · `authenticated` recoge `authed/**` → lo invoca `npm run test:e2e:auth`, y ese script no
//     aparece en ningún workflow.
//   · Y `preview-aws` solo corre en `pull_request`, pero aquí se empuja DIRECTO a `main`, así que
//     ese disparador tampoco salta nunca.
//
// Lo que hace daño no es perder esos 6, es que **quien escribe el séptimo cree que ha puesto una
// capa**. Los 6 huérfanos se escribieron precisamente porque un fallo se había escapado de todas
// las demás: el registro de IP que estuvo 27 días roto en silencio ([T-314]), el envío de
// impugnaciones ([T-198]), el configurador de leyes (regresión `442bc679`). Un test que nadie
// ejecuta es peor que no tenerlo: ocupa el sitio de la capa que sí habría hecho falta. Es el
// mismo modo de fallo que el gate de integración corriendo 492 veces sin base de datos.
//
// ## Qué comprueba
//
// Puro: recibe la lista de specs y la de proyectos EJECUTADOS por CI (con su `testMatch`), y
// devuelve los que no recoge ninguno. No lee ficheros ni git — eso lo hace quien lo llama, para
// poder probarlo sin montar un repo.

/**
 * @param {string[]} specs  rutas relativas a `e2e/` (p.ej. `authed/foo.spec.ts`)
 * @param {Array<{nombre:string, testMatch:RegExp, ejecutadoPorCI:boolean}>} proyectos
 * @returns {{huerfanos: string[], porProyecto: Record<string,string[]>}}
 */
function specsSinEjecutar(specs, proyectos) {
  const vivos = proyectos.filter((p) => p.ejecutadoPorCI)
  const porProyecto = {}
  for (const p of proyectos) porProyecto[p.nombre] = []

  const huerfanos = []
  for (const s of specs) {
    let recogido = false
    for (const p of proyectos) {
      if (p.testMatch.test(s)) {
        porProyecto[p.nombre].push(s)
        if (p.ejecutadoPorCI) recogido = true
      }
    }
    if (!recogido) huerfanos.push(s)
  }
  // Sin proyectos vivos no se puede afirmar nada: TODO sería huérfano y el mensaje engañaría.
  if (!vivos.length) return { huerfanos: [], porProyecto, sinProyectosVivos: true }
  return { huerfanos, porProyecto, sinProyectosVivos: false }
}

/** Mensaje accionable — un guardarraíl que solo dice «mal» se aprende a ignorar. */
function explicar(huerfanos) {
  if (!huerfanos.length) return ''
  return (
    `Estos ${huerfanos.length} spec(s) de Playwright no los ejecuta NINGÚN proyecto que CI corra,\n` +
    `así que no son una capa: son decoración.\n` +
    huerfanos.map((s) => `  · e2e/${s}`).join('\n') +
    `\n\nSalidas:\n` +
    `  (a) que un workflow invoque el proyecto que los recoge (ver .github/workflows/e2e-smoke.yml);\n` +
    `  (b) renombrarlo a smoke-*.spec.ts si de verdad va sin sesión;\n` +
    `  (c) si es a propósito que no corra, decláralo aquí y explica por qué.`
  )
}

module.exports = { specsSinEjecutar, explicar }
