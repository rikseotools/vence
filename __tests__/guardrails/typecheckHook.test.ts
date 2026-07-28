/**
 * T-225 — el typecheck corre ANTES de que el rojo llegue a `main`.
 *
 * Dos cosas que este fichero fija, y las dos han fallado de verdad:
 *
 * 1. **La regla de relevancia** (`lib/hooks/typecheckRelevance.cjs`): qué push paga el peaje
 *    de `tsc` y cuál no. Es conservadora a propósito — ante la duda, se corre: un falso
 *    positivo cuesta ~14 s y un falso negativo es el `main` rojo que bloquea el deploy de
 *    todas las sesiones.
 *
 * 2. **El CABLEADO**: que el hook siga invocando el guard. Es el modo de fallo más silencioso
 *    posible — el script existe, sus tests pasan, y en la práctica no lo llama nadie (mismo
 *    patrón que el guardarraíl de `ALERT_RULES`: una regla escrita pero no registrada).
 *
 * Y la PARIDAD con `tsconfig.json`: si alguien mete `backend` en el typecheck de la raíz y el
 * hook sigue ignorándolo, el guard daría verde a un push que rompe el CI. Eso se detecta aquí.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { needsTypecheck, PREFIJOS_IGNORADOS } = require(join(ROOT, 'lib/hooks/typecheckRelevance.cjs'))

describe('needsTypecheck — qué push paga el peaje', () => {
  it('un push SOLO de documentación no cuesta nada', () => {
    const r = needsTypecheck([
      'docs/roadmap/tareas-pendientes.md',
      'docs/runbooks/observability.md',
      'CLAUDE.md',
    ])
    expect(r.correr).toBe(false)
  })

  it('tocar un .ts lo dispara', () => {
    expect(needsTypecheck(['lib/auth/tokenFreshness.ts']).correr).toBe(true)
  })

  it('tocar un .tsx lo dispara', () => {
    expect(needsTypecheck(['app/soporte/page.tsx']).correr).toBe(true)
  })

  // El caso REAL que originó T-225: un script suelto en TypeScript (TS2339) puso el CI en rojo.
  it('un script suelto en .ts lo dispara (el caso que rompió main el 28/07)', () => {
    expect(needsTypecheck(['scripts/backfill-explanation-data.ts']).correr).toBe(true)
  })

  it('los .js/.cjs cuentan: tsconfig tiene allowJs y un .js puede romper el .ts que lo importa', () => {
    expect(needsTypecheck(['lib/laws/parseBoeSections.js']).correr).toBe(true)
    expect(needsTypecheck(['scripts/health-sweep.cjs']).correr).toBe(true)
  })

  it('la CONFIG dispara aunque no cambie una línea de código (strict, versión de TS, paths)', () => {
    expect(needsTypecheck(['tsconfig.json']).correr).toBe(true)
    expect(needsTypecheck(['package.json']).correr).toBe(true)
    expect(needsTypecheck(['package-lock.json']).correr).toBe(true)
  })

  it('backend/ y __tests__/ NO lo disparan (el typecheck de la raíz los excluye)', () => {
    const r = needsTypecheck([
      'backend/src/alerts/alert-rules.ts',
      '__tests__/lib/auth/tokenFreshness.test.ts',
    ])
    expect(r.correr).toBe(false)
  })

  it('mezcla: basta UN fichero relevante entre muchos que no lo son', () => {
    const r = needsTypecheck([
      'docs/x.md',
      'backend/src/y.ts',
      '__tests__/z.test.ts',
      'lib/api/authHeaders.ts',
    ])
    expect(r.correr).toBe(true)
    expect(r.relevantes).toEqual(['lib/api/authHeaders.ts'])
  })

  // La distinción que evita el falso negativo: "no cambió nada" ≠ "no sé qué cambió".
  it('si NO se sabe qué cambia (lista vacía) → se corre igualmente', () => {
    const r = needsTypecheck([])
    expect(r.correr).toBe(true)
    expect(r.motivo).toMatch(/no se pudo determinar/)
  })

  it('entradas basura no cuelan como "nada que hacer"', () => {
    expect(needsTypecheck(null as unknown as string[]).correr).toBe(true)
    expect(needsTypecheck(undefined as unknown as string[]).correr).toBe(true)
    expect(needsTypecheck(['', null, undefined] as unknown as string[]).correr).toBe(true)
  })

  it('rutas con ./ delante se normalizan (git puede darlas así)', () => {
    expect(needsTypecheck(['./backend/src/y.ts']).correr).toBe(false)
    expect(needsTypecheck(['./lib/x.ts']).correr).toBe(true)
  })

  it('un .md dentro de lib/ no es código', () => {
    expect(needsTypecheck(['lib/README.md']).correr).toBe(false)
  })
})

describe('paridad con tsconfig.json (si divergen, el guard daría verde a un push roto)', () => {
  const tsconfig = JSON.parse(
    // El tsconfig de este repo no lleva comentarios; si algún día los lleva, este parse
    // fallará de forma ruidosa en vez de comparar contra basura.
    readFileSync(join(ROOT, 'tsconfig.json'), 'utf8'),
  )

  it('lo que el hook ignora es exactamente lo que tsconfig excluye', () => {
    const excluidosTsconfig: string[] = tsconfig.exclude
    const normal = (s: string) => s.replace(/\/$/, '')
    expect(PREFIJOS_IGNORADOS.map(normal).sort()).toEqual([...excluidosTsconfig].map(normal).sort())
  })

  it('tsconfig mantiene `incremental` (es lo que hace viable el hook: 72 s → ~14 s)', () => {
    expect(tsconfig.compilerOptions.incremental).toBe(true)
  })
})

describe('cableado: el hook invoca de verdad al guard', () => {
  const prePush = readFileSync(join(ROOT, '.husky/pre-push'), 'utf8')

  it('.husky/pre-push llama a typecheck-push-guard y bloquea si falla', () => {
    expect(prePush).toMatch(/node scripts\/typecheck-push-guard\.cjs \|\| exit 1/)
  })

  it('sigue llamando al guard del backlog (no se pisa un guardarraíl con otro)', () => {
    expect(prePush).toMatch(/node scripts\/backlog-push-guard\.cjs \|\| exit 1/)
  })

  it('el guard del backlog va PRIMERO (es el barato: si bloquea, no pagas los ~14 s de tsc)', () => {
    expect(prePush.indexOf('backlog-push-guard')).toBeLessThan(prePush.indexOf('typecheck-push-guard'))
  })

  it('el escape hatch está documentado en el hook (si no, se acaba usando --no-verify)', () => {
    // --no-verify se salta TODOS los hooks, incluido el guard del backlog. Que el escape
    // específico esté a la vista es lo que evita que la gente use el martillo grande.
    expect(prePush).toContain('TYPECHECK_GUARD_SKIP=1')
  })

  it('el comando del guard es el MISMO que corre el CI (o daría falsa confianza)', () => {
    const guard = readFileSync(join(ROOT, 'scripts/typecheck-push-guard.cjs'), 'utf8')
    const ci = readFileSync(join(ROOT, '.github/workflows/test.yml'), 'utf8')
    expect(guard).toMatch(/'npm',\s*\['run',\s*'typecheck'\]/)
    expect(ci).toMatch(/run:\s*npm run typecheck/)
  })
})
