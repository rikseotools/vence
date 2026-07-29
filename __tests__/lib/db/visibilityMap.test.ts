/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que decide si el mapa de visibilidad de una tabla está frío (T-275).
// Importa el módulo REAL de producción, nunca una copia.
//
// Los números son los MEDIDOS en producción el 29/07: si alguien afloja los umbrales, el test
// vuelve a contar el caso real — `test_questions` al 67,5% costaba 17.809 ms y 72.695 heap fetches
// en una consulta que tras calentar el mapa tardó 145 ms.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  classifyVisibility, tablasFrias, pctVisible, remedioVisibilidad, VM_MIN_PAGES,
} = require('@/lib/db/visibilityMap.cjs') as {
  classifyVisibility: (t: Tabla) => Veredicto
  tablasFrias: (ts: Tabla[]) => Veredicto[]
  pctVisible: (t: { relpages: number; relallvisible: number }) => number | null
  remedioVisibilidad: (v: Veredicto) => string
  VM_MIN_PAGES: number
}

interface Tabla { relname: string; relpages: number; relallvisible: number; tieneAjusteInserts: boolean }
interface Veredicto extends Tabla { pctVisible: number; status: string; paginasFrias: number }

const t = (relname: string, relpages: number, relallvisible: number, tieneAjusteInserts = false) =>
  ({ relname, relpages, relallvisible, tieneAjusteInserts })

describe('classifyVisibility — el caso real que lo motiva', () => {
  it('CAZA test_questions al 67,5% (la consulta tardaba 17,8 s con 72.695 heap fetches)', () => {
    const v = classifyVisibility(t('test_questions', 298_600, 201_651))
    expect(v.pctVisible).toBe(67.5)
    expect(v.status).toBe('error')
    expect(v.paginasFrias).toBe(96_949)
  })

  it('CAZA las peores de la tanda del 29/07', () => {
    expect(classifyVisibility(t('user_question_history_v2', 32_723, 15_776)).status).toBe('error')
    expect(classifyVisibility(t('question_first_attempts', 17_062, 7_849)).status).toBe('error')
    // 75,4% → no llega a error pero sí a aviso: 1,8 GB insert-only, 25 días sin vacuum.
    expect(classifyVisibility(t('law_question_first_attempts', 210_269, 158_487)).status).toBe('warn')
  })

  it('la tabla ya caliente NO aparece (el detector no nace encendido)', () => {
    // Tras el arreglo, las tres quedaron al 100%.
    expect(classifyVisibility(t('test_questions', 299_675, 299_668)).status).toBe('ok')
    expect(classifyVisibility(t('user_question_history_v2', 32_723, 32_722)).status).toBe('ok')
  })

  it('no exige el 100%: siempre hay páginas recién escritas', () => {
    expect(classifyVisibility(t('x', 50_000, 48_000)).status).toBe('ok')   // 96%
    expect(classifyVisibility(t('x', 50_000, 44_000)).status).toBe('warn') // 88%
  })
})

describe('classifyVisibility — las que NO deben ensuciar la lista', () => {
  it('una tabla pequeña sale OK aunque esté al 10%', () => {
    // No es que esté bien: es que no duele (cabe en caché). Listarla enseña a ignorar la lista,
    // que es como murieron otros avisos de este repo (T-033/T-039/T-046).
    const v = classifyVisibility(t('tabla_chica', VM_MIN_PAGES - 1, 10))
    expect(v.status).toBe('ok')
  })

  it('justo en el suelo de tamaño ya opina', () => {
    expect(classifyVisibility(t('x', VM_MIN_PAGES, 10)).status).toBe('error')
  })

  it('una tabla vacía no se juzga', () => {
    expect(pctVisible({ relpages: 0, relallvisible: 0 })).toBeNull()
    expect(classifyVisibility(t('vacia', 0, 0)).status).toBe('ok')
  })
})

describe('tablasFrias — ordena por DAÑO, no por porcentaje', () => {
  it('una tabla enorme al 80% pesa más que una pequeña al 46%', () => {
    // El porcentaje las hace parecer iguales; las páginas frías dicen quién arrastra el I/O.
    const r = tablasFrias([
      t('user_interactions', 1_050_169, 840_135),        // 80% → 210.034 páginas frías
      t('question_first_attempts', 17_062, 7_849),       // 46% →   9.213 páginas frías
    ])
    expect(r.map(x => x.relname)).toEqual(['user_interactions', 'question_first_attempts'])
    expect(r[0].paginasFrias).toBeGreaterThan(r[1].paginasFrias)
  })

  it('el día bueno devuelve lista vacía', () => {
    expect(tablasFrias([t('a', 300_000, 299_000), t('b', 30_000, 29_900)])).toEqual([])
  })

  it('tolera la ausencia de lista', () => {
    // @ts-expect-error — el llamador puede no tener nada que pasar
    expect(tablasFrias(undefined)).toEqual([])
  })
})

describe('remedioVisibilidad — el hallazgo trae su arreglo', () => {
  it('sin el ajuste de inserts → propone el ALTER exacto', () => {
    const v = classifyVisibility(t('test_questions', 298_600, 201_651, false))
    expect(remedioVisibilidad(v)).toContain('ALTER TABLE public.test_questions')
    expect(remedioVisibilidad(v)).toContain('autovacuum_vacuum_insert_scale_factor = 0.01')
  })

  it('CON el ajuste ya puesto → manda mirar otra cosa, no repetir el ALTER', () => {
    const v = classifyVisibility(t('test_questions', 298_600, 201_651, true))
    expect(remedioVisibilidad(v)).not.toContain('ALTER TABLE')
    expect(remedioVisibilidad(v)).toContain('autovacuum no llega')
  })
})
