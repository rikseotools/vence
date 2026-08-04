/**
 * @jest-environment node
 */
// El gate de tests del pre-commit no puede auto-excluirse. (T-486, 04/08/2026)
//
// ── EL FALLO, MEDIDO ────────────────────────────────────────────────────────────────────────
// `test:unit` llevaba `--testPathIgnorePatterns='.claude/worktrees/'`. La intención era buena: que
// el checkout principal no recogiera los tests de los worktrees anidados y los corriera dos veces.
//
// Pero `testPathIgnorePatterns` son expresiones regulares contra la ruta ABSOLUTA, así que dentro
// de un worktree de agente —cuya ruta ES `…/.claude/worktrees/agent-xxx/…`— el patrón casa con
// TODO. Medido: **1.143 ficheros de test visibles sin el patrón, 0 con él**. Y como el script
// lleva `--passWithNoTests`, jest sale 0 y el `pre-commit` imprime `✅ Pre-commit OK` **sin haber
// ejecutado un solo test**.
//
// No es un caso raro: es el estado NORMAL de cualquier sesión de agente de Claude Code, que trabaja
// precisamente en `.claude/worktrees/`. O sea, el gate estaba apagado justo para las sesiones que
// menos supervisión humana tienen.
//
// El arreglo es anclar el patrón a `<rootDir>`, que jest expande a la raíz del proyecto ACTUAL:
// desde el principal sigue excluyendo lo anidado; desde dentro de un worktree, ya no se excluye a
// sí mismo. Verificado en los dos sentidos antes de escribirlo.
//
// Este guardarraíl existe porque el patrón sin anclar es más corto y se lee bien: volvería a
// entrar en un `sed` distraído y nadie lo notaría — un gate vacío no falla, felicita.

const fs = require('fs')
const path = require('path')

const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))

/** Los patrones de exclusión declarados en un script de npm. */
const ignorePatterns = (script: string): string[] =>
  [...String(script || '').matchAll(/--testPathIgnorePatterns=(?:'([^']*)'|"([^"]*)"|(\S+))/g)]
    .map((m) => m[1] ?? m[2] ?? m[3])

describe('el gate de tests no puede excluirse a sí mismo', () => {
  // Cualquier script que corra tests y excluya por ruta: si mañana nace `test:ci`, entra solo.
  const scripts = Object.entries(pkg.scripts as Record<string, string>)
    .filter(([, cmd]) => /\bjest\b/.test(cmd) && /--testPathIgnorePatterns=/.test(cmd))

  it('hay scripts que vigilar (si no, este guardarraíl estaría mirando al vacío)', () => {
    expect(scripts.length).toBeGreaterThan(0)
  })

  it.each(scripts)('«%s» ancla a <rootDir> todo patrón que nombre .claude/worktrees', (nombre, cmd) => {
    const sinAnclar = ignorePatterns(cmd).filter(
      (p) => p.includes('.claude/worktrees') && !p.startsWith('<rootDir>'),
    )
    expect(sinAnclar).toEqual([])
  })

  // El otro lado del trinquete: sin `<rootDir>`, `.claude/worktrees/` casa con la ruta absoluta de
  // un worktree de agente y se lleva por delante los 1.143 ficheros de test. Se comprueba con la
  // misma semántica de jest (regex contra ruta absoluta), no con una teoría sobre ella.
  it('sin anclar, la ruta de un worktree de agente casaría con su propio patrón', () => {
    const rutaDeAgente = '/home/u/repo/.claude/worktrees/agent-abc/__tests__/algo.test.ts'
    expect(new RegExp('.claude/worktrees/').test(rutaDeAgente)).toBe(true)
    expect(new RegExp('<rootDir>/.claude/worktrees/').test(rutaDeAgente)).toBe(false)
  })

  it('`--passWithNoTests` sigue ahí, y por eso un gate vacío NO fallaría solo', () => {
    // No se propone quitarlo (hace falta para `test:precommit`), pero deja constancia de por qué
    // este guardarraíl es necesario: sin él, cero tests se lee como éxito.
    expect(pkg.scripts['test:unit']).toContain('--passWithNoTests')
  })
})
