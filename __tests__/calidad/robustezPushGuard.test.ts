// __tests__/calidad/robustezPushGuard.test.ts
//
// El guardarraíl que impide pushear código de producción a pelo. Lo que se prueba aquí es lo
// que decide si BLOQUEA o no — un gate con la regla mal puesta es peor que ninguno: si molesta
// sin motivo, la primera reacción es desactivarlo, y entonces deja de proteger nada.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guard = require('@/lib/calidad/robustezPushGuard.cjs')

const VIGILANCIA = "'answer_watchdog_burst', 'cobro_bloqueado_auth', 'canary_identidad_pago_failed'"

describe('clasificar — qué cuenta como producción y qué como capa', () => {
  it('los endpoints y el dominio son producción', () => {
    const { produccion } = guard.clasificar(['app/api/stripe/cancel/route.ts', 'lib/api/premium/ofertas.ts'])
    expect(produccion).toHaveLength(2)
  })

  it('un test que vive bajo lib/ NO es producción (si no, se contaría a sí mismo)', () => {
    const { produccion, capas } = guard.clasificar(['lib/stripe/precioHeredado.test.ts'])
    expect(produccion).toEqual([])
    expect(capas).toHaveLength(1)
  })

  it('sim, canary y guardarraíles cuentan como capa', () => {
    const { capas } = guard.clasificar([
      'scripts/sim/sim-precio-heredado.ts',
      'backend/src/canary-identidad-pago/canary-identidad-pago.service.ts',
      '__tests__/guardrails/rutasCobroVigiladas.test.ts',
    ])
    expect(capas).toHaveLength(3)
  })

  it('la documentación y el backlog no son producción: un push de docs no paga peaje', () => {
    const { produccion } = guard.clasificar(['docs/roadmap/tareas-pendientes.md', 'README.md'])
    expect(produccion).toEqual([])
  })
})

describe('evaluarPush — cuándo bloquea', () => {
  it('BLOQUEA código de producción sin una sola capa', () => {
    const r = guard.evaluarPush(['app/api/stripe/cancel/route.ts'], '', VIGILANCIA)
    expect(r.allowed).toBe(false)
    expect(r.motivos[0].tipo).toBe('sin_capas')
  })

  it('PERMITE si el mismo push trae su test', () => {
    const r = guard.evaluarPush(
      ['app/api/stripe/cancel/route.ts', '__tests__/guardrails/endpointsPagoIdentidad.test.ts'],
      '',
      VIGILANCIA,
    )
    expect(r.allowed).toBe(true)
  })

  it('PERMITE un push que solo toca documentación', () => {
    expect(guard.evaluarPush(['docs/runbooks/health-check.md'], '', VIGILANCIA).allowed).toBe(true)
  })

  it('PERMITE un push vacío (no inventa trabajo donde no lo hay)', () => {
    expect(guard.evaluarPush([], '', VIGILANCIA).allowed).toBe(true)
  })
})

describe('señales nuevas — observabilidad sin huecos', () => {
  /** Diff de un fichero de producción que emite una señal con la gravedad dada. */
  const emision = (tipo: string, severity = 'error', fichero = 'lib/api/x.ts') =>
    `diff --git a/${fichero} b/${fichero}\n` +
    `+  emitFireAndForget({\n+    severity: '${severity}',\n+    eventType: '${tipo}',\n+  })`

  it('detecta una señal de ERROR nueva en código de producción', () => {
    expect(guard.eventTypesIntroducidos(emision('fallo_nuevo'))).toEqual(['fallo_nuevo'])
  })

  it('IGNORA las señales `info`: contexto no es avería, y exigirles regla es ruido', () => {
    // Caso real: `precio_heredado_no_procede` significa «no tenía precio anterior».
    expect(guard.eventTypesIntroducidos(emision('precio_heredado_no_procede', 'info'))).toEqual([])
  })

  it('IGNORA los fixtures de los tests (el falso positivo que se comió su propio push)', () => {
    // Un `eventType` dentro de un test es un dato inventado, no una señal que alguien emita.
    const diff = emision('senal_que_nadie_mira', 'error', '__tests__/calidad/algo.test.ts')
    expect(guard.eventTypesIntroducidos(diff)).toEqual([])
  })

  it('una línea BORRADA no cuenta como señal nueva', () => {
    const diff = "diff --git a/lib/api/x.ts b/lib/api/x.ts\n-      eventType: 'algo',"
    expect(guard.eventTypesIntroducidos(diff)).toEqual([])
  })

  it('BLOQUEA si la señal de error nueva no la vigila ninguna regla', () => {
    const r = guard.evaluarPush(['lib/api/x.ts', '__tests__/x.test.ts'], emision('sin_dueno'), VIGILANCIA)
    expect(r.allowed).toBe(false)
    expect(r.motivos[0].tipo).toBe('senal_sin_vigilancia')
    expect(r.motivos[0].detalle).toContain('sin_dueno')
  })

  it('PERMITE si la señal ya está en el catálogo de reglas', () => {
    const r = guard.evaluarPush(
      ['lib/api/x.ts', '__tests__/x.test.ts'],
      emision('cobro_bloqueado_auth'),
      VIGILANCIA,
    )
    expect(r.allowed).toBe(true)
  })

  it('PERMITE si el PROPIO push añade la regla que la vigila', () => {
    // Caso normal de un cambio bien hecho: la señal y su regla van juntas.
    const r = guard.evaluarPush(
      ['lib/api/x.ts', '__tests__/x.test.ts'],
      emision('senal_nueva'),
      `${VIGILANCIA} 'senal_nueva'`,
    )
    expect(r.allowed).toBe(true)
  })

  it('acumula los dos motivos cuando se dan a la vez', () => {
    const r = guard.evaluarPush(['lib/api/x.ts'], emision('huerfana'), VIGILANCIA)
    expect(r.allowed).toBe(false)
    expect(r.motivos.map((m: { tipo: string }) => m.tipo).sort()).toEqual([
      'senal_sin_vigilancia',
      'sin_capas',
    ])
  })
})
