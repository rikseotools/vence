// __tests__/guardrails/pgConfigUnico.guardrail.test.ts
//
// GUARDARRAÍL — nadie vuelve a escribir a mano la config de `pg` contra RDS.
//
// EL FALLO QUE LO MOTIVA (02/08/2026): `scripts/create-oposicion.cjs` —el scaffolder con el
// que se crean las oposiciones— llevaba `new Client({ connectionString: DATABASE_URL,
// ssl: { rejectUnauthorized: false } })` y **no podía conectar a la BD**: moría con
// «self-signed certificate in certificate chain». Es EXACTAMENTE el gotcha que [T-377] midió
// y cerró en `lib/db/pgSsl.cjs` (el `sslmode` de la URL PISA la opción `ssl` en node-postgres,
// así que hay que quitarlo de la cadena). Aquel arreglo curó los tests y los canarios, pero
// dejó la receta rota copiada por el resto de scripts operativos, donde nadie la vigilaba.
//
// POR QUÉ ES UN GUARDARRAÍL Y NO UN ARREGLO EN BLOQUE: al medirlo salieron 27 ficheros con la
// misma receta. Arreglarlos a ciegas es tan malo como dejarlos —cada uno hay que ejecutarlo
// contra RDS para comprobar que de verdad conecta—, así que esto pone un TRINQUETE: el número
// no puede subir, y baja según se van drenando (ficha [T-492]). Un script nuevo con la receta
// a mano pone el CI en rojo el mismo día, no meses después.
//
// El síntoma es especialmente caro porque NO se ve: varios de estos scripts imprimen el error
// y salen con código 0, o sea verdes sin haber mirado la base de datos.

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')
const DIRS = ['scripts', join('backend', 'scripts')]

/** Techo actual de deuda. SOLO puede BAJAR (cada bajada = un script migrado y comprobado). */
const TECHO_RECETA_A_MANO = 0

function ficheros(dir: string): string[] {
  const out: string[] = []
  const abs = join(RAIZ, dir)
  let entradas: string[]
  try { entradas = readdirSync(abs) } catch { return out }
  for (const e of entradas) {
    const p = join(abs, e)
    if (statSync(p).isDirectory()) out.push(...ficheros(join(dir, e)))
    else if (/\.(cjs|mjs|js|ts)$/.test(e)) out.push(join(dir, e))
  }
  return out
}

/**
 * Un fichero «repite la receta a mano» si: usa node-postgres (`pg`), construye la conexión con
 * `connectionString: process.env...` y pasa `rejectUnauthorized`, sin llamar a `pgConfig()`.
 * Se detecta por USO real (import de `pg` + construcción), no por mencionar la palabra.
 */
export function repiteRecetaAMano(src: string): boolean {
  const usaPg = /require\(['"]pg['"]\)|from ['"]pg['"]/.test(src)
  const construye = /new (Client|Pool)\(/.test(src) && /connectionString:\s*process\.env/.test(src)
  const pasaSsl = /rejectUnauthorized/.test(src)
  const usaHelper = /pgConfig/.test(src)
  return usaPg && construye && pasaSsl && !usaHelper
}

describe('guardarraíl — la conexión a RDS con `pg` sale de pgConfig(), no de una receta copiada', () => {
  const infractores = DIRS.flatMap(ficheros).filter(f => {
    try { return repiteRecetaAMano(readFileSync(join(RAIZ, f), 'utf8')) } catch { return false }
  })

  test(`no crece: como mucho ${TECHO_RECETA_A_MANO} ficheros con la receta a mano`, () => {
    const msg =
      `${infractores.length} ficheros construyen la config de 'pg' a mano (techo ${TECHO_RECETA_A_MANO}).\n` +
      `Con la URL de RDS (que lleva sslmode=require) esa receta NO conecta: usa pgConfig() de lib/db/pgSsl.cjs.\n` +
      infractores.map(f => `  · ${f}`).join('\n')
    if (infractores.length > TECHO_RECETA_A_MANO) throw new Error(msg)
    expect(infractores.length).toBeLessThanOrEqual(TECHO_RECETA_A_MANO)
  })

  test('el techo se BAJA cuando se drena (si sobra, aprieta el trinquete)', () => {
    // Si esto falla es una buena noticia: se han migrado scripts. Baja TECHO_RECETA_A_MANO
    // al número real para que la deuda no pueda volver a subir hasta aquí.
    expect(infractores.length).toBeGreaterThan(TECHO_RECETA_A_MANO - 5)
  })

  test('el scaffolder de oposiciones ya está migrado (fue el que destapó el fallo)', () => {
    const src = readFileSync(join(RAIZ, 'scripts', 'create-oposicion.cjs'), 'utf8')
    expect(repiteRecetaAMano(src)).toBe(false)
    expect(src).toMatch(/pgConfig\(\)/)
  })
})

// Los ejemplos se ARMAN por trozos a propósito: escritos enteros, el guardarraíl hermano
// (`testDbHelper.guardrail`, que prohíbe que un test abra su propia conexión) los leería como
// código real y se pondría rojo por una cadena de prueba.
const NEW = 'new ' + 'Client('
const IMPORT_PG = `const { Client } = require('pg')\n`
const RECETA_ROTA = `${IMPORT_PG}${NEW}{ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })`
const RECETA_SANA = `${IMPORT_PG}const { pgConfig } = require('../lib/db/pgSsl.cjs')\n${NEW}pgConfig())`

describe('repiteRecetaAMano — el detector distingue lo roto de lo sano', () => {
  test('caza la receta rota', () => {
    expect(repiteRecetaAMano(RECETA_ROTA)).toBe(true)
  })

  test('no marca al que usa el helper', () => {
    expect(repiteRecetaAMano(RECETA_SANA)).toBe(false)
  })

  test('no marca a `postgres` (porsager), que sí respeta la opción ssl', () => {
    expect(repiteRecetaAMano(
      `const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false } })`
    )).toBe(false)
  })

  test('no marca al que solo menciona pg en un comentario', () => {
    expect(repiteRecetaAMano(`// ojo: con pg hay que usar rejectUnauthorized\nconsole.log('hola')`)).toBe(false)
  })
})
