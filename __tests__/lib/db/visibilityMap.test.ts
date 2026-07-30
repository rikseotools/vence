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
    // Sin datos de filas muertas/inserts no se puede afirmar que sea irreparable: manda mirar el
    // autovacuum, que es lo honesto. La afirmación fuerte («no se arreglará sola») exige la cuenta.
    expect(remedioVisibilidad(v)).toMatch(/autovacuum llega/)
    expect(remedioVisibilidad(v)).not.toMatch(/NO se arreglará sola/)
  })
})

describe('tablasSinAjuste — marcar ANTES de que se enfríe (30/07)', () => {
  // El detector de frías llega tarde: el 29/07 se aplicó el ajuste a las 13 que estaban frías EN
  // ESE MOMENTO y a la mañana siguiente observable_events —la mayor, ~3 GB— había caído al 85,9%
  // porque no estaba en aquella lista. Perseguirlas de una en una garantiza que siempre haya alguna
  // esperando a enfriarse.
  const { tablasSinAjuste } = require('@/lib/db/visibilityMap.cjs') as {
    tablasSinAjuste: (t: Tabla[]) => Array<Veredicto & { motivo: string }>
  }

  it('marca una tabla grande sin ajuste AUNQUE esté al 100%', () => {
    const r = tablasSinAjuste([t('observable_events', 392_136, 392_136, false)])
    expect(r).toHaveLength(1)
    expect(r[0].motivo).toBe('sin_ajuste_inserts')
  })

  it('NO marca la que ya está protegida', () => {
    expect(tablasSinAjuste([t('test_questions', 299_675, 299_668, true)])).toEqual([])
  })

  it('NO marca tablas pequeñas (no duelen y ensucian la lista)', () => {
    expect(tablasSinAjuste([t('chica', VM_MIN_PAGES - 1, 0, false)])).toEqual([])
  })

  it('ordena por tamaño: la grande primero', () => {
    const r = tablasSinAjuste([t('mediana', 9_000, 9_000, false), t('enorme', 392_136, 392_136, false)])
    expect(r.map(x => x.relname)).toEqual(['enorme', 'mediana'])
  })

  it('tolera lista vacía o ausente', () => {
    expect(tablasSinAjuste([])).toEqual([])
    // @ts-expect-error — entrada inválida a propósito
    expect(tablasSinAjuste(undefined)).toEqual([])
  })
})

describe('remedioVisibilidad — el hallazgo trae la CAUSA, no un «revisa»', () => {
  it('caso REAL de questions: por debajo de los DOS disparadores → no se arregla sola', () => {
    // 7.394 muertas contra umbral 8.084 (scale 0.05 · 159.671 vivas) y 0 inserts. Podía quedarse al
    // 78,5% indefinidamente, y con el mensaje viejo («revisa el autovacuum») hubo que diagnosticarlo
    // a mano.
    const v = classifyVisibility({
      relname: 'questions', relpages: 42_183, relallvisible: 33_112, tieneAjusteInserts: true,
      vivas: 159_671, muertas: 7_394, insPendientes: 0, scaleFactorMuertas: 0.05,
    } as unknown as Tabla)
    const r = remedioVisibilidad(v)
    expect(r).toMatch(/NO se arreglará sola/)
    expect(r).toMatch(/8084/)
    expect(r).toMatch(/VACUUM \(ANALYZE\) manual/)
  })

  it('si hay inserts pendientes, el autovacuum SÍ puede llegar: no dice que sea irreparable', () => {
    const v = classifyVisibility({
      relname: 'observable_events', relpages: 392_136, relallvisible: 336_666, tieneAjusteInserts: true,
      vivas: 9_000_000, muertas: 100, insPendientes: 370_960, scaleFactorMuertas: 0.01,
    } as unknown as Tabla)
    expect(remedioVisibilidad(v)).not.toMatch(/NO se arreglará sola/)
  })
})
