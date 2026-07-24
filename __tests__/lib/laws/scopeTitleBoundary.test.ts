/**
 * Detector de off-by-one de frontera de título (fix 24/07/2026, caso Mario/LOSU).
 * Fixture calcado del caso real: LOSU 2/2023, estructura oficial BOE-A-2023-7500.
 */
import { classifyTitleBoundary, seccionNumToInt } from '@/lib/laws/scopeTitleBoundary'

type Seccion = { num: string; from: number; to: number }

// Estructura título→rango de la LOSU (parseBoeSections sobre el índice del BOE).
const LOSU_SECCIONES: Seccion[] = [
  { num: 'Preliminar', from: 1, to: 1 },
  { num: 'I', from: 2, to: 3 },
  { num: 'II', from: 4, to: 5 },
  { num: 'III', from: 6, to: 8 },
  { num: 'IV', from: 9, to: 12 },
  { num: 'IX', from: 38, to: 63 },
]

// Epígrafe LITERAL del Tema 6 (verificado contra el PDF del BORM).
const EPIGRAFE_T6 =
  'Ley Orgánica 2/2023, de 22 de marzo, del Sistema Universitario: ' +
  'Título I: Funciones del sistema universitario y autonomía de las Universidades. ' +
  'Título II: Creación y reconocimiento de las Universidades y calidad del sistema universitario. ' +
  'Título IX. Régimen específico de las universidades públicas: Capítulo I. Régimen jurídico y estructura de las universidades públicas.'

describe('classifyTitleBoundary — LOSU Tema 6 (caso real Mario)', () => {
  it('caza art.1 (Título Preliminar) y art.6 (Título III) como overflow', () => {
    const scope = ['1', '2', '3', '4', '5', '6', '38', '39', '40', '41', '42', '43']
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, scope)
    expect(r.applicable).toBe(true)
    expect(r.allowedTitles).toEqual([1, 2, 9]) // I, II, IX (Preliminar NO nombrado)
    expect(r.overflow).toEqual([
      { article: 1, titulo: 'Preliminar' },
      { article: 6, titulo: 'III' },
    ])
  })

  it('el scope YA corregido (2-5, 38-43) no da overflow', () => {
    const scope = ['2', '3', '4', '5', '38', '39', '40', '41', '42', '43']
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, scope)
    expect(r.overflow).toEqual([])
  })

  it('NO aplica si el epígrafe no enumera títulos (prosa descriptiva)', () => {
    const r = classifyTitleBoundary('Control de accesos: conceptos, finalidad y tipos.', LOSU_SECCIONES, ['1', '2'])
    expect(r.applicable).toBe(false)
    expect(r.overflow).toEqual([])
  })

  it('artículo sin sección conocida va a unmapped, NO a overflow (fail-safe)', () => {
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, ['2', '99'])
    expect(r.overflow).toEqual([])
    expect(r.unmapped).toEqual([99])
  })

  it('ignora artículos no puramente numéricos (6.bis, DA1) en v1', () => {
    const r = classifyTitleBoundary(EPIGRAFE_T6, LOSU_SECCIONES, ['2', '6.bis', 'DA1'])
    expect(r.overflow).toEqual([]) // '6' sí sería overflow, pero '6.bis' se ignora
    expect(r.unmapped).toEqual([])
  })
})

describe('seccionNumToInt', () => {
  it('mapea Preliminar→0 y romanos→entero', () => {
    expect(seccionNumToInt('Preliminar')).toBe(0)
    expect(seccionNumToInt('I')).toBe(1)
    expect(seccionNumToInt('IX')).toBe(9)
    expect(seccionNumToInt('III')).toBe(3)
  })
})
