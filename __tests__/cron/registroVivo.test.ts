/**
 * @jest-environment node
 */
// Unitarios del criterio de «¿quién corre, y quién dice que corre?» (T-442). Importa el módulo
// REAL que usan el canario y el panel de salud.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarCron, registroMudo, resumenRegistro, HORAS_CALLADO, HORAS_REGISTRO_MUDO } =
  require('@/lib/cron/registroVivo.cjs')

const AHORA = new Date('2026-08-01T01:00:00Z')
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000)

describe('clasificarCron', () => {
  it('emitió hace un rato y bien → vivo', () => {
    const r = clasificarCron({ nombre: 'canary-answer-save', ultimaSenal: haceHoras(0.2), status: 'completed', severity: 'info', ahora: AHORA })
    expect(r.veredicto).toBe('vivo')
  })

  it('acepta los TRES status de éxito: los crons no usan el mismo', () => {
    for (const status of ['success', 'completed', 'heartbeat']) {
      expect(clasificarCron({ nombre: 'x', ultimaSenal: haceHoras(1), status, ahora: AHORA }).veredicto).toBe('vivo')
    }
  })

  it('el caso real de content-health-sweep: emitió, pero `failure` → FALLANDO', () => {
    // Corrió con success hasta el 28/07 y los días 29 y 30 salió failure. Un detector que solo
    // mirase «¿hay señal reciente?» lo habría dado por vivo.
    const r = clasificarCron({ nombre: 'content-health-sweep', ultimaSenal: haceHoras(2), status: 'failure', severity: 'error', ahora: AHORA })
    expect(r.veredicto).toBe('fallando')
    expect(r.gravedad).toBe('error')
  })

  it('severity error manda aunque el status parezca bueno', () => {
    const r = clasificarCron({ nombre: 'x', ultimaSenal: haceHoras(1), status: 'success', severity: 'error', ahora: AHORA })
    expect(r.veredicto).toBe('fallando')
  })

  it('lleva demasiado sin emitir → callado', () => {
    const r = clasificarCron({ nombre: 'avatar-rotation', ultimaSenal: haceHoras(138), status: 'success', severity: 'info', ahora: AHORA })
    expect(r.veredicto).toBe('callado')
    expect(r.motivo).toMatch(/138 h/)
  })

  it('el umbral no se dispara justo por debajo', () => {
    expect(clasificarCron({ nombre: 'x', ultimaSenal: haceHoras(HORAS_CALLADO - 1), status: 'success', ahora: AHORA }).veredicto).toBe('vivo')
    expect(clasificarCron({ nombre: 'x', ultimaSenal: haceHoras(HORAS_CALLADO + 1), status: 'success', ahora: AHORA }).veredicto).toBe('callado')
  })

  it('nunca emitió → no se le llama vivo NI se le acusa de fallar', () => {
    // Puede ser un cron nuevo o uno sin instrumentar. Las dos cosas piden mirar, ninguna es
    // una avería en producción.
    const r = clasificarCron({ nombre: 'nuevo', ultimaSenal: null, ahora: AHORA })
    expect(r.veredicto).toBe('nunca')
    expect(r.gravedad).toBe('warn')
  })
})

describe('registroMudo — la comprobación que faltaba durante dos meses', () => {
  it('el registro recibe señales → no está mudo', () => {
    expect(registroMudo(haceHoras(0.1), AHORA).mudo).toBe(false)
  })

  it('NI UNA fila → mudo, y es `error`: no se sabe nada de nadie', () => {
    // El estado exacto de `cron_runs` desde el 24/05. La consulta del panel no fallaba: devolvía
    // cero filas, y cero filas se pintaba igual que «todo bien».
    const r = registroMudo(null, AHORA)
    expect(r.mudo).toBe(true)
    expect(r.gravedad).toBe('error')
    expect(r.motivo).toMatch(/NI UNA fila/)
  })

  it('lleva horas sin recibir nada → el termómetro está roto, no los crons', () => {
    const r = registroMudo(haceHoras(HORAS_REGISTRO_MUDO + 2), AHORA)
    expect(r.mudo).toBe(true)
    expect(r.motivo).toMatch(/termómetro/)
  })

  it('es una pregunta SEPARADA de la salud de cada cron', () => {
    // Si se mezclaran, un registro roto saldría como «todos los crons muertos» y se buscaría la
    // avería donde no está.
    expect(typeof registroMudo).toBe('function')
    expect(registroMudo(haceHoras(1), AHORA)).not.toHaveProperty('veredicto')
  })
})

describe('resumenRegistro', () => {
  it('separa lo accionable del ruido y no calla el ruido', () => {
    const r = resumenRegistro([
      clasificarCron({ nombre: 'a', ultimaSenal: haceHoras(0.1), status: 'success', ahora: AHORA }),
      clasificarCron({ nombre: 'b', ultimaSenal: haceHoras(2), status: 'failure', severity: 'error', ahora: AHORA }),
      clasificarCron({ nombre: 'c', ultimaSenal: haceHoras(200), status: 'success', ahora: AHORA }),
      clasificarCron({ nombre: 'd', ultimaSenal: null, ahora: AHORA }),
    ])
    expect(r.total).toBe(4)
    expect(r.vivos).toBe(1)
    expect(r.fallando.map((x: any) => x.nombre)).toEqual(['b'])
    expect(r.callados.map((x: any) => x.nombre)).toEqual(['c'])
    expect(r.nunca.map((x: any) => x.nombre)).toEqual(['d'])
    expect(r.hallazgo).toBe(true)
  })

  it('sin nada que reportar, no inventa hallazgo', () => {
    expect(resumenRegistro([]).hallazgo).toBe(false)
    expect(resumenRegistro(null as any).total).toBe(0)
  })
})
