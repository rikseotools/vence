/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO de planificación de particiones de `observable_events` (T-360).
// No toca BD — solo genera nombres/rangos/DDL como texto. La ejecución real la hace
// `scripts/db/particionar-observable-events.cjs` contra un `DATABASE_URL` de escritura que este
// rol de trabajador no tiene, así que esto es lo único verificable en este turno.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require('@/lib/db/particionadoObservableEvents.cjs') as {
  nombreParticion: (f: string) => string
  sumarDias: (f: string, n: number) => string
  listaFechas: (a: string, b: string) => string[]
  planParticiones: (p: {
    minCreatedAt: string
    hoy: string
    diasPremake?: number
    diasRetencion?: number
  }) => {
    fechas: string[]
    limiteRetencion: string
    fechasDentroDeRetencion: string[]
    fechasYaFueraDeRetencion: string[]
  }
  ddlCrearTablaParticionada: (t?: string) => string
  ddlIndices: (t?: string) => Array<{ nombreOriginal: string; nombreNuevo: string; sql: string }>
  ddlRenombrarIndicesTrasSwap: () => string[]
  ddlParticion: (f: string, t?: string) => string
  COLUMNAS: Array<{ nombre: string }>
  INDICES: Array<{ nombreOriginal: string }>
}

describe('particionadoObservableEvents: nombres y fechas', () => {
  it('nombra la partición con guiones bajos, ordenable como texto', () => {
    expect(mod.nombreParticion('2026-08-07')).toBe('observable_events_p2026_08_07')
  })

  it('suma días respetando cambio de mes y de año, sin tocar el reloj del sistema', () => {
    expect(mod.sumarDias('2026-08-31', 1)).toBe('2026-09-01')
    expect(mod.sumarDias('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('lista fechas inclusive, diaria', () => {
    expect(mod.listaFechas('2026-08-05', '2026-08-08')).toEqual([
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
    ])
  })

  it('un rango de un solo día devuelve ese único día', () => {
    expect(mod.listaFechas('2026-08-05', '2026-08-05')).toEqual(['2026-08-05'])
  })
})

describe('particionadoObservableEvents: planParticiones', () => {
  it('exige minCreatedAt y hoy — no adivina un rango', () => {
    expect(() => mod.planParticiones({ minCreatedAt: '', hoy: '2026-08-07' })).toThrow()
    expect(() => mod.planParticiones({ minCreatedAt: '2026-07-04', hoy: '' })).toThrow()
  })

  it('cubre desde el dato más antiguo hasta hoy + premake', () => {
    const plan = mod.planParticiones({ minCreatedAt: '2026-07-04', hoy: '2026-08-07', diasPremake: 7 })
    expect(plan.fechas[0]).toBe('2026-07-04')
    expect(plan.fechas[plan.fechas.length - 1]).toBe('2026-08-14')
    expect(plan.fechas.length).toBe(42) // 4/07 .. 14/08 inclusive
  })

  it('con retención de 30 días sobre datos de 34 días, hay particiones YA fuera de retención el día 1', () => {
    // Caso real medido en RDS el 07/08/2026: min_created_at=2026-07-04, hoy=2026-08-07 → 34 días de
    // dato vivo contra 30 de retención. Si la migración se aplicase hoy, el primer `run_maintenance`
    // debe dropear esas 4 particiones de inmediato — el plan tiene que dejarlo visible, no callarlo.
    const plan = mod.planParticiones({
      minCreatedAt: '2026-07-04',
      hoy: '2026-08-07',
      diasPremake: 7,
      diasRetencion: 30,
    })
    expect(plan.limiteRetencion).toBe('2026-07-08')
    expect(plan.fechasYaFueraDeRetencion).toEqual(['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'])
    expect(plan.fechasDentroDeRetencion[0]).toBe('2026-07-08')
  })

  it('si TODO el dato cae dentro de retención, no hay nada ya-fuera', () => {
    const plan = mod.planParticiones({ minCreatedAt: '2026-08-01', hoy: '2026-08-07', diasRetencion: 30 })
    expect(plan.fechasYaFueraDeRetencion).toEqual([])
  })
})

describe('particionadoObservableEvents: DDL', () => {
  it('la tabla particionada declara PRIMARY KEY (id, created_at) — obligatorio en Postgres para particionar', () => {
    const ddl = mod.ddlCrearTablaParticionada()
    expect(ddl).toMatch(/PRIMARY KEY \(id, created_at\)/)
    expect(ddl).toMatch(/PARTITION BY RANGE \(created_at\)/)
  })

  it('la tabla nueva tiene las 13 columnas medidas contra RDS, ni una de más ni de menos', () => {
    const ddl = mod.ddlCrearTablaParticionada()
    for (const c of mod.COLUMNAS) {
      expect(ddl).toContain(c.nombre)
    }
    expect(mod.COLUMNAS.length).toBe(13)
  })

  it('conserva el CHECK de severity tal cual está en producción', () => {
    const ddl = mod.ddlCrearTablaParticionada()
    expect(ddl).toContain("severity = ANY (ARRAY['debug','info','warn','error','critical'])")
  })

  it('genera los 8 índices reales, cada uno con nombre provisional _new para no chocar con la tabla vieja', () => {
    const idx = mod.ddlIndices()
    expect(idx.length).toBe(8)
    expect(mod.INDICES.length).toBe(8)
    for (const i of idx) {
      expect(i.nombreNuevo).toBe(`${i.nombreOriginal}_new`)
      expect(i.sql).toContain(i.nombreNuevo)
    }
  })

  it('el renombrado post-swap deja cada índice con su nombre canónico original', () => {
    const renombres = mod.ddlRenombrarIndicesTrasSwap()
    expect(renombres.length).toBe(8)
    for (const r of renombres) {
      expect(r).toMatch(/^ALTER INDEX \w+_new RENAME TO \w+;$/)
      expect(r).not.toContain('_new_new')
    }
  })

  it('una partición diaria cubre exactamente [fecha, fecha+1) — sin solape con la vecina', () => {
    const hoy = mod.ddlParticion('2026-08-07')
    const manana = mod.ddlParticion('2026-08-08')
    expect(hoy).toContain("FOR VALUES FROM ('2026-08-07') TO ('2026-08-08')")
    expect(manana).toContain("FOR VALUES FROM ('2026-08-08') TO ('2026-08-09')")
  })
})
