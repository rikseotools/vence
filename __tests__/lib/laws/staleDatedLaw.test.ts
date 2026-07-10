// __tests__/lib/laws/staleDatedLaw.test.ts
// Unit del detector de leyes anuales caducadas (gap cazado por jinayda32, 10/07).
import { detectStaleDatedLaw } from '@/lib/laws/staleDatedLaw'

const Y = 2026

describe('detectStaleDatedLaw', () => {
  it('CASO jinayda: Presupuestos CM para el año 2025 → CADUCADA en 2026', () => {
    const r = detectStaleDatedLaw('Ley 9/2024, de 26 de diciembre, de Presupuestos Generales de la Comunidad de Madrid para el año 2025', Y)
    expect(r).toEqual({ isDated: true, targetYear: 2025, isStale: true })
  })

  it('la vigente (para el año 2026) → NO caducada', () => {
    const r = detectStaleDatedLaw('Ley 6/2025, de 23 de diciembre, de Presupuestos Generales de la Comunidad de Madrid para el año 2026', Y)
    expect(r).toEqual({ isDated: true, targetYear: 2026, isStale: false })
  })

  it('PGE estatal para el año 2023 → caducada', () => {
    expect(detectStaleDatedLaw('Ley 31/2022, de 23 de diciembre, de Presupuestos Generales del Estado para el año 2023', Y).isStale).toBe(true)
  })

  it('FALSO POSITIVO EVITADO: Ley 47/2003 General Presupuestaria (marco permanente) → NO dated', () => {
    const r = detectStaleDatedLaw('Ley 47/2003, de 26 de noviembre, General Presupuestaria', Y)
    expect(r.isDated).toBe(false)
    expect(r.isStale).toBe(false)
  })

  it('FALSO POSITIVO EVITADO: fecha de promulgación "de 2003" no es año objetivo', () => {
    expect(detectStaleDatedLaw('Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público', Y).isStale).toBe(false)
  })

  it('"del ejercicio 2024" → caducada', () => {
    expect(detectStaleDatedLaw('Presupuesto del ejercicio 2024', Y).isStale).toBe(true)
  })

  it('"para 2026" (Universidad Granada) → vigente', () => {
    expect(detectStaleDatedLaw('Presupuesto de la Universidad de Granada para 2026: Bases de ejecución', Y).isStale).toBe(false)
  })

  it('vacío / null → no dated, no stale', () => {
    expect(detectStaleDatedLaw(null, Y)).toEqual({ isDated: false, targetYear: null, isStale: false })
    expect(detectStaleDatedLaw('', Y).isStale).toBe(false)
  })
})
