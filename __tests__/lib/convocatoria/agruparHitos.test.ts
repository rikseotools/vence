import { agruparHitosPorConvocatoria, type HitoConvocatoria } from '@/lib/api/convocatoria/queries'

// Caso real que motivó la vía-a (manual OEPs §4e-ter): Aux. Admin. Comunidad de Madrid
// tenía DOS convocatorias vivas y la landing pintaba los hitos en una sola lista
// cronológica → dos "Convocatoria publicada en BOCM" y dos "Apertura del plazo de
// inscripción" seguidos. Esther Pimentel no supo a cuál inscribirse.
const hito = (p: Partial<HitoConvocatoria> & { id: string; orderIndex: number }): HitoConvocatoria => ({
  fecha: '2026-01-01',
  titulo: 'Hito',
  descripcion: null,
  url: null,
  status: 'completed',
  convocatoriaId: null,
  convocatoriaNumero: null,
  convocatoriaPlazas: null,
  convocatoriaEstado: null,
  convocatoriaEsActual: false,
  ...p,
})

describe('agruparHitosPorConvocatoria', () => {
  it('separa los hitos de dos ciclos vivos en bloques distintos', () => {
    const bloques = agruparHitosPorConvocatoria([
      hito({ id: 'a', orderIndex: 1, fecha: '2026-06-04', convocatoriaId: 'vieja', convocatoriaNumero: null, convocatoriaPlazas: 645 }),
      hito({ id: 'b', orderIndex: 2, fecha: '2026-07-14', convocatoriaId: 'nueva', convocatoriaNumero: 'Orden 1628/2026', convocatoriaPlazas: 673, convocatoriaEsActual: true }),
    ])
    expect(bloques).toHaveLength(2)
    expect(bloques.flatMap(b => b.hitos.map(h => h.id)).sort()).toEqual(['a', 'b'])
  })

  it('pone PRIMERO el ciclo vigente aunque sus hitos sean más recientes o más antiguos', () => {
    const bloques = agruparHitosPorConvocatoria([
      hito({ id: 'vieja1', orderIndex: 1, fecha: '2026-09-30', convocatoriaId: 'vieja' }),
      hito({ id: 'actual1', orderIndex: 2, fecha: '2026-07-14', convocatoriaId: 'nueva', convocatoriaNumero: 'Orden 1628/2026', convocatoriaEsActual: true }),
    ])
    expect(bloques[0].numero).toBe('Orden 1628/2026')
    expect(bloques[0].esActual).toBe(true)
  })

  it('mantiene el orden interno por orderIndex dentro de cada bloque', () => {
    const bloques = agruparHitosPorConvocatoria([
      hito({ id: 'tercero', orderIndex: 3, convocatoriaId: 'c1' }),
      hito({ id: 'primero', orderIndex: 1, convocatoriaId: 'c1' }),
      hito({ id: 'segundo', orderIndex: 2, convocatoriaId: 'c1' }),
    ])
    expect(bloques[0].hitos.map(h => h.id)).toEqual(['primero', 'segundo', 'tercero'])
  })

  it('con UNA sola convocatoria devuelve un único bloque (la landing se ve igual que antes)', () => {
    const bloques = agruparHitosPorConvocatoria([
      hito({ id: 'a', orderIndex: 1, convocatoriaId: 'c1', convocatoriaEsActual: true }),
      hito({ id: 'b', orderIndex: 2, convocatoriaId: 'c1', convocatoriaEsActual: true }),
    ])
    expect(bloques).toHaveLength(1)
    expect(bloques[0].hitos).toHaveLength(2)
  })

  it('no pierde los hitos sueltos (sin convocatoria asignada): van a su propio bloque', () => {
    const bloques = agruparHitosPorConvocatoria([
      hito({ id: 'suelto', orderIndex: 1 }),
      hito({ id: 'conCiclo', orderIndex: 2, convocatoriaId: 'c1', convocatoriaEsActual: true }),
    ])
    expect(bloques).toHaveLength(2)
    expect(bloques.flatMap(b => b.hitos.map(h => h.id)).sort()).toEqual(['conCiclo', 'suelto'])
    // el vigente manda, el suelto queda debajo
    expect(bloques[0].hitos[0].id).toBe('conCiclo')
  })

  it('sin hitos devuelve lista vacía (no revienta ni inventa bloques)', () => {
    expect(agruparHitosPorConvocatoria([])).toEqual([])
  })
})
