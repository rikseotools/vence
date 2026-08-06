/**
 * puertaEmbudoFriccion.test.ts — la puerta del embudo CUENTA lo que dice que cuenta. (T-542, T-609)
 *
 * Mismo defecto que ya se cazó en la puerta de temario (04/08): un guardarraíl que imprime «queda
 * contado» sin llamar al emisor ÚNICO es invisible para el indicador de «guardarraíl muerto» de
 * `friccionSesiones.cjs` (T-423) — puede llevar muerto desde el día uno sin que nada lo diga.
 * Se comprueba la EJECUCIÓN (se llamó al emisor, con qué clase y qué guard), no el texto impreso.
 */
import path from 'path'

const ROOT = path.join(__dirname, '..', '..')

const mockEmitirFriccion = jest.fn()
jest.mock('../../lib/sessions/friccion.cjs', () => ({
  emitirFriccion: (...a: unknown[]) => mockEmitirFriccion(...a),
}))
const emitirFriccion = mockEmitirFriccion

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { anunciarEmbudo } = require(path.join(ROOT, 'scripts/impugnaciones/lib/puerta-embudo.ts'))

const FILA_VETADA = {
  id: 34,
  sid: 'l1-fedora-1a16fb',
  answered_by: 'manuel',
  answered_at: '2026-08-06T06:16:35.854Z',
  answer: 'NO ENVIAR TAL CUAL. Causa raiz encontrada…',
}

const VETADO = { permitido: false, clase: 'vetado' as const, filas: [FILA_VETADA] }
const ESCAPE = { permitido: true, clase: 'escape' as const, filas: [FILA_VETADA], motivo: 'el veto ya no aplica, hablado con Manuel' }
const SIN_VETO = { permitido: true, clase: 'sin_veto' as const, filas: [] }
const SIN_BD = { permitido: true, clase: 'sin_bd' as const, filas: [], motivo: 'no se ha podido comprobar el embudo: timeout' }

describe('la puerta del embudo cuenta la fricción', () => {
  beforeEach(() => {
    emitirFriccion.mockClear()
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('un VETO bloquea, y se cuenta como guard_bloqueo con el guard "embudo"', () => {
    expect(anunciarEmbudo(VETADO, { aplicar: true })).toBe(false)

    expect(emitirFriccion).toHaveBeenCalledTimes(1)
    const arg = emitirFriccion.mock.calls[0][0] as { clase: string; guard: string; detalle: string }
    expect(arg.clase).toBe('guard_bloqueo')
    expect(arg.guard).toBe('embudo')
    expect(arg.detalle).toContain('1')
  })

  it('un ESCAPE deja pasar, y se cuenta como guard_escape con el motivo declarado', () => {
    expect(anunciarEmbudo(ESCAPE, { aplicar: true })).toBe(true)

    expect(emitirFriccion).toHaveBeenCalledTimes(1)
    expect(emitirFriccion).toHaveBeenCalledWith(
      expect.objectContaining({ clase: 'guard_escape', guard: 'embudo', detalle: ESCAPE.motivo }),
    )
  })

  it('un DRY-RUN no ensucia la serie con ensayos, aunque bloquee o escape', () => {
    anunciarEmbudo(VETADO, { aplicar: false })
    anunciarEmbudo(ESCAPE, { aplicar: false })

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  it('sin veto no hay fricción que contar', () => {
    anunciarEmbudo(SIN_VETO, { aplicar: true })

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  it('sin BD la puerta NO deja pasar: no puede afirmar que no haya veto', () => {
    // Cambiado el 06/08 al rescatar T-609 a main, tras EJECUTAR la puerta y ver que con
    // `DATABASE_URL` ausente devolvía «permitido». Aquí el fail-open del resto del andamiaje no
    // vale: esto no observa, DECIDE si sale un correo hacia una persona — y `cerrar.ts` no manda
    // por BD, manda por HTTP contra `/api/v2/dispute/resolve`, así que el envío seguía adelante y
    // el hueco que esta ficha vino a cerrar quedaba abierto para cualquier sesión con la BD caída.
    // La asimetría de `embudoVeto.cjs` decide el sentido: un falso «sí» manda un correo vetado
    // (irreversible), un falso «no» cuesta un `--embudo-igualmente` que ya existe.
    expect(anunciarEmbudo(SIN_BD, { aplicar: true })).toBe(false)
  })

  it('…y lo cuenta como BLOQUEO, no como escape', () => {
    // Se conserva el razonamiento original: contar un `sin_bd` como `guard_escape` haría subir el
    // indicador de «guardarraíl que se rodea» cada vez que se cae la BD, que es justo lo contrario
    // de lo que ese indicador mide. Es un bloqueo, y como bloqueo se cuenta.
    anunciarEmbudo(SIN_BD, { aplicar: true })

    expect(emitirFriccion).toHaveBeenCalledTimes(1)
    expect(emitirFriccion.mock.calls[0][0]).toMatchObject({ clase: 'guard_bloqueo', guard: 'embudo' })
  })

  it('en dry-run no cuenta nada, tampoco el sin_bd', () => {
    anunciarEmbudo(SIN_BD, { aplicar: false })

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  it('el sin_bd dice CÓMO arreglarlo, no solo que falló', () => {
    // Un bloqueo que no dice cómo satisfacerse es el que enseña a usar el escape (T-375).
    const logSpy = jest.spyOn(console, 'log')
    anunciarEmbudo(SIN_BD, { aplicar: true })

    const impreso = logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(impreso).toContain('--env-file=.env.local')
    expect(impreso).toContain('--embudo-igualmente')
  })

  it('el veto BLOQUEADO imprime la respuesta completa (para leerla antes de decidir)', () => {
    const logSpy = jest.spyOn(console, 'log')
    anunciarEmbudo(VETADO, { aplicar: true })

    const impreso = logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(impreso).toContain('NO ENVIAR TAL CUAL')
    expect(impreso).toContain('#34')
    expect(impreso).toContain('--embudo-igualmente')
  })
})
