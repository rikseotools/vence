// __tests__/lib/observability/runtimeGate.test.ts
//
// T-572 (05/08/2026): fuente única de "¿este proceso persiste observabilidad?",
// compartida por validation-error-log/queries.ts (validation_error_logs) y
// withErrorLogging.ts (observable_events/request_completed). Antes cada uno
// tenía su propio criterio — o, en el caso de withErrorLogging, NINGUNO — y
// eso dejó una grieta: un worktree local (`next dev`, NODE_ENV=development)
// con la clave RS256 rota escribió 89 eventos httpStatus=500 en
// /api/auth/token en 4 minutos directamente en observable_events, contados
// como incidente de producción real en el panel de salud.

describe('shouldSkipObservabilityPersistence', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV
    jest.resetModules()
  })

  function load() {
    let mod: typeof import('@/lib/observability/runtimeGate')
    jest.isolateModules(() => {
      mod = require('@/lib/observability/runtimeGate')
    })
    return mod!
  }

  it('NODE_ENV=production → NO se salta la persistencia', () => {
    process.env.NODE_ENV = 'production'
    const { shouldSkipObservabilityPersistence } = load()
    expect(shouldSkipObservabilityPersistence()).toBe(false)
  })

  it('NODE_ENV=development (next dev local) → SÍ se salta', () => {
    process.env.NODE_ENV = 'development'
    const { shouldSkipObservabilityPersistence } = load()
    expect(shouldSkipObservabilityPersistence()).toBe(true)
  })

  it('NODE_ENV=test (jest) → SÍ se salta', () => {
    process.env.NODE_ENV = 'test'
    const { shouldSkipObservabilityPersistence } = load()
    expect(shouldSkipObservabilityPersistence()).toBe(true)
  })

  it('NODE_ENV sin definir → SÍ se salta (fail-closed: nunca contamina producción por defecto)', () => {
    delete (process.env as { NODE_ENV?: string }).NODE_ENV
    const { shouldSkipObservabilityPersistence } = load()
    expect(shouldSkipObservabilityPersistence()).toBe(true)
  })
})

describe('validation-error-log/queries.ts y withErrorLogging.ts comparten la MISMA fuente (T-572)', () => {
  // Guardarraíl de fuente: si alguno de los dos vuelve a calcular su propio
  // `process.env.NODE_ENV !== 'production'` en vez de importar el helper
  // compartido, las dos puertas pueden divergir sin que nadie lo note — que
  // es exactamente el bug que originó esta tarea (una gateaba, la otra no).
  const fs = require('fs')
  const path = require('path')
  const ROOT = path.resolve(__dirname, '../../..')

  it('validation-error-log/queries.ts importa shouldSkipObservabilityPersistence', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'lib/api/validation-error-log/queries.ts'),
      'utf-8',
    )
    expect(content).toMatch(
      /import\s*\{\s*shouldSkipObservabilityPersistence\s*\}\s*from\s*['"]@\/lib\/observability\/runtimeGate['"]/,
    )
    expect(content).toMatch(/const SKIP_PERSISTENCE = shouldSkipObservabilityPersistence\(\)/)
  })

  it('withErrorLogging.ts importa shouldSkipObservabilityPersistence y gatea request_completed', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/api/withErrorLogging.ts'), 'utf-8')
    expect(content).toMatch(
      /import\s*\{\s*shouldSkipObservabilityPersistence\s*\}\s*from\s*['"]@\/lib\/observability\/runtimeGate['"]/,
    )
    expect(content).toMatch(
      /const SKIP_REQUEST_COMPLETED_EMIT = shouldSkipObservabilityPersistence\(\)/,
    )
    // El path normal (shouldEmitTiming) Y el path de throw (catch) deben respetar el freno.
    expect(content).toMatch(/shouldEmitTiming = !SKIP_REQUEST_COMPLETED_EMIT/)
    expect(content).toMatch(/if \(!SKIP_REQUEST_COMPLETED_EMIT\) \{\s*\n\s*after\(async \(\) => \{/)
  })

  // T-206 (06/08): TERCER emisor con la MISMA grieta — un daemon (setInterval,
  // arranca solo desde instrumentation.ts#register(), sin que nadie pegue a un
  // endpoint) que emitía `event_loop_lag` sin este freno. MEDIDO: 77% (17/22)
  // de los `critical` de 9 días venían del portátil de Manuel corriendo
  // `next dev` (INSTANCE_ID prefijado `fedora:…`), ensuciando tanto la alerta
  // de producción como la investigación de T-206 sobre si los picos de CPU
  // de Fargate son reales.
  it('eventLoopLag.ts importa shouldSkipObservabilityPersistence y gatea event_loop_lag', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/observability/eventLoopLag.ts'), 'utf-8')
    expect(content).toMatch(
      /import\s*\{\s*shouldSkipObservabilityPersistence\s*\}\s*from\s*['"]\.\/runtimeGate['"]/,
    )
    expect(content).toMatch(
      /const SKIP_EVENT_LOOP_LAG_EMIT = shouldSkipObservabilityPersistence\(\)/,
    )
    expect(content).toMatch(/if \(SKIP_EVENT_LOOP_LAG_EMIT\) return/)
  })
})
