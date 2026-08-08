/**
 * @jest-environment node
 *
 * [T-624] Trinquete: la credencial de lectura de negocio se elige en UN sitio.
 *
 * El 06/08/2026 había CUATRO scripts con su propia versión de `VENCE_LECTOR_URL || DATABASE_URL`
 * (`audit-temario-display-drift`, `health/kinds-evaluados`, `temario/revisar-oposicion`,
 * `impugnaciones/revisar-impugnacion`). Cuatro copias del mismo criterio son cuatro sitios donde
 * arreglarlo, y ninguna miraba `.env.local` —salvo una— así que un trabajador cuya credencial
 * vive en el fichero se quedaba fuera. Es el patrón de los cinco escritores de `seguimiento_url`
 * ([T-130]) una capa más abajo.
 *
 * Este guardarraíl NO prohíbe nombrar la variable (los comentarios y los mensajes de error deben
 * poder hacerlo): prohíbe **volver a escribir la elección**.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const DIRS = ['scripts', 'lib', 'app', 'backend/src']

/**
 * El punto único, lo que lo fija, y la PROSA que lo describe: no se cuentan a sí mismos.
 *
 * `toolRegistry.ts` entra aquí porque es documentación: sus `notas` citan literalmente el patrón
 * prohibido para explicar qué defecto se previene, y en un fichero `.ts` eso es una cadena, no un
 * comentario, así que `sinComentarios` no lo salva. Exentarlo es correcto —no hay ninguna
 * conexión que se abra desde el registro— y lo contrario obligaría a describir el defecto sin
 * nombrarlo, que es cómo se pierde la explicación.
 */
const EXENTOS = [
  'lib/db/negocioSoloLectura.cjs',
  '__tests__/lib/db/negocioSoloLectura.test.ts',
  '__tests__/guardrails/credencialLectura.guardrail.test.ts',
  'lib/admin/toolRegistry.ts',
]

/**
 * La ELECCIÓN, no la mención: `VENCE_LECTOR_URL` y `DATABASE_URL` combinados con `||` o con un
 * ternario en la misma expresión. Un `console.error('falta VENCE_LECTOR_URL o DATABASE_URL')` no
 * casa, y debe seguir sin casar: decirlo es útil, decidirlo dos veces no.
 */
const ELIGE = /VENCE_LECTOR_URL[^\n]{0,80}(\|\||\?)[^\n]{0,80}DATABASE_URL/

/**
 * Quita comentarios antes de juzgar. Sin esto el guardarraíl se caza a sí mismo: el comentario
 * que explica POR QUÉ ya no se hace («eran cuatro copias del mismo `VENCE_LECTOR_URL ||
 * DATABASE_URL`») casa con el patrón. Un detector que prohíbe explicar el defecto que previene
 * acaba borrando la explicación, que es peor que el defecto.
 */
function sinComentarios(txt: string): string {
  return txt
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // bloque
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1') // línea (el `[^:]` evita comerse un https://)
}

function ficheros(dir: string, out: string[] = []): string[] {
  let entradas: string[]
  try { entradas = readdirSync(join(RAIZ, dir)) } catch { return out }
  for (const e of entradas) {
    if (e === 'node_modules' || e === '.next' || e === 'dist' || e.startsWith('.')) continue
    const rel = `${dir}/${e}`
    const abs = join(RAIZ, rel)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) ficheros(rel, out)
    else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e)) out.push(rel)
  }
  return out
}

describe('[T-624] guardarraíl — la credencial de lectura se elige en un solo sitio', () => {
  const todos = DIRS.flatMap((d) => ficheros(d))

  it('encuentra ficheros que auditar (si esto falla, el guardarraíl se quedó ciego)', () => {
    expect(todos.length).toBeGreaterThan(300)
  })

  it('nadie vuelve a escribir el `VENCE_LECTOR_URL || DATABASE_URL`', () => {
    const culpables = todos
      .filter((f) => !EXENTOS.includes(f))
      .filter((f) => {
        let txt = ''
        try { txt = readFileSync(join(RAIZ, f), 'utf8') } catch { return false }
        return ELIGE.test(sinComentarios(txt))
      })
    // El detalle va DENTRO del valor comparado: así el fallo dice QUÉ fichero, no solo que falla.
    expect({ copiasDelCriterio: culpables }).toEqual({ copiasDelCriterio: [] })
  })

  it('el punto único sigue existiendo y exportando lo que los demás usan', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../lib/db/negocioSoloLectura.cjs')
    expect(typeof mod.resolver).toBe('function')
    expect(typeof mod.urlLecturaNegocio).toBe('function')
    expect(typeof mod.urlLecturaNegocioConFuente).toBe('function')
  })

  it('[T-152] audit-landing.cjs sigue usando el punto único, no DATABASE_URL a pelo', () => {
    // Hasta el 08/08/2026 `conectar()` solo aceptaba `process.env.DATABASE_URL` (rol de
    // coordinación, sin acceso a `oposiciones_ssot` desde [T-539]) — un trabajador de la flota
    // con `VENCE_LECTOR_URL` no podía correr esta auditoría, que es justo la PUERTA que su
    // propia ficha ([T-152]) le pide pasar antes de proponer un envío. Regresión concreta: si
    // alguien vuelve a leer `process.env.DATABASE_URL` directamente aquí (a mano, «para
    // simplificar»), este test lo caza sin depender de una credencial real.
    const ruta = 'scripts/convocatoria/audit-landing.cjs'
    const txt = readFileSync(join(RAIZ, ruta), 'utf8')
    expect(txt).toMatch(/require\([^)]*negocioSoloLectura\.cjs['"]?\)/)
    expect(txt).toMatch(/urlLecturaNegocio\(\)/)
    expect(sinComentarios(txt)).not.toMatch(/postgres\(\s*process\.env\.DATABASE_URL/)
  })

  it('MENCIONAR las dos variables sigue permitido (avisos y comentarios)', () => {
    // Contraste explícito: si esto empezara a fallar, el guardarraíl se habría vuelto un estorbo
    // y la salida sería borrar los mensajes útiles, que es peor que el problema original.
    expect(ELIGE.test('console.error("ni VENCE_LECTOR_URL ni DATABASE_URL configurados")')).toBe(false)
    expect(ELIGE.test(sinComentarios('// VENCE_LECTOR_URL es lectura; DATABASE_URL es coordinación'))).toBe(false)
    // El caso que se cazó a sí mismo el 06/08: el comentario que EXPLICA el defecto prevenido.
    expect(ELIGE.test(sinComentarios('// eran cuatro copias de `VENCE_LECTOR_URL || DATABASE_URL`'))).toBe(false)
    // …y la elección sí casa, en sus dos formas.
    expect(ELIGE.test('const u = process.env.VENCE_LECTOR_URL || process.env.DATABASE_URL')).toBe(true)
    expect(ELIGE.test('const u = env.VENCE_LECTOR_URL ? env.VENCE_LECTOR_URL : env.DATABASE_URL')).toBe(true)
  })
})
