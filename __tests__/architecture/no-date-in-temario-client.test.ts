// __tests__/architecture/no-date-in-temario-client.test.ts
//
// Test de ARQUITECTURA — bloquea por construcción el bug hydration React #418
// que descubrimos 2026-05-26 en TopicContentView de 76 oposiciones.
//
// Regla: ningún componente cliente ('use client') dentro de
// app/**/temario/[slug]/TopicContentView.tsx puede invocar `new Date()`,
// `Date.now()` o `Math.random()` directamente — son fuentes de no-determinismo
// que rompen la hidratación cuando el HTML se sirve desde ISR cache.
//
// Si necesitas la fecha "actualizado a X", el server component (page.tsx)
// debe calcularla con formatUpdatedAt() y pasarla como prop string al
// client component. Si necesitas un valor aleatorio, calcúlalo en useEffect
// tras el mount.

import { readFileSync } from 'fs'
import { glob } from 'glob'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

interface Violation {
  file: string
  pattern: string
  line: number
  preview: string
}

function findNonDeterministicCalls(file: string): Violation[] {
  const src = readFileSync(file, 'utf-8')

  // Solo nos importan los componentes cliente
  if (!src.includes("'use client'") && !src.includes('"use client"')) {
    return []
  }

  const lines = src.split('\n')
  const violations: Violation[] = []
  const patterns: Array<{ name: string; regex: RegExp }> = [
    { name: 'new Date(', regex: /\bnew\s+Date\s*\(/ },
    { name: 'Date.now(', regex: /\bDate\.now\s*\(/ },
    { name: 'Math.random(', regex: /\bMath\.random\s*\(/ },
    { name: 'performance.now(', regex: /\bperformance\.now\s*\(/ },
  ]

  lines.forEach((line, idx) => {
    // Saltar comentarios de una línea (mitigación básica — no detecta // dentro de string)
    const trimmed = line.trimStart()
    if (trimmed.startsWith('//')) return

    for (const { name, regex } of patterns) {
      if (regex.test(line)) {
        violations.push({
          file: path.relative(ROOT, file),
          pattern: name,
          line: idx + 1,
          preview: line.trim().slice(0, 120),
        })
      }
    }
  })
  return violations
}

describe('arquitectura: TopicContentView client components son deterministas', () => {
  it('ningún TopicContentView.tsx invoca new Date / Date.now / Math.random / performance.now', () => {
    const files = glob.sync('app/**/temario/[[]slug[]]/TopicContentView.tsx', { cwd: ROOT })
    expect(files.length).toBeGreaterThan(10) // sanity: debe haber muchos

    const allViolations: Violation[] = []
    for (const f of files) {
      allViolations.push(...findNonDeterministicCalls(path.join(ROOT, f)))
    }

    if (allViolations.length > 0) {
      const msg = allViolations
        .map((v) => `  ${v.file}:${v.line}  [${v.pattern}]  ${v.preview}`)
        .join('\n')
      throw new Error(
        `Encontradas ${allViolations.length} llamadas no-deterministas en TopicContentView ('use client'). ` +
          `Esto causa hydration mismatch React #418 con ISR cache.\n` +
          `Pasa el valor calculado desde page.tsx (server) como prop string.\n` +
          `Ver lib/temario/updatedAt.ts y docs/runbooks/observability.md.\n\n` +
          msg,
      )
    }
  })
})
