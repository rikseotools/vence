// lib/hooks/typecheckRelevance.cjs — lógica PURA: ¿este push puede romper el `Typecheck` del CI?
//
// ## Por qué (T-225, 28/07/2026)
//
// El check `Typecheck` de GHA es uno de los que mira el gate de CI de
// `scripts/deploy-{frontend,backend}.sh`, así que un `main` rojo por tipos **bloquea el
// deploy de TODAS las sesiones** — y el diagnóstico se lo come quien no lo rompió. El
// `pre-commit` corre tests, pero los tests unitarios **no ven un error de tipos**: pasan
// igual. Resultado: el único sitio donde se detectaba era el CI, o sea DESPUÉS de pushear.
//
// ## Por qué en el pre-PUSH y no en el pre-commit (medido, no a ojo)
//
// El coste de `npm run typecheck` en este repo, con la caché incremental que `tsconfig.json`
// ya tenía activada (`"incremental": true`):
//
//   · en FRÍO (worktree recién creada, sin `.tsbuildinfo`) ......... 72,7 s
//   · en caliente, sin cambios ..................................... ~14 s
//   · en caliente, tocando un módulo de amplio alcance ............. ~43 s
//
// La ficha de T-225 daba «más de 2 minutos» porque se midió en FRÍO — que es exactamente lo
// que pasa en cada worktree nueva. Pagarlo por COMMIT sería intolerable (varios commits por
// sesión) y un hook que molesta acaba saltándose con `--no-verify`, que es peor que no
// tenerlo. Por PUSH se paga una vez y sigue estando ANTES de que el rojo llegue a `main`,
// que es lo único que importa.
//
// ## Y por eso existe este módulo: que el push que NO puede romperlo no pague nada
//
// Buena parte de los pushes de este repo son de documentación (fichas del backlog, runbooks).
// Ésos no pueden poner el `Typecheck` en rojo, así que no deben costar ni un segundo. Aquí se
// decide, a partir de los ficheros que cambian, si hay que correr `tsc`.
//
// **Criterio conservador a propósito:** ante la duda, SE CORRE. Un falso positivo cuesta
// ~14 s; un falso negativo es el `main` rojo que esta tarea existe para evitar.

/**
 * Prefijos que el typecheck de la raíz NO mira. Espejo de `exclude` en `tsconfig.json`
 * (`node_modules`, `backend`, `__tests__`). El guardarraíl
 * `__tests__/guardrails/typecheckHook.test.ts` falla si los dos se desincronizan: si alguien
 * mete `backend` en el typecheck de la raíz y aquí seguimos ignorándolo, el hook daría verde
 * a un push que rompe el CI.
 */
const PREFIJOS_IGNORADOS = ['node_modules/', 'backend/', '__tests__/']

/**
 * Extensiones que entran en el programa de TypeScript. `.js`/`.jsx`/`.cjs`/`.mjs` cuentan
 * porque `tsconfig.json` tiene `allowJs: true`: aunque sin `checkJs` no se reporten errores
 * DENTRO de ellos, un `.js` que cambia de forma sí puede romper el `.ts` que lo importa.
 */
const EXT_CODIGO = /\.(ts|tsx|js|jsx|cjs|mjs)$/

/**
 * Ficheros que reconfiguran la comprobación entera: tocarlos puede volver rojo el CI sin que
 * cambie una sola línea de código (cambiar `strict`, subir TypeScript, mover un `paths`…).
 */
const FICHEROS_DE_CONFIG = /^(tsconfig(\.[\w.-]+)?\.json|package(-lock)?\.json|next-env\.d\.ts)$/

/**
 * ¿Hay que correr el typecheck para este conjunto de ficheros cambiados?
 *
 * @param {string[]} archivos rutas relativas a la raíz del repo (como las da `git diff --name-only`).
 * @param {{prefijosIgnorados?: string[]}} [opts] inyectable para los tests de paridad con tsconfig.
 * @returns {{correr: boolean, motivo: string, relevantes: string[]}}
 */
function needsTypecheck(archivos, opts = {}) {
  const ignorados = opts.prefijosIgnorados || PREFIJOS_IGNORADOS
  const lista = Array.isArray(archivos) ? archivos.filter((f) => typeof f === 'string' && f) : []

  // Sin lista de ficheros no se puede afirmar que el push sea inocuo → se corre.
  // (Pasa si `git diff` falla o si el rango de commits no se puede resolver.)
  if (lista.length === 0) {
    return { correr: true, motivo: 'no se pudo determinar qué ficheros cambian', relevantes: [] }
  }

  const relevantes = lista.filter((f) => {
    const ruta = f.replace(/^\.\//, '')
    if (FICHEROS_DE_CONFIG.test(ruta)) return true // la config manda aunque esté en la raíz
    if (ignorados.some((p) => ruta.startsWith(p))) return false
    return EXT_CODIGO.test(ruta)
  })

  if (relevantes.length === 0) {
    return { correr: false, motivo: 'el push no toca código que mire el typecheck', relevantes: [] }
  }
  return { correr: true, motivo: `${relevantes.length} fichero(s) de código`, relevantes }
}

module.exports = { needsTypecheck, PREFIJOS_IGNORADOS, EXT_CODIGO, FICHEROS_DE_CONFIG }
