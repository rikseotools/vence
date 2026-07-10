// __tests__/lib/teoria/detectFlattenedTable.test.ts
// Detector de tablas aplanadas (fix escalable de formato — Fase 1 detección).
// Fixtures = casos REALES sacados del escaneo de la BD (10/07).
import { detectFlattenedTable } from '@/lib/teoria/detectFlattenedTable'

describe('detectFlattenedTable', () => {
  it('vacío / null → no detecta', () => {
    expect(detectFlattenedTable('').detected).toBe(false)
    expect(detectFlattenedTable(null).detected).toBe(false)
    expect(detectFlattenedTable(undefined).detected).toBe(false)
  })

  it('texto normal en párrafos → no detecta', () => {
    const raw = 'La jornada será de treinta y cinco horas semanales.\nLa duración especial será de treinta y siete horas.'
    expect(detectFlattenedTable(raw).detected).toBe(false)
  })

  it('tabla aplanada de CÓDIGOS (Decreto 42/2019 art 4: Grupo→valor) → detecta', () => {
    const raw = 'grupos siguientes:\nA1\nE038\nA2\nE023\nB\nE021\nC1\nE019'
    const r = detectFlattenedTable(raw)
    expect(r.detected).toBe(true)
    expect(r.classification).toBe('flattened_table')
    expect(r.cellCount).toBeGreaterThanOrEqual(8)
    expect(r.cells).toContain('E038')
  })

  it('tabla aplanada NUMÉRICA (LO 5/1985: rango→nº concejales) → detecta', () => {
    const raw = 'según la escala:\nHasta 100 residentes\n3\nDe 101 a 250 residentes\n5\nDe 251 a 1.000\n7'
    expect(detectFlattenedTable(raw).detected).toBe(true)
  })

  it('ÍNDICE de estructura (TÍTULO/CAPÍTULO) → NO se marca (falso positivo)', () => {
    const raw = 'estructura:\nTÍTULO IV\nRégimen sancionador\nCAPÍTULO I\nInfracciones'
    const r = detectFlattenedTable(raw)
    expect(r.detected).toBe(false)
    expect(r.classification).toBe('structure_index')
  })

  it('run corto (<4 celdas) → no detecta (no es tabla)', () => {
    const raw = 'texto previo largo que no es celda alguna aquí\nA1\nE038'
    expect(detectFlattenedTable(raw).detected).toBe(false)
  })

  it('devuelve las celdas para preview/reconstrucción', () => {
    const raw = 'x:\n2051\n3,2\n2052\n3,6\n2053\n4,1'
    const r = detectFlattenedTable(raw)
    expect(r.detected).toBe(true)
    expect(r.cells.slice(0, 4)).toEqual(['2051', '3,2', '2052', '3,6'])
  })
})
