/**
 * @jest-environment node
 */
// Unitarios de la segunda puerta del `done` (T-392 F1). Importa el módulo REAL que corre
// `backlog.cjs done` a través de `scripts/backlog/verificacion.cjs`.
//
// La primera puerta mira el TEXTO del outcome (`detectarTrabajoPendiente`) y caza al que
// confiesa. Esta mira los HECHOS: código servido + sha vivo que aún no lo incluye.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { exigeVerificacion, superficieDe, commitsPorSuperficie } = require('@/lib/backlog/verificacionGate.cjs')

const f = (fichero: string, importadoEn: string[] = []) => ({ fichero, importadoEn })
const VIVO = { frontend: true, backend: true }
const SIN_DESPLEGAR = { frontend: false, backend: false }

describe('superficieDe — qué llega al usuario solo tras un deploy', () => {
  it('las rutas servidas se reconocen por sí mismas', () => {
    expect(superficieDe('app/api/stripe/create-checkout/route.js')).toBe('frontend')
    expect(superficieDe('components/TestLayout.tsx')).toBe('frontend')
    expect(superficieDe('backend/src/alerts/alert-rules.ts')).toBe('backend')
    expect(superficieDe('middleware.ts')).toBe('frontend')
  })

  it('documentación, tests y tooling NUNCA son servidos (si no, el gate sería un sello)', () => {
    // La mitad de las fichas de este repo son de esto. Exigirles un deploy convierte el gate en
    // burocracia, y la burocracia se aprende a esquivar.
    expect(superficieDe('docs/runbooks/tareas-pendientes.md')).toBeNull()
    expect(superficieDe('CLAUDE.md')).toBeNull()
    expect(superficieDe('__tests__/backlog/claim.test.ts')).toBeNull()
    expect(superficieDe('scripts/backlog.cjs')).toBeNull()
    expect(superficieDe('.husky/pre-push')).toBeNull()
    expect(superficieDe('supabase/migrations/20260604_x.sql')).toBeNull()
  })

  it('un fichero AMBIGUO (lib/) lo decide quién lo importa, no dónde vive', () => {
    // `lib/api/premium/cobertura.ts` viaja porque una ruta de app lo importa;
    // `lib/backlog/pushGuard.cjs` solo lo usa un hook de git.
    expect(superficieDe('lib/api/premium/cobertura.ts', ['frontend'])).toBe('frontend')
    expect(superficieDe('lib/backlog/pushGuard.cjs', [])).toBeNull()
  })

  it('si lo importan las dos superficies, manda backend (es el que se despliega aparte)', () => {
    expect(superficieDe('lib/compartido.ts', ['frontend', 'backend'])).toBe('backend')
  })
})

describe('exigeVerificacion — el caso T-363, que es el que motivó la ficha', () => {
  it('BLOQUEA: código de cobros servido y el sha vivo no lo incluye', () => {
    const r = exigeVerificacion([
      f('app/api/stripe/create-checkout/route.js'),
      f('app/premium/personal/page.tsx'),
      f('lib/api/premium/cobertura.ts', ['frontend']),
    ], SIN_DESPLEGAR)
    expect(r.exige).toBe(true)
    expect(r.superficies).toEqual(['frontend'])
    expect(r.servidos).toHaveLength(3)
  })

  it('DEJA CERRAR el mismo cambio una vez desplegado', () => {
    const r = exigeVerificacion([f('app/api/stripe/create-checkout/route.js')], VIVO)
    expect(r.exige).toBe(false)
    expect(r.motivo).toMatch(/YA las incluye/)
  })

  it('DEJA CERRAR una tarea de solo documentación aunque no se haya desplegado nada', () => {
    const r = exigeVerificacion([f('docs/runbooks/x.md'), f('CLAUDE.md')], SIN_DESPLEGAR)
    expect(r.exige).toBe(false)
    expect(r.superficies).toEqual([])
  })

  it('DEJA CERRAR tooling local (el caso de este mismo trabajo)', () => {
    const r = exigeVerificacion([
      f('scripts/sessions/huerfanos.cjs'),
      f('lib/sessions/trabajoHuerfano.cjs', []),
      f('__tests__/sessions/trabajoHuerfano.test.ts'),
    ], SIN_DESPLEGAR)
    expect(r.exige).toBe(false)
  })

  it('basta UNA superficie sin desplegar para bloquear, aunque la otra ya esté viva', () => {
    const r = exigeVerificacion(
      [f('app/pagina.tsx'), f('backend/src/cron.ts')],
      { frontend: true, backend: false },
    )
    expect(r.exige).toBe(true)
    expect(r.motivo).toMatch(/backend/)
  })
})

describe('exigeVerificacion — «no lo sé» no puede bloquear a nadie', () => {
  it('sin poder leer el sha vivo NO bloquea, pero lo DICE', () => {
    // Mismo principio que el resto del andamiaje: un desconocido no se convierte en veredicto.
    // Bloquear cierres porque el /api/health no responde sería peor que el fallo que evita.
    const r = exigeVerificacion([f('app/pagina.tsx')], { frontend: null, backend: null })
    expect(r.exige).toBe(false)
    expect(r.motivo).toMatch(/fail-open/)
  })

  it('sin cambios que analizar tampoco inventa un bloqueo', () => {
    expect(exigeVerificacion([], SIN_DESPLEGAR).exige).toBe(false)
    expect(exigeVerificacion(null as any, SIN_DESPLEGAR).exige).toBe(false)
  })
})

// ── T-459: la espera se ata a los commits que SE SIRVEN, no a todos ─────────────────────────
describe('commitsPorSuperficie — a qué commits puede afectarles un deploy', () => {
  const A = { sha: 'aaa', cambios: [{ fichero: 'app/premium/page.tsx', importadoEn: [] }] }
  const B = { sha: 'bbb', cambios: [
    { fichero: 'docs/roadmap/tareas-pendientes.md', importadoEn: [] },
    { fichero: 'e2e/smoke-x.spec.ts', importadoEn: [] },
  ] }
  const C = { sha: 'ccc', cambios: [{ fichero: 'backend/src/cron.ts', importadoEn: [] }] }

  it('el commit de CERRAR (ficha + spec) no cuelga de ninguna superficie', () => {
    // Es el 66% de las tareas del repo: el último commit no toca nada servido. Atarle la espera
    // era pedir un deploy que nunca podría satisfacerla.
    expect(commitsPorSuperficie([B])).toEqual({})
  })

  it('cada superficie se lleva SOLO los commits que la tocan', () => {
    expect(commitsPorSuperficie([A, B, C])).toEqual({ frontend: ['aaa'], backend: ['ccc'] })
  })

  it('un commit que toca las dos aparece en las dos, sin repetirse', () => {
    const D = { sha: 'ddd', cambios: [
      { fichero: 'app/x.tsx', importadoEn: [] },
      { fichero: 'app/y.tsx', importadoEn: [] },
      { fichero: 'backend/src/z.ts', importadoEn: [] },
    ] }
    expect(commitsPorSuperficie([D])).toEqual({ frontend: ['ddd'], backend: ['ddd'] })
  })

  it('un fichero ambiguo cuelga de quien lo importa', () => {
    const E = { sha: 'eee', cambios: [{ fichero: 'lib/api/premium/cobertura.ts', importadoEn: ['frontend'] }] }
    const F = { sha: 'fff', cambios: [{ fichero: 'lib/ui/navOverflowProbe.ts', importadoEn: [] }] }
    expect(commitsPorSuperficie([E, F])).toEqual({ frontend: ['eee'] })
  })

  it('no se cae con entradas vacías o sin sha', () => {
    expect(commitsPorSuperficie([])).toEqual({})
    expect(commitsPorSuperficie(null as any)).toEqual({})
    expect(commitsPorSuperficie([{ cambios: [{ fichero: 'app/x.tsx' }] } as any])).toEqual({})
  })
})

describe('el motivo NO acusa a ficheros que ya están vivos (T-459)', () => {
  it('nombra solo los ficheros de los commits que faltan por desplegar', () => {
    // Antes salía la UNIÓN de todos los commits, así que el mensaje señalaba código desplegado.
    // Un aviso que acusa en falso es un aviso que se deja de creer.
    const r = exigeVerificacion(
      [
        { fichero: 'app/viejo.tsx', importadoEn: [], sha: 'aaa' },
        { fichero: 'app/nuevo.tsx', importadoEn: [], sha: 'bbb' },
      ],
      SIN_DESPLEGAR,
      { commitsPendientes: ['bbb'] },
    )
    expect(r.exige).toBe(true)
    expect(r.servidos.map((s: { fichero: string }) => s.fichero)).toEqual(['app/nuevo.tsx'])
    expect(r.motivo).toMatch(/1 fichero/)
  })

  it('sin saber qué commit falta, se sigue nombrando todo (comportamiento de siempre)', () => {
    const r = exigeVerificacion([{ fichero: 'app/a.tsx', importadoEn: [], sha: 'aaa' }], SIN_DESPLEGAR)
    expect(r.exige).toBe(true)
    expect(r.servidos).toHaveLength(1)
  })
})
