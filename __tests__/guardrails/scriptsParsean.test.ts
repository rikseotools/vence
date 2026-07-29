// GUARDARRAÍL: los scripts que corren en cron TIENEN que parsear.
//
// ## Qué pasó (29/07/2026)
//
// `scripts/health-sweep.cjs` llevaba **19 horas sin parsear** en `main`. Un comentario
// dentro de una consulta SQL escrita como template literal contenía backticks:
//
//     const linkRows = (await c.query(`
//       SELECT …
//       -- `programa_url` a pelo y marca URLs que el opositor no ve      ← cierra el template
//
// El backtick del comentario CERRABA el template literal de JavaScript y el fichero
// entero dejaba de ser válido. Nadie se enteró: el sweep es un `.cjs` que solo se ejecuta
// desde el cron nocturno, así que ni el typecheck (no cubre .cjs), ni el linter, ni los
// tests lo tocaban. El barrido de las 03:00 no corrió y `content_health_findings` se
// quedó congelado — el badge de salud del contenido seguía en verde enseñando datos
// viejos, que es el peor fallo posible en un sistema cuyo trabajo es avisar.
//
// Es el mismo patrón que el catch-all de señales: el sistema que vigila no se vigilaba.
//
// Este test compila (sin ejecutar) todos los scripts que el cron invoca.
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()

/**
 * Scripts que corren solos (cron in-process del backend o GitHub Actions). Si uno de
 * estos no parsea, deja de vigilar en silencio, que es peor que fallar ruidosamente.
 */
const SCRIPTS_DE_CRON = [
  'scripts/health-sweep.cjs',
  'scripts/fraud-sweep.cjs',
  'scripts/backlog.cjs',
]

describe('los scripts que corren en cron parsean', () => {
  for (const rel of SCRIPTS_DE_CRON) {
    it(`${rel} es JavaScript válido`, () => {
      const abs = join(RAIZ, rel)
      if (!existsSync(abs)) return // un script retirado no debe romper el guardarraíl
      // `node --check` compila sin ejecutar: no toca la base de datos ni la red.
      expect(() => execFileSync('node', ['--check', abs], { stdio: 'pipe' })).not.toThrow()
    })
  }

  it('ningún comentario SQL dentro de un template literal lleva backticks', () => {
    // La causa exacta del incidente. Se comprueba aparte del `--check` porque el mensaje
    // de Node ("missing ) after argument list") no dice ni de lejos dónde está el problema.
    const { readFileSync } = require('fs') as typeof import('fs')
    const culpables: string[] = []
    for (const rel of SCRIPTS_DE_CRON) {
      const abs = join(RAIZ, rel)
      if (!existsSync(abs)) continue
      readFileSync(abs, 'utf8').split('\n').forEach((linea, i) => {
        if (linea.trimStart().startsWith('--') && linea.includes('`')) {
          culpables.push(`${rel}:${i + 1} → ${linea.trim().slice(0, 80)}`)
        }
      })
    }
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })
})
