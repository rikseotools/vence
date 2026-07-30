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

  // ── El mismo fallo, un día después y en otro sitio ────────────────────────────────────
  //
  // El 30/07 volvió a pasar DOS veces en `lib/referrals/queries.ts`, escribiendo consultas
  // nuevas: un comentario `-- El asunto NO puede llevar \`giftcard_ref\`…` cerró el template
  // literal otra vez. Este guardarraíl existía y no lo cazó, porque solo miraba los tres
  // `.cjs` de cron. El typecheck sí lo pilla en TypeScript (por eso no llegó a producción),
  // pero avisa con un error de sintaxis a 200 líneas de distancia que cuesta leer.
  //
  // Así que ahora se revisa también el TypeScript que escribe SQL: es donde se está
  // escribiendo, y donde el patrón se repite. Comentario SQL (`--`) con backtick dentro.
  it('ningún comentario SQL de las consultas en TypeScript lleva backticks', () => {
    // Se revisa TODO fichero que escriba SQL, no una lista.
    //
    // La primera versión enumeraba cuatro ficheros «los que escriben consultas», y el mismo
    // día volvió a pasar en un QUINTO (`lib/referrals/activeSignup.ts`) que no estaba en la
    // lista. Una lista blanca solo protege lo que alguien se acordó de meter, y justo lo que
    // se está escribiendo hoy es lo que nunca está.
    const { readFileSync, readdirSync, statSync } = require('fs') as typeof import('fs')
    const conSql: string[] = []
    const visitar = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === '.next') continue
        const p = join(dir, e)
        if (statSync(p).isDirectory()) visitar(p)
        else if (/\.(ts|tsx)$/.test(e)) {
          const src = readFileSync(p, 'utf8')
          // Marca de consulta: template literal etiquetado `sql\`` (Drizzle) o `.query(\``.
          if (/sql`|\.query\(\s*`/.test(src)) conSql.push(p)
        }
      }
    }
    for (const raiz of ['lib', 'app', 'db', 'backend/src']) {
      const abs = join(RAIZ, raiz)
      if (existsSync(abs)) visitar(abs)
    }
    expect(conSql.length).toBeGreaterThan(10) // si no, el barrido no está mirando nada

    const culpables: string[] = []
    for (const abs of conSql) {
      readFileSync(abs, 'utf8').split('\n').forEach((linea, i) => {
        if (linea.trimStart().startsWith('--') && linea.includes('`')) {
          culpables.push(`${abs.replace(RAIZ + '/', '')}:${i + 1} → ${linea.trim().slice(0, 70)}`)
        }
      })
    }
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })

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
