/**
 * @jest-environment node
 */
// [T-645]. `extraerDeclaraciones`/`migracionesRlsPendientes` son el núcleo del canario que
// detecta migraciones RLS mergeadas a `main` y NUNCA aplicadas contra RDS — el hueco medido
// el 07/08: `20260805_rls_test_questions_lector.sql` (T-573) y
// `20260805_rls_ai_verification_results_lector.sql` (T-038) llevaban 2+ días en `main` sin
// que `pg_policies` tuviera ni una fila para esas tablas.
//
// El parser se prueba contra los ficheros REALES del repo (no fixtures inventadas): si algún
// día cambia la forma de estas migraciones sin que el parser se actualice, este test lo nota
// antes que el canario en producción.
const fs = require('fs')
const path = require('path')
const {
  extraerDeclaraciones,
  migracionesRlsPendientes,
  politicaFalta,
} = require('@/lib/db/migracionesRlsPendientes.cjs')

const MIGRATIONS_DIR = path.join(__dirname, '../../supabase/migrations')
const leer = (nombre) => fs.readFileSync(path.join(MIGRATIONS_DIR, nombre), 'utf8')

describe('extraerDeclaraciones — contra los ficheros REALES del repo', () => {
  it('forma directa (ai_verification_results, T-038): una declaración SELECT', () => {
    const decls = extraerDeclaraciones(leer('20260805_rls_ai_verification_results_lector.sql'))
    expect(decls).toEqual([
      { policy: 'flota_lector_lee', table: 'ai_verification_results', cmd: 'SELECT', roles: ['vence_lector'] },
    ])
  })

  it('forma directa (convocatoria_seguimiento_checks, T-220): una declaración SELECT', () => {
    const decls = extraerDeclaraciones(leer('20260806_rls_convocatoria_seguimiento_checks_lector.sql'))
    expect(decls).toEqual([
      {
        policy: 'flota_lector_lee',
        table: 'convocatoria_seguimiento_checks',
        cmd: 'SELECT',
        roles: ['vence_lector'],
      },
    ])
  })

  it('forma plantilla %I + ARRAY (test_questions/tests, T-573): una declaración por tabla', () => {
    const decls = extraerDeclaraciones(leer('20260805_rls_test_questions_lector.sql'))
    expect(decls).toEqual(
      expect.arrayContaining([
        { policy: 'flota_lector_lee', table: 'test_questions', cmd: 'SELECT', roles: ['vence_lector'] },
        { policy: 'flota_lector_lee', table: 'tests', cmd: 'SELECT', roles: ['vence_lector'] },
      ])
    )
    expect(decls).toHaveLength(2)
  })

  it('forma plantilla con DOS políticas por tabla y roles múltiples (impugnaciones, T-486/T-574)', () => {
    const decls = extraerDeclaraciones(leer('20260805_rls_impugnaciones_flota.sql'))
    // 2 tablas × 2 políticas (SELECT compartida, UPDATE solo coordinación) = 4
    expect(decls).toHaveLength(4)
    expect(decls).toEqual(
      expect.arrayContaining([
        {
          policy: 'flota_coordinacion_lee',
          table: 'question_disputes',
          cmd: 'SELECT',
          roles: ['vence_coordinacion', 'vence_lector'],
        },
        {
          policy: 'flota_coordinacion_reclama',
          table: 'question_disputes',
          cmd: 'UPDATE',
          roles: ['vence_coordinacion'],
        },
        {
          policy: 'flota_coordinacion_lee',
          table: 'psychometric_question_disputes',
          cmd: 'SELECT',
          roles: ['vence_coordinacion', 'vence_lector'],
        },
        {
          policy: 'flota_coordinacion_reclama',
          table: 'psychometric_question_disputes',
          cmd: 'UPDATE',
          roles: ['vence_coordinacion'],
        },
      ])
    )
  })

  it('no extrae nada de un fichero sin CREATE POLICY', () => {
    expect(extraerDeclaraciones('-- solo un comentario\nSELECT 1;')).toEqual([])
  })

  it('ignora un CREATE POLICY mencionado solo en un COMENTARIO (no es código real)', () => {
    const sql = [
      "-- Ejemplo: CREATE POLICY flota_lector_lee ON public.trampa FOR SELECT TO vence_lector USING (true);",
      'SELECT 1;',
    ].join('\n')
    expect(extraerDeclaraciones(sql)).toEqual([])
  })
})

describe('migracionesRlsPendientes', () => {
  const migracion = (archivo, declaraciones) => ({ archivo, declaraciones })

  it('caso real medido 07/08: SELECT declarado y catálogo con CERO políticas → pendiente', () => {
    const migraciones = [
      migracion('20260805_rls_test_questions_lector.sql', [
        { policy: 'flota_lector_lee', table: 'test_questions', cmd: 'SELECT', roles: ['vence_lector'] },
        { policy: 'flota_lector_lee', table: 'tests', cmd: 'SELECT', roles: ['vence_lector'] },
      ]),
    ]
    const catalogo = {
      test_questions: { rowsecurity: true, policies: [] },
      tests: { rowsecurity: true, policies: [] },
    }
    const pendientes = migracionesRlsPendientes(migraciones, catalogo)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].archivo).toBe('20260805_rls_test_questions_lector.sql')
    expect(pendientes[0].faltan).toHaveLength(2)
    expect(pendientes[0].faltan.map((f) => f.table).sort()).toEqual(['test_questions', 'tests'])
  })

  it('caso ya aplicado: catálogo con la política viva → NO pendiente', () => {
    const migraciones = [
      migracion('20260805_rls_ai_verification_results_lector.sql', [
        { policy: 'flota_lector_lee', table: 'ai_verification_results', cmd: 'SELECT', roles: ['vence_lector'] },
      ]),
    ]
    const catalogo = {
      ai_verification_results: {
        rowsecurity: true,
        policies: [{ cmd: 'SELECT', roles: ['vence_lector'] }],
      },
    }
    expect(migracionesRlsPendientes(migraciones, catalogo)).toEqual([])
  })

  it('RLS ya desactivado en la tabla (GRANT de tabla basta): NO pendiente aunque no haya política', () => {
    const migraciones = [
      migracion('hipotetica.sql', [
        { policy: 'x', table: 'alguna_tabla', cmd: 'SELECT', roles: ['vence_lector'] },
      ]),
    ]
    const catalogo = { alguna_tabla: { rowsecurity: false, policies: [] } }
    expect(migracionesRlsPendientes(migraciones, catalogo)).toEqual([])
  })

  it('tabla ausente del catálogo (no se pudo leer): se reporta, no se asume aplicada ni se calla', () => {
    const migraciones = [
      migracion('x.sql', [{ policy: 'p', table: 'tabla_fantasma', cmd: 'SELECT', roles: ['vence_lector'] }]),
    ]
    const pendientes = migracionesRlsPendientes(migraciones, {})
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].faltan[0].motivo).toMatch(/no encontrada en el catálogo/)
  })

  it('política UPDATE (no SELECT): usa el predicado generalizado, no seleccionBloqueadaPorRls', () => {
    // Caso real: question_disputes tiene la política SELECT compartida aplicada, pero si la
    // UPDATE de vence_coordinacion faltara, comprobar solo "¿está bloqueado el SELECT?" daría
    // un falso "no pendiente" — hay que comprobar la política UPDATE en sí.
    const migraciones = [
      migracion('20260805_rls_impugnaciones_flota.sql', [
        {
          policy: 'flota_coordinacion_lee',
          table: 'question_disputes',
          cmd: 'SELECT',
          roles: ['vence_coordinacion', 'vence_lector'],
        },
        {
          policy: 'flota_coordinacion_reclama',
          table: 'question_disputes',
          cmd: 'UPDATE',
          roles: ['vence_coordinacion'],
        },
      ]),
    ]
    const catalogoSinUpdate = {
      question_disputes: {
        rowsecurity: true,
        // Solo la política SELECT está viva — la UPDATE (hipotéticamente) no se aplicó.
        policies: [{ cmd: 'SELECT', roles: ['vence_coordinacion', 'vence_lector'] }],
      },
    }
    const pendientes = migracionesRlsPendientes(migraciones, catalogoSinUpdate)
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0].faltan).toEqual([
      { table: 'question_disputes', role: 'vence_coordinacion', motivo: 'RLS sigue bloqueando UPDATE de vence_coordinacion' },
    ])
  })

  it('varias migraciones, solo unas pendientes: solo esas salen en el resultado', () => {
    const migraciones = [
      migracion('aplicada.sql', [{ policy: 'p', table: 'ok', cmd: 'SELECT', roles: ['vence_lector'] }]),
      migracion('pendiente.sql', [{ policy: 'p', table: 'no_ok', cmd: 'SELECT', roles: ['vence_lector'] }]),
    ]
    const catalogo = {
      ok: { rowsecurity: true, policies: [{ cmd: 'SELECT', roles: ['vence_lector'] }] },
      no_ok: { rowsecurity: true, policies: [] },
    }
    const pendientes = migracionesRlsPendientes(migraciones, catalogo)
    expect(pendientes.map((p) => p.archivo)).toEqual(['pendiente.sql'])
  })

  it('no duplica el mismo (tabla, rol) si dos declaraciones lo repiten', () => {
    const migraciones = [
      migracion('x.sql', [
        { policy: 'p1', table: 't', cmd: 'SELECT', roles: ['vence_lector'] },
        { policy: 'p2', table: 't', cmd: 'SELECT', roles: ['vence_lector'] },
      ]),
    ]
    const pendientes = migracionesRlsPendientes(migraciones, { t: { rowsecurity: true, policies: [] } })
    expect(pendientes[0].faltan).toHaveLength(1)
  })
})

describe('politicaFalta — generalización de seleccionBloqueadaPorRls a cmd arbitrario', () => {
  it('para SELECT da EXACTAMENTE lo mismo que seleccionBloqueadaPorRls (mismo predicado)', () => {
    const { seleccionBloqueadaPorRls } = require('@/lib/db/rlsSelectBlocked.cjs')
    const casos = [
      [true, [], 'vence_lector'],
      [true, [{ cmd: 'SELECT', roles: ['vence_lector'] }], 'vence_lector'],
      [true, [{ cmd: 'ALL', roles: ['public'] }], 'vence_lector'],
      [false, [], 'vence_lector'],
    ]
    for (const [rowsecurity, policies, role] of casos) {
      expect(politicaFalta('SELECT', role, rowsecurity, policies)).toBe(
        seleccionBloqueadaPorRls(rowsecurity, policies, role)
      )
    }
  })

  it('UPDATE: bloqueado si no hay política UPDATE/ALL para el rol', () => {
    expect(politicaFalta('UPDATE', 'vence_coordinacion', true, [])).toBe(true)
    expect(politicaFalta('UPDATE', 'vence_coordinacion', true, [{ cmd: 'SELECT', roles: ['vence_coordinacion'] }])).toBe(true)
    expect(politicaFalta('UPDATE', 'vence_coordinacion', true, [{ cmd: 'UPDATE', roles: ['vence_coordinacion'] }])).toBe(false)
    expect(politicaFalta('UPDATE', 'vence_coordinacion', true, [{ cmd: 'ALL', roles: ['vence_coordinacion'] }])).toBe(false)
  })
})
