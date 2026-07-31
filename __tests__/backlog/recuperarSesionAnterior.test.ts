/**
 * @jest-environment node
 */
// Recuperar lo que dejó una sesión que murió de golpe (T-430).
//
// Cuando una sesión se apaga sin despedirse no llega a escribir el `--hecho`/`--falta` del
// `pause`: ese hueco solo lo llena quien tiene la oportunidad, y justo las que mueren no la
// tienen. Pero su worktree conserva el trabajo, y **los mensajes de sus commits sin pushear son
// la mejor nota que existe** — se escribieron con todo el contexto y no costaron disciplina.
//
// Se comprueba por TEXTO porque el rescate es puro I/O (git + BD): lo que hay que proteger es que
// la pieza siga cableada y siga siendo incapaz de estorbar.
import { readFileSync } from 'fs'
import { join } from 'path'

const cli = readFileSync(join(process.cwd(), 'scripts/backlog.cjs'), 'utf8')
const mig = readFileSync(join(process.cwd(), 'supabase/migrations/20260731_backlog_last_claimed_by.sql'), 'utf8')

describe('el rastro del dueño anterior', () => {
  it('la columna existe y explica para qué (claimed_by se pone a NULL al soltar)', () => {
    expect(mig).toMatch(/last_claimed_by/)
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS/)
  })

  it('`claim` lo escribe solo — no se le pide nada a nadie', () => {
    expect(cli).toMatch(/last_claimed_by = \$\{sid\}/)
  })

  it('lee al dueño ANTERIOR antes de pisarlo (si no, no habría a quién preguntar)', () => {
    const iLee = cli.indexOf('SELECT last_claimed_by FROM public.backlog_tasks')
    const iPisa = cli.indexOf('last_claimed_by = ${sid}')
    expect(iLee).toBeGreaterThan(-1)
    expect(iLee).toBeLessThan(iPisa)
  })

  it('NO se ofrece a sí mismo como sesión anterior', () => {
    expect(cli).toMatch(/previo\.last_claimed_by !== sid/)
  })
})

describe('el rescate', () => {
  it('enseña los COMMITS sin pushear, que son la nota de verdad', () => {
    expect(cli).toMatch(/origin\/main\.\.HEAD/)
    expect(cli).toMatch(/lo más parecido a sus notas/)
  })

  it('enseña también lo que quedó sin commitear', () => {
    expect(cli).toMatch(/status', '--porcelain', '--untracked-files=no/)
  })

  it('se llama al reclamar (si no está cableado, no sirve de nada)', () => {
    expect(cli).toMatch(/await ofrecerTrabajoDeLaSesionAnterior\(s, dueñoAnterior\)/)
  })

  // Informar jamás puede impedir coger una tarea: si el worktree ya no existe, si git no
  // contesta o si la consulta falla, se calla y sigue.
  it('es fail-open: comprueba que el worktree exista y se traga cualquier error', () => {
    const f = cli.slice(cli.indexOf('async function ofrecerTrabajoDeLaSesionAnterior'))
      .slice(0, 2200)
    expect(f).toMatch(/fs\.existsSync/)
    expect(f).toMatch(/catch \{[^}]*reclamar/)
  })
})
