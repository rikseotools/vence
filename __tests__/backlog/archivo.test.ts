/**
 * @jest-environment node
 */
// El último escalón del ciclo de una tarea: `done` ≠ archivada. (T-392 Fase 2/3)
//
// La Fase 1 (31/07) ya impide cerrar una tarea cuyo código servido no está desplegado. Falta la
// otra mitad del encargo de Manuel: *«cuando está verificada [en producción] y todo correcto,
// ponerle estado archivado»*. `done` sigue siendo terminal — lo que se añade es la confirmación
// posterior, con evidencia, de que alguien vio el arreglo funcionar.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ARCH = require('@/lib/backlog/archivo.cjs')

const AHORA = new Date('2026-08-05T12:00:00Z')
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86_400_000).toISOString()

const cerradaSinArchivar = (over: Record<string, any> = {}) => ({
  id: 'T-363', title: 'Contratar el precio heredado sin pagar dos veces', status: 'done',
  closed_at: haceDias(1), archived_at: null, requiere_archivo: true, ...over,
})

describe('la evidencia es obligatoria y tiene que decir QUÉ se comprobó', () => {
  it('una evidencia descrita vale', () => {
    expect(ARCH.validarEvidencia('el primer cobro salió por 35€ el 30/10, visto en Stripe').ok).toBe(true)
  })

  it.each([['ok'], ['listo'], ['correcto'], ['funciona'], ['verificado'], ['bien'], ['sí']])(
    '«%s» no es evidencia', (v) => {
      const r = ARCH.validarEvidencia(v)
      expect(r.ok).toBe(false)
      expect(r.problema).toBeTruthy()
    })

  it('vacío o demasiado corto no cuela', () => {
    expect(ARCH.validarEvidencia('').ok).toBe(false)
    expect(ARCH.validarEvidencia(undefined).ok).toBe(false)
    expect(ARCH.validarEvidencia('x'.repeat(ARCH.EVIDENCIA_MIN - 1)).ok).toBe(false)
    expect(ARCH.validarEvidencia('x'.repeat(ARCH.EVIDENCIA_MIN)).ok).toBe(true)
  })

  it('no es sensible a mayúsculas ni a espacios sueltos', () => {
    expect(ARCH.validarEvidencia('  OK  ').ok).toBe(false)
    expect(ARCH.validarEvidencia('Todo Correcto').ok).toBe(false)
  })
})

describe('el CAMPO manda: pendienteDeArchivar nunca se deduce del texto', () => {
  it('done + sin archivar + requiere_archivo=true → pendiente', () => {
    expect(ARCH.pendienteDeArchivar(cerradaSinArchivar())).toBe(true)
  })

  it('ya archivada → no pendiente, aunque requiere_archivo siga en true', () => {
    expect(ARCH.pendienteDeArchivar(cerradaSinArchivar({ archived_at: haceDias(0) }))).toBe(false)
  })

  it('requiere_archivo=false (exención automática) → nunca pendiente', () => {
    expect(ARCH.pendienteDeArchivar(cerradaSinArchivar({ requiere_archivo: false }))).toBe(false)
  })

  it('requiere_archivo=NULL (no se pudo determinar) → NO se asume pendiente (fail-open)', () => {
    expect(ARCH.pendienteDeArchivar(cerradaSinArchivar({ requiere_archivo: null }))).toBe(false)
  })

  it('una tarea todavía abierta nunca es "pendiente de archivar": ese cajón es de otra espera', () => {
    expect(ARCH.pendienteDeArchivar(cerradaSinArchivar({ status: 'open' }))).toBe(false)
  })

  it('sin tarea no revienta', () => {
    expect(ARCH.pendienteDeArchivar(null)).toBe(false)
    expect(ARCH.pendienteDeArchivar(undefined)).toBe(false)
  })
})

describe('antigüedad: lo que decide si el aviso se pinta urgente', () => {
  it('cuenta días completos desde el cierre', () => {
    expect(ARCH.diasCerrada(cerradaSinArchivar({ closed_at: haceDias(5) }), AHORA)).toBe(5)
    expect(ARCH.diasCerrada(cerradaSinArchivar({ closed_at: haceDias(0) }), AHORA)).toBe(0)
  })

  it('sin closed_at no inventa una antigüedad', () => {
    expect(ARCH.diasCerrada(cerradaSinArchivar({ closed_at: null }), AHORA)).toBeNull()
  })

  it('el umbral de urgencia es el declarado por el módulo, no un número mágico en el CLI', () => {
    const linea = ARCH.lineaPendienteArchivar(cerradaSinArchivar({ closed_at: haceDias(ARCH.DIAS_URGENTE) }), AHORA)
    expect(linea).toContain('🔴')
    const lineaReciente = ARCH.lineaPendienteArchivar(cerradaSinArchivar({ closed_at: haceDias(ARCH.DIAS_URGENTE - 1) }), AHORA)
    expect(lineaReciente).not.toContain('🔴')
  })
})

describe('lo que se le enseña a quien mira la lista', () => {
  it('la línea lleva el id y desde cuándo está cerrada', () => {
    const l = ARCH.lineaPendienteArchivar(cerradaSinArchivar({ closed_at: haceDias(2) }), AHORA)
    expect(l).toContain('T-363')
    expect(l).toMatch(/hace 2 días/)
  })

  it('sobre una tarea que no está pendiente de archivar no inventa nada', () => {
    expect(ARCH.lineaPendienteArchivar(cerradaSinArchivar({ archived_at: haceDias(0) }), AHORA)).toBeNull()
    expect(ARCH.lineaPendienteArchivar({ id: 'T-1' }, AHORA)).toBeNull()
  })
})

describe('los motivos fijos son textos ESTABLES (los lee el CLI, no se improvisan)', () => {
  it('el motivo automático explica la regla 1 (exención sin superficie servida)', () => {
    expect(ARCH.MOTIVO_AUTO.length).toBeGreaterThanOrEqual(ARCH.EVIDENCIA_MIN)
    expect(ARCH.MOTIVO_AUTO).toMatch(/superficie servida/)
  })

  it('el motivo de migración deja claro que NO se re-verificó', () => {
    expect(ARCH.MOTIVO_MIGRACION.length).toBeGreaterThanOrEqual(ARCH.EVIDENCIA_MIN)
    expect(ARCH.MOTIVO_MIGRACION).toMatch(/no se re-verifica/)
  })
})
