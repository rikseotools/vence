// __tests__/lib/laws/scopeOverInclusion.test.ts
// Unit del detector de SOBRE-INCLUSIÓN de topic_scope (gap cazado por Luisa /
// Aux. Admvo. SMS T11, 21/07 — el epígrafe enumera 4 bloques pero el scope tenía
// la ley entera, y verify:scope lo dio en FALSO VERDE).
import { readFileSync } from 'fs'
import { classifyScope, parseEpigrafe, romanToInt } from '@/lib/laws/scopeOverInclusion'

describe('romanToInt', () => {
  it('convierte romanos', () => {
    expect(romanToInt('I')).toBe(1)
    expect(romanToInt('IV')).toBe(4)
    expect(romanToInt('IX')).toBe(9)
    expect(romanToInt('II.bis')).toBe(2)
  })
})

describe('parseEpigrafe', () => {
  it('cuenta segmentos por ; y por , tras el colon (frases reales, >=4 letras)', () => {
    const f = parseEpigrafe('Ley X: atención sanitaria; intimidad; deberes generales.')
    expect(f.segments).toBe(3)
    const g = parseEpigrafe('Ley X: principios rectores, medidas preventivas, detección; derechos.')
    expect(g.segments).toBe(4)
  })
  it('detecta huecos de títulos (nombra II y IV, salta III)', () => {
    const f = parseEpigrafe('Estatuto: Título I; Título II; Título IV.')
    expect(f.titSet).toEqual([1, 2, 4])
    expect(f.titGap).toBe(true)
  })
  it('secuencia completa de títulos → sin hueco', () => {
    const f = parseEpigrafe('Estatuto: Título Preliminar; Título I; Título II.')
    expect(f.titSet).toEqual([0, 1, 2])
    expect(f.titComplete).toBe(true)
  })
  it('extrae artículos citados explícitamente', () => {
    const f = parseEpigrafe('LO 3/2007: los planes (arts. 45 a 49); criterios (art. 51).')
    expect(f.explicitArts.has(45)).toBe(true)
    expect(f.explicitArts.has(49)).toBe(true)
    expect(f.explicitArts.has(51)).toBe(true)
  })
})

// Fixtures etiquetados (ground-truth). `expect` = ¿debe marcarse SOSPECHOSO?
const FIXTURES: Array<{ name: string; expect: boolean; lawTotal: number; scopedCount: number; epigrafe: string }> = [
  { name: 'T11 real (3 bloques subset, ley entera)', expect: true, lawTotal: 73, scopedCount: 73,
    epigrafe: 'Ley 3/2009: derechos relacionados con la atención y asistencia sanitaria; derechos en relación a la intimidad y a la confidencialidad; derechos en materia de información y participación sanitaria; deberes.' },
  { name: 'Estatuto monográfico (todos los títulos + reforma)', expect: false, lawTotal: 54, scopedCount: 54,
    epigrafe: 'El Estatuto de Autonomía: Título Preliminar; competencias (Título I); órganos institucionales (Título II); Administración de Justicia (Título III); Hacienda (Título IV); control (Título V); reforma' },
  { name: 'Ya estrechado correctamente (cobertura baja)', expect: false, lawTotal: 73, scopedCount: 23,
    epigrafe: 'Ley 3/2009: atención y asistencia; intimidad y confidencialidad; información y participación; deberes.' },
  { name: 'Ley pequeña scopeada entera (normal)', expect: false, lawTotal: 6, scopedCount: 6,
    epigrafe: 'Ley X: objeto; ámbito; principios.' },
  { name: 'Whole-law sin enumeración (no decidible → no marcar)', expect: false, lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015 del Procedimiento Administrativo Común.' },
  { name: 'Declara íntegra explícitamente', expect: false, lawTotal: 50, scopedCount: 50,
    epigrafe: 'Ley Y en su totalidad: disposiciones generales; procedimiento; régimen.' },
  { name: 'Título con hueco (nombra II y IV, salta III)', expect: true, lawTotal: 251, scopedCount: 251,
    epigrafe: 'Estatuto: Título Preliminar; Título I; Título II (salud); y Título IV (organización institucional).' },
  { name: 'Epígrafe cita arts. 45 a 49 y 51 pero scope 77', expect: true, lawTotal: 79, scopedCount: 77,
    epigrafe: 'LO 3/2007: objeto (Título Preliminar); tutela (Título I); los planes de igualdad (arts. 45 a 49); criterios de las AAPP (art. 51).' },
  { name: 'Frontera cobertura 0.9 ley mediana', expect: true, lawTotal: 20, scopedCount: 18,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },
  { name: 'Frontera cobertura 0.85 (por debajo)', expect: false, lawTotal: 20, scopedCount: 17,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },
  { name: 'SERMAS LO 1/2004 (enumeración por COMAS, ley entera)', expect: true, lawTotal: 73, scopedCount: 73,
    epigrafe: 'La LO 1/2004 contra la Violencia de Género: principios rectores, medidas de sensibilización, prevención y detección en el ámbito sanitario; derechos de las funcionarias públicas.' },
  { name: 'Generico con coma pero SIN colon (no marcar)', expect: false, lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015, del Procedimiento Administrativo Común de las Administraciones Públicas.' },
]

describe('classifyScope — casos etiquetados', () => {
  for (const fx of FIXTURES) {
    it(`${fx.expect ? 'SOSPECHOSO' : 'limpio'}: ${fx.name}`, () => {
      const r = classifyScope(fx)
      expect(r.suspect).toBe(fx.expect)
    })
  }

  it('el caso T11 real cae en banda MEDIUM (prosa, sin títulos ni arts citados)', () => {
    const r = classifyScope(FIXTURES[0])
    expect(r.band).toBe('MEDIUM')
  })

  it('el hueco-de-título es banda HIGH (accionable)', () => {
    const r = classifyScope(FIXTURES[6])
    expect(r.band).toBe('HIGH')
  })

  it('los arts citados con scope >> es banda HIGH', () => {
    const r = classifyScope(FIXTURES[7])
    expect(r.band).toBe('HIGH')
  })
})

// El sweep (scripts/health-sweep.cjs) lleva un MIRROR inline de classifyScope
// porque la imagen standalone no incluye lib/*.ts. Este test extrae ese mirror y
// verifica que NO diverge de la lib (una divergencia silenciosa ya ocurrió: un
// regex con prefijo cirílico + flag `i` casaba "capÍTULO" como "Título").
describe('sweep mirror ↔ lib (sync)', () => {
  const src = readFileSync('scripts/health-sweep.cjs', 'utf-8')
  const a = src.indexOf('const romanToInt = (s) =>')
  const b = src.indexOf('const overIncl =')
  it('el bloque mirror existe en el sweep', () => {
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })
  // eslint-disable-next-line no-eval
  const mirror: (lt: number, sc: number, ep: string) => { band: string } = eval(
    src.slice(a, b) + '\n(classifyScope)',
  )
  for (const fx of FIXTURES) {
    it(`mirror == lib: ${fx.name}`, () => {
      const lib = classifyScope(fx)
      const mir = mirror(fx.lawTotal, fx.scopedCount, fx.epigrafe)
      expect(mir.band).toBe(lib.band)
    })
  }
})
