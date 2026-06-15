/** @jest-environment node */
// __tests__/integration/topicScopeHelperUsage.test.ts
//
// GUARDARRAÍL DE CÓDIGO (complementa a topicScopeNullCoverage.test.ts).
//
// El test de cobertura valida el DATO (con la condición canónica), pero NO podía
// cazar un fetcher que reimplementara el scope con un `= ANY(...)` suelto: la
// query del test usa la condición buena, no el código real. Por eso el bug de
// `random-test-data` (feature "mezclar temas", feedback Rosa 2026-06-15) y el de
// `user-failed-questions` pasaron desapercibidos pese a existir el guardarraíl
// de datos.
//
// Este test escanea el CÓDIGO FUENTE: cualquier `= ANY(...)` aplicado a
// article_numbers / articleNumbers DEBE ir con la guarda `IS NULL OR ...`
// (o, mejor, usar el helper `articleInScope`). La convención del modelo es
// `topic_scope.article_numbers IS NULL` = "toda la ley"; un `= ANY(NULL)`
// devuelve NULL y sirve 0 preguntas.
//
// CI-safe: no necesita DB, solo lee archivos.

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const LIB_DIR = join(process.cwd(), 'lib')
// El helper canónico es la única fuente legítima del `= ANY` desnudo.
const ALLOWED = new Set([join('lib', 'api', '_shared', 'topicScopeSql.ts')])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('Guardarraíl de código: scope de artículos siempre NULL-safe', () => {
  it('ningún `= ANY(...articleNumbers)` sin guarda IS NULL fuera del helper', () => {
    const offenders: string[] = []

    for (const file of walk(LIB_DIR)) {
      const rel = file.slice(process.cwd().length + 1)
      if (ALLOWED.has(rel)) continue

      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        const hasAny = /=\s*ANY\(/.test(line)
        const refsArticleNumbers = /[Aa]rticle_?[Nn]umbers/.test(line)
        if (!hasAny || !refsArticleNumbers) return
        // La guarda `IS NULL` puede ir en la misma línea (forma inline) o en
        // líneas previas (condición SQL multilínea: `... IS NULL\n OR ... = ANY`).
        // Miramos una ventana de las 3 líneas anteriores + la actual.
        const windowText = lines.slice(Math.max(0, i - 3), i + 1).join(' ')
        if (!/IS NULL/i.test(windowText)) {
          offenders.push(`  ${rel}:${i + 1}  ${line.trim().slice(0, 100)}`)
        }
      })
    }

    if (offenders.length > 0) {
      throw new Error(
        `${offenders.length} uso(s) de \`= ANY(...articleNumbers)\` sin guarda ` +
          `\`IS NULL\` (usa articleInScope() de lib/api/_shared/topicScopeSql):\n` +
          offenders.join('\n'),
      )
    }

    expect(offenders.length).toBe(0)
  })
})
