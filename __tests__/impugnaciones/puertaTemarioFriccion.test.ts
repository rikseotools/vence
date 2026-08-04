/**
 * puertaTemarioFriccion.test.ts — la puerta de temario CUENTA lo que dice que cuenta. (T-542)
 *
 * ## El bug que fija
 *
 * La puerta nació el 04/08/2026 (T-518) imprimiendo «queda contado» y **sin emitir nada**. No es
 * un olvido cualquiera: es peor que el silencio, porque el mensaje le afirma a la siguiente sesión
 * que el rodeo quedó registrado. Se descubrió porque una sesión saltó la puerta con
 * `--temario-igualmente` y fue a buscar su escape al bus — donde reportaban nueve guardarraíles
 * y temario no estaba.
 *
 * Importa más de lo que parece: según la cabecera de `friccionSesiones.cjs` (T-423), *«la señal
 * que más importa es el ESCAPE, no el bloqueo — un guardarraíl que se salta de forma sistemática
 * está muerto y nadie se ha enterado»*. Una puerta que no emite es invisible para ese indicador,
 * así que puede llevar muerta desde el día uno sin que nada lo diga.
 *
 * Se comprueba la EJECUCIÓN (se llamó al emisor, con qué clase y qué detalle), no el texto del
 * fichero: un guardarraíl de texto no habría cazado el original, que también «mencionaba» contar.
 */
import path from 'path'

const ROOT = path.join(__dirname, '..', '..')

// El prefijo `mock` es lo único que jest permite referenciar desde una factory hoisteada.
const mockEmitirFriccion = jest.fn()
jest.mock('../../lib/sessions/friccion.cjs', () => ({
  emitirFriccion: (...a: unknown[]) => mockEmitirFriccion(...a),
}))
const emitirFriccion = mockEmitirFriccion

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { anunciarTemario, motivoEscape, resumenBloqueos } = require(
  path.join(ROOT, 'scripts/impugnaciones/lib/puerta-temario.ts'),
)

const BLOQUEO = {
  permitido: false,
  clase: 'rojo',
  bloqueos: [{ code: 'paso1_pendiente', detalle: 'T203 (La Ley 39/2015): never_sourced', comando: 'node …' }],
  avisos: [],
  positionType: 'administrativo_asturias',
}
const ESCAPE = {
  permitido: true,
  clase: 'escape',
  bloqueos: [],
  avisos: [],
  positionType: 'administrativo_asturias',
  motivo: 'la queja no es de temario: pide el inciso «como sistema de firma»',
}

describe('la puerta de temario cuenta la fricción', () => {
  beforeEach(() => {
    emitirFriccion.mockClear()
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it('un ESCAPE se cuenta como guard_escape con el motivo declarado', () => {
    expect(anunciarTemario(ESCAPE, { aplicar: true })).toBe(true)

    expect(emitirFriccion).toHaveBeenCalledTimes(1)
    expect(emitirFriccion).toHaveBeenCalledWith(
      expect.objectContaining({ clase: 'guard_escape', guard: 'temario', detalle: ESCAPE.motivo }),
    )
  })

  it('un BLOQUEO se cuenta como guard_bloqueo, y el detalle agrupa por CODE, no por prosa', () => {
    expect(anunciarTemario(BLOQUEO, { aplicar: true })).toBe(false)

    expect(emitirFriccion).toHaveBeenCalledTimes(1)
    const arg = emitirFriccion.mock.calls[0][0] as { clase: string; guard: string; detalle: string }
    expect(arg.clase).toBe('guard_bloqueo')
    expect(arg.guard).toBe('temario')
    // El detalle lleva el CODE; si llevara el detalle en prosa (con el nombre del tema dentro),
    // la serie no agruparía dos bloqueos del mismo tipo en oposiciones distintas.
    expect(arg.detalle).toContain('paso1_pendiente')
    expect(arg.detalle).not.toContain('never_sourced')
  })

  it('un DRY-RUN no ensucia la serie con ensayos', () => {
    anunciarTemario(BLOQUEO, { aplicar: false })
    anunciarTemario(ESCAPE, { aplicar: false })

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  it('cuando la puerta no aplica o está verde no hay fricción que contar', () => {
    anunciarTemario({ permitido: true, clase: 'no_aplica', bloqueos: [], avisos: [] }, { aplicar: true })
    anunciarTemario({ permitido: true, clase: 'verde', bloqueos: [], avisos: [] }, { aplicar: true })

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  it('fail-open: sin BD la puerta deja pasar y NO lo cuenta como rodeo', () => {
    // `sin_bd` es permitido=true con un aviso. Contarlo como escape haría subir el indicador de
    // «guardarraíl muerto» cada vez que se cae la BD, que es justo lo contrario de lo que mide.
    anunciarTemario(
      { permitido: true, clase: 'sin_bd', bloqueos: [], avisos: [{ code: 'sin_bd', detalle: 'sin conexión' }] },
      { aplicar: true },
    )

    expect(emitirFriccion).not.toHaveBeenCalled()
  })

  describe('qué se guarda de cada veredicto', () => {
    it('el motivo del escape se propaga desde el núcleo, no se reconstruye', () => {
      expect(motivoEscape(ESCAPE)).toBe(ESCAPE.motivo)
    })

    it('un escape sin motivo legible no rompe la serie', () => {
      expect(motivoEscape({ ...ESCAPE, motivo: '   ' })).toBe('sin motivo legible')
    })

    it('los codes repetidos no se duplican en el resumen', () => {
      const v = {
        ...BLOQUEO,
        bloqueos: [
          { code: 'paso1_pendiente', detalle: 'T203' },
          { code: 'paso1_pendiente', detalle: 'T204' },
          { code: 'sellado_fuera_pipeline', detalle: 'T210' },
        ],
      }
      expect(resumenBloqueos(v)).toBe('rojo: paso1_pendiente,sellado_fuera_pipeline (administrativo_asturias)')
    })
  })
})
