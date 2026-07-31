// __tests__/guardrails/testDbHelper.guardrail.test.ts
//
// Impide que vuelva a aparecer una conexión a RDS SIN configuración de SSL en los
// tests. No es estilo: es el fallo que dejó 14 suites rojas y mudas (T-377).
//
// Desde el cutover a RDS (04/07/2026) la URL lleva `sslmode=require`; node-postgres
// lo traduce a verificación de CA y el certificado de RDS lo firma una CA privada,
// así que `new Client({ connectionString: DB_URL })` muere con
// `self-signed certificate in certificate chain` ANTES de mirar un solo dato.
// Medido: 51 de los 80 fallos del job de integración eran ese error, contados
// durante meses como "rojo de contenido".
//
// La cura vive en `__tests__/helpers/db.ts` (testDbConfig/openTestClient/openTestPool).
// Este guardarraíl exige que TODA conexión pase por ahí — y a propósito NO acepta el
// «ya lleva un `ssl`», porque esa era la cura falsa: con el `sslmode` todavía en la
// URL, la opción `ssl` no se aplica y la conexión muere igual.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { sinSslMode } from '../helpers/db'

const RAIZ = join(__dirname, '..')

/**
 * Exentos: los ficheros que NOMBRAN el patrón sin usarlo.
 *  · `helpers/db.ts` ES la puerta única: define la configuración que los demás reutilizan.
 *  · `testDbHelper.guardrail.test.ts` (este) tiene que escribir los patrones para buscarlos.
 *  · `suiteRegistry.guardrail.test.ts` (31/07) los lista en su `MARCAS_BD` por el mismo
 *    motivo: es OTRO detector, y para detectar «esta suite habla con la BD» necesita
 *    escribir `new Client(` como literal. Sin esta exención, un detector delata a otro
 *    por mencionar aquello que ambos vigilan — falso positivo puro que dejó `main` en
 *    ROJO y bloqueó el pre-commit de todas las sesiones.
 */
const EXENTOS = new Set([
  'helpers/db.ts',
  'guardrails/testDbHelper.guardrail.test.ts',
  'guardrails/suiteRegistry.guardrail.test.ts',
])

function ficherosDeTest(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const abs = join(dir, e)
    const rel = base ? `${base}/${e}` : e
    if (statSync(abs).isDirectory()) out.push(...ficherosDeTest(abs, rel))
    else if (e.endsWith('.ts') || e.endsWith('.tsx')) out.push(rel)
  }
  return out
}

/**
 * Devuelve las conexiones que NO pasan por la puerta única.
 *
 * Ojo con la tentación de aceptar «lleva un `ssl`»: eso fue exactamente la CURA
 * FALSA. `{ connectionString: <url con sslmode>, ssl: {...} }` parece correcto y NO
 * conecta, porque el `sslmode` de la URL pisa la opción. Por eso lo único que vale
 * aquí es `testDbConfig()` / `openTestClient()` / `openTestPool()`, que además
 * quitan el `sslmode`. Una conexión sin argumentos (libpq/env) se deja pasar.
 */
function conexionesFueraDelHelper(src: string): string[] {
  const malas: string[] = []
  const re = /new\s+(Client|Pool)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const desde = m.index
    // Una MENCIÓN entrecomillada no es una conexión (31/07/2026). `suiteRegistry.guardrail`
    // lleva `'new Client('` en su LISTA DE PATRONES —es otro guardarraíl que busca justo esto—
    // y aquí salía como infractor: `main` en rojo y el deploy de todas las sesiones parado por
    // un falso positivo entre dos guardas que se vigilan la una a la otra.
    // Basta mirar el carácter anterior: si abre comilla, es texto citado, no código.
    if (/['"`]/.test(src[desde - 1] || '')) continue
    // Los argumentos van del `(` que abre hasta el `)` que lo CIERRA, balanceando:
    // cortar en el primer `)` se comía el `ssl` de las formas repartidas en varias líneas.
    const abre = desde + m[0].length - 1
    let prof = 0
    let cierra = abre
    for (let i = abre; i < src.length && i < abre + 800; i++) {
      if (src[i] === '(') prof++
      else if (src[i] === ')') { prof--; if (prof === 0) { cierra = i; break } }
    }
    const args = src.slice(desde, cierra + 1)
    const usaHelper = /testDbConfig\s*\(|openTestClient|openTestPool/.test(args)
    // `new Client()` sin argumentos lee libpq/env: no es el patrón que rompe
    const sinArgs = /new\s+(Client|Pool)\s*\(\s*\)/.test(args)
    if (!usaHelper && !sinArgs) malas.push(args.split('\n')[0].trim())
  }
  return malas
}

describe('guardarraíl — los tests conectan a RDS por la puerta única', () => {
  const ficheros = ficherosDeTest(RAIZ).filter(f => !EXENTOS.has(f))

  test('el helper compartido existe y exporta la configuración', () => {
    const src = readFileSync(join(RAIZ, 'helpers/db.ts'), 'utf8')
    expect(src).toMatch(/export function testDbConfig/)
    expect(src).toMatch(/rejectUnauthorized:\s*false/)
  })

  test('ningún test abre su propia conexión: todas pasan por el helper', () => {
    const infractores: string[] = []
    for (const f of ficheros) {
      const malas = conexionesFueraDelHelper(readFileSync(join(RAIZ, f), 'utf8'))
      for (const linea of malas) infractores.push(`${f} → ${linea}`)
    }
    expect(infractores).toEqual([])
  })

  // El `sslmode` de la URL PISA la opción `ssl` en node-postgres: si no se quita,
  // el helper no cura nada (medido: con sslmode → self-signed; sin él → conecta).
  describe('sinSslMode — la parte que de verdad hace el trabajo', () => {
    test('lo quita cuando es el único parámetro (y no deja el "?" colgando)', () => {
      expect(sinSslMode('postgres://u:p@h:5432/db?sslmode=require')).toBe('postgres://u:p@h:5432/db')
    })
    test('lo quita conservando los demás parámetros', () => {
      expect(sinSslMode('postgres://u:p@h:5432/db?a=1&sslmode=require')).toBe('postgres://u:p@h:5432/db?a=1')
      expect(sinSslMode('postgres://u:p@h:5432/db?sslmode=require&b=2')).toBe('postgres://u:p@h:5432/db?b=2')
    })
    test('una URL sin sslmode se queda igual', () => {
      expect(sinSslMode('postgres://u:p@h:5432/db?a=1')).toBe('postgres://u:p@h:5432/db?a=1')
    })
  })

  test('el detector caza las tres formas que hubo en el repo, incluida la cura falsa', () => {
    // (a) pelada: no conectaba
    expect(conexionesFueraDelHelper("client = new Client({ connectionString: DB_URL })")).toHaveLength(1)
    // (b) con `ssl` a mano pero SIN quitar el sslmode: la CURA FALSA. Parece bien y
    //     tampoco conecta — si el guardarraíl la aceptara, no protegería de nada.
    expect(conexionesFueraDelHelper("new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })")).toHaveLength(1)
    // (c) quitando el sslmode a mano: funciona, pero es la 4ª copia de la misma receta
    expect(conexionesFueraDelHelper("new Client({\n  connectionString: urlSinSslMode(DB_URL),\n  ssl: { rejectUnauthorized: false },\n})")).toHaveLength(1)
    // (d) por la puerta única: lo único que se acepta
    expect(conexionesFueraDelHelper('new Client(testDbConfig())')).toHaveLength(0)
    expect(conexionesFueraDelHelper('new Client()')).toHaveLength(0)
  })

  // 31/07/2026 — `main` en ROJO y el deploy de todas las sesiones parado por esto: otro
  // guardarraíl (`suiteRegistry`) lleva `'new Client('` en su lista de PATRONES, porque busca
  // justo esta forma. Una mención entrecomillada no es una conexión.
  test('una MENCIÓN entre comillas no es una conexión (dos guardas vigilándose)', () => {
    expect(conexionesFueraDelHelper("const PATRONES = ['getReadDb', 'new Client(', \"from 'pg'\"]")).toHaveLength(0)
    expect(conexionesFueraDelHelper('const p = "new Client({ connectionString: X })"')).toHaveLength(0)
    expect(conexionesFueraDelHelper('const p = `new Client({ connectionString: X })`')).toHaveLength(0)
    // …y la de verdad, en la MISMA cadena de texto, sigue cazándose
    expect(conexionesFueraDelHelper("const P = ['new Client(']\nclient = new Client({ connectionString: DB_URL })")).toHaveLength(1)
  })
})
