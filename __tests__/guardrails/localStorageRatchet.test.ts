/**
 * El trinquete de `localStorage` solo puede MENGUAR.
 *
 * `eslint.config.mjs` prohíbe tocar `localStorage` directamente y exceptúa los ficheros que ya lo
 * hacían el 27/07/2026. Sin este test, la forma natural de "arreglar" un lint en rojo sería añadir el
 * fichero a la lista de excepciones — y la deuda crecería con la bendición del guardarraíl que se
 * puso para contenerla.
 *
 * Por qué importa: `localStorage` LANZA con la cuota llena, en Safari privado y con cookies
 * bloqueadas. Una llamada desnuda tumba el árbol de React entero. El 27/07 fueron 19
 * `react_error_boundary` en 24 h por no poder guardar una caché de 10 caracteres.
 *
 * Al migrar un fichero a `lib/storage/safeLocalStorage`, se borra su línea de la lista Y se baja el
 * número de aquí. Nunca al revés.
 *
 * [T-203, 08/08/2026] Los 45 ficheros originales quedaron todos resueltos: la mayoría migrada de
 * verdad (violación AST real, incluyendo `window.localStorage.*`, que el lint no veía pero tenía
 * el mismo riesgo de lanzar) y un par que resultaron no tener nada que migrar (uno usaba
 * sessionStorage, no localStorage; otro solo tocaba localStorage dentro de un <Script> de texto
 * plano, invisible para el AST y ya protegido por su propio try/catch). Solo queda el helper, que
 * por definición es el único sitio que puede tocar el API real.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

/** Excepciones vivas. Este número NO puede subir. Solo el helper: es el único caso permanente. */
const DEUDA_INICIAL = 1

function excepcionesDeclaradas(): string[] {
  const cfg = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf-8')
  // Ancla al comentario de sección (único) en vez de al texto del helper: así se captura
  // también la PRIMERA entrada del array, que antes quedaba fuera del slice por accidente.
  const start = cfg.indexOf('// ── localStorage solo a través de')
  const ignoresStart = cfg.indexOf('ignores: [', start)
  const bloque = cfg.slice(ignoresStart)
  const ignores = bloque.slice(0, bloque.indexOf('rules:'))
  return [...ignores.matchAll(/^\s*"([^"]+)",/gm)].map((m) => m[1])
}

describe('trinquete de localStorage', () => {
  it('la regla existe y apunta al helper', () => {
    const cfg = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf-8')
    expect(cfg).toContain('no-restricted-properties')
    expect(cfg).toContain('lib/storage/safeLocalStorage')
  })

  it('la lista de excepciones NO crece (solo puede menguar al migrar)', () => {
    expect(excepcionesDeclaradas().length).toBeLessThanOrEqual(DEUDA_INICIAL)
  })

  it('no hay excepciones duplicadas (al normalizar corchetes dos rutas pueden colapsar)', () => {
    const l = excepcionesDeclaradas()
    expect(l.length).toBe(new Set(l).size)
  })

  it('ninguna excepción lleva corchetes sin normalizar (en un glob son clase de caracteres, no casan)', () => {
    // Cazado en caliente el 27/07: `app/…/[lawId]/page.js` NO exceptuaba nada y el lint seguía rojo.
    for (const ruta of excepcionesDeclaradas()) {
      expect(ruta).not.toMatch(/\[[^\]]+\]/)
    }
  })

  it('el helper está exceptuado (es el único que puede tocar el API real)', () => {
    expect(excepcionesDeclaradas()).toContain('lib/storage/safeLocalStorage.ts')
  })
})
