// GUARDARRAÍL: ningún test de la APP puede simular un proveedor de auth concreto.
//
// ## De dónde sale (30/07/2026)
//
// La app habla con un puerto (`@/lib/auth`) que tiene un adaptador por proveedor. Pero cinco
// ficheros de test mockeaban `lib/supabase` —el proveedor— en vez del puerto. Mientras el
// valor por defecto fue Supabase nadie lo notó. El día que ese default pasó a Auth.js, que
// es lo que corre en producción desde el 03/07, **60 tests se cayeron de golpe sin que el
// código bajo prueba hubiera cambiado una sola línea**.
//
// Lo grave no fueron los 60 rojos, sino lo que revelaron: llevaban semanas **verdes probando
// un proveedor que ya no usa nadie**. No cubrían la app real, así que tampoco habrían
// avisado de una regresión en ella. Un test acoplado al proveedor anula exactamente aquello
// para lo que existe un puerto, y encima da una sensación de cobertura que no existe.
//
// Regla: los tests de la app simulan el PUERTO (con `__tests__/helpers/authPortHarness`).
// Los únicos que pueden conocer un proveedor son los del propio adaptador.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const TESTS = join(RAIZ, '__tests__')

/**
 * Quién SÍ puede nombrar un proveedor concreto:
 *  - los tests de los adaptadores y del puerto (su trabajo es justamente ese);
 *  - los que prueban la verificación de tokens server-side (HS256 legacy vs RS256), que es
 *    una frontera real con el proveedor, no una dependencia de la app;
 *  - este mismo guardarraíl.
 */
const PERMITIDOS = [
  '__tests__/lib/auth/',
  '__tests__/guardrails/testsNoAtadosAlProveedorAuth.test.ts',
  '__tests__/guardrails/tokenDesdeElPuerto.test.ts',
  '__tests__/security/',
  '__tests__/api/auth/',
]

/**
 * Devuelve el texto de la llamada que empieza en `desde`, contando paréntesis. Sin esto no se
 * puede distinguir «qué hay dentro de ESTE jest.mock» de «qué hay en el fichero».
 */
function recortarLlamada(src: string, desde: number): string {
  const abre = src.indexOf('(', desde)
  if (abre === -1) return ''
  let prof = 0
  for (let i = abre; i < src.length; i++) {
    if (src[i] === '(') prof++
    else if (src[i] === ')') {
      prof--
      if (prof === 0) return src.slice(desde, i + 1)
    }
  }
  return src.slice(desde)
}

function ficherosDeTest(dir: string): string[] {
  const out: string[] = []
  const visitar = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) visitar(p)
      else if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(e)) out.push(p)
    }
  }
  visitar(dir)
  return out
}

describe('los tests de la app no se atan a un proveedor de auth', () => {
  const ficheros = ficherosDeTest(TESTS)

  it('hay tests que revisar (si no, este guardarraíl no protege nada)', () => {
    expect(ficheros.length).toBeGreaterThan(100)
  })

  it('nadie mockea `lib/supabase` para simular la AUTENTICACIÓN', () => {
    const culpables: string[] = []
    for (const abs of ficheros) {
      const rel = abs.replace(RAIZ + '/', '')
      if (PERMITIDOS.some((ok) => rel.startsWith(ok))) continue
      const src = readFileSync(abs, 'utf8')
      // Mockear `lib/supabase` sigue siendo legítimo para DATOS legacy (`.from(...)`); lo que
      // no vale es usarlo para la SESIÓN.
      //
      // Ojo al alcance: hay que mirar DENTRO del `jest.mock` de `lib/supabase`, no en todo el
      // fichero. Buscar `auth: {` a lo ancho marcaba como culpable a quien lo hacía bien —
      // mock del proveedor solo para datos y mock aparte del puerto para la sesión— y un
      // guardarraíl que grita en falso acaba desactivado por quien le toque sufrirlo.
      for (const m of src.matchAll(/jest\.(mock|doMock)\(\s*['"][^'"]*lib\/supabase['"]/g)) {
        const bloque = recortarLlamada(src, m.index ?? 0)
        if (/auth:\s*\{/.test(bloque) &&
            /(getSession|getUser|onAuthStateChange|refreshSession)/.test(bloque)) {
          culpables.push(rel)
          break
        }
      }
    }
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })

  it('el harness del puerto existe y expone la superficie completa de `AuthClientPort`', () => {
    // Si el puerto crece y el harness no, un test pasaría por casualidad (método ausente →
    // `undefined is not a function` en el mejor caso, o un camino no ejercitado en el peor).
    const harness = readFileSync(join(TESTS, 'helpers/authPortHarness.ts'), 'utf8')
    const puerto = readFileSync(join(RAIZ, 'lib/auth/types.ts'), 'utf8')
    const interfaz = puerto.slice(puerto.indexOf('export interface AuthClientPort'))
    const metodos = Array.from(interfaz.matchAll(/^\s{2}([a-zA-Z]+)\(/gm)).map((m) => m[1])
    expect(metodos.length).toBeGreaterThan(5)
    const ausentes = metodos.filter((m) => !harness.includes(`${m}:`))
    expect(ausentes.join(', ') || 'ninguno').toBe('ninguno')
  })
})
