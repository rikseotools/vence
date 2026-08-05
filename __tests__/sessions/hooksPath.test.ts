/**
 * @jest-environment node
 */
// ¿`core.hooksPath` (compartido por los 10+ worktrees de la flota) sigue apuntando a los hooks
// reales? (T-568)
//
// Medido en vivo el 05/08/2026: `npx husky --version` deja `core.hooksPath="--version/_"` (bug de
// `husky` bin.js, que trata cualquier argv[2] que no reconoce como el directorio de hooks) y desde
// ese momento git deja de ejecutar `.husky/pre-commit` y `.husky/pre-push` en TODOS los worktrees a
// la vez, sin avisar — un commit real pasó sin una sola línea de salida del hook. Pasó dos veces el
// mismo día, la segunda tras un arreglo manual: es una entrada COMPARTIDA, así que cualquier sesión
// puede volver a pisarla en cualquier momento.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { diagnosticar, VALOR_CORRECTO } = require('@/lib/sessions/hooksPath.cjs')

describe('diagnosticar — cuándo hace falta arreglar core.hooksPath', () => {
  it('valor correcto: nada que hacer', () => {
    expect(diagnosticar({ configurado: VALOR_CORRECTO, huskyDirValida: true }))
      .toMatchObject({ corrupto: false })
  })

  it('sin configurar: comportamiento por defecto de git, NO es corrupción', () => {
    expect(diagnosticar({ configurado: null, huskyDirValida: true }))
      .toMatchObject({ corrupto: false })
    expect(diagnosticar({ configurado: null, huskyDirValida: false }))
      .toMatchObject({ corrupto: false })
  })

  it('el caso real medido: "--version/_" con .husky/_ intacto → corrupto', () => {
    const d = diagnosticar({ configurado: '--version/_', huskyDirValida: true })
    expect(d.corrupto).toBe(true)
    expect(d.motivo).toContain('--version/_')
    expect(d.motivo).toContain(VALOR_CORRECTO)
  })

  it('apunta a otro sitio, pero SIN poder confirmar que .husky/_ es la respuesta → no toca nada (fail-open)', () => {
    expect(diagnosticar({ configurado: '--version/_', huskyDirValida: false }))
      .toMatchObject({ corrupto: false, motivo: null })
  })

  it('cualquier otro valor ajeno también cuenta como corrupto si .husky/_ es válido', () => {
    expect(diagnosticar({ configurado: '/algo/raro', huskyDirValida: true }))
      .toMatchObject({ corrupto: true })
  })
})
