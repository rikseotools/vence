// __tests__/config/examPenaltyCoherence.test.ts
//
// Garantiza que TODA oposición tenga su penalización de examen (`examScoring`)
// explícita y verificada contra fuente oficial. No se permite el default
// silencioso de 1/3: cada convocatoria penaliza distinto (1/3, 1/4, 1/2, sin
// penalización…) y aplicar un 1/3 genérico calcula mal la nota del modo examen.
//
// Origen: feedback de usuaria (02/06/2026) — la Junta de Extremadura penaliza
// cada 4 erróneas (1/4), no cada 3. Auditoría posterior reveló que ~18 de 47
// oposiciones NO eran 1/3. Cada valor está verificado en el `source` del config.
//
// Si añades una oposición nueva, este test fallará hasta que le pongas su
// `examScoring` con la regla oficial verificada (ver docs/maintenance/crear-nueva-oposicion.md).

import { readFileSync } from 'fs'
import { join } from 'path'
import { OPOSICIONES, getExamPenaltyPerWrong, getExamPenaltyLabel } from '@/lib/config/oposiciones'

// Réplica EXACTA de la fórmula de nota del modo examen (components/ExamLayout.tsx):
//   puntosBrutos = correctCount - (incorrectCount * penaltyPerWrong)
//   nota = max(0, (puntosBrutos / totalQuestions) * 10)
// Si esta réplica y el componente divergen, el test de "source guard" de abajo
// lo detecta (verifica que el componente use penaltyPerWrong y no un /3 fijo).
function notaModoExamen(positionType: string, correct: number, incorrect: number, total: number): number {
  const penaltyPerWrong = getExamPenaltyPerWrong(positionType)
  const puntosBrutos = correct - incorrect * penaltyPerWrong
  return Math.max(0, (puntosBrutos / total) * 10)
}

describe('Penalización del modo examen (examScoring)', () => {
  it('TODAS las oposiciones tienen examScoring explícito (sin default silencioso)', () => {
    const sinConfig = OPOSICIONES.filter(o => !o.examScoring).map(o => o.positionType)
    expect(sinConfig).toEqual([])
  })

  it('cada examScoring tiene source no vacío (fuente oficial verificada)', () => {
    const sinFuente = OPOSICIONES
      .filter(o => o.examScoring && (!o.examScoring.source || o.examScoring.source.trim().length < 10))
      .map(o => o.positionType)
    expect(sinFuente).toEqual([])
  })

  it('penaltyDivisor es null (sin penalización) o un número positivo', () => {
    const invalidos = OPOSICIONES
      .filter(o => {
        const d = o.examScoring?.penaltyDivisor
        return !(d === null || (typeof d === 'number' && d > 0))
      })
      .map(o => o.positionType)
    expect(invalidos).toEqual([])
  })

  it('getExamPenaltyPerWrong devuelve la fracción correcta por oposición', () => {
    // Casos verificados contra boletín oficial — ancla anti-regresión.
    expect(getExamPenaltyPerWrong('auxiliar_administrativo_estado')).toBeCloseTo(1 / 3, 6)   // BOE 1/3
    expect(getExamPenaltyPerWrong('auxiliar_administrativo_extremadura')).toBeCloseTo(1 / 4, 6) // DOE 1/4
    expect(getExamPenaltyPerWrong('auxiliar_administrativo_clm')).toBeCloseTo(1 / 4, 6)        // DOCM 1/4
    expect(getExamPenaltyPerWrong('policia_nacional')).toBeCloseTo(1 / 2, 6)                   // BOE 1/2 (3 alternativas)
    expect(getExamPenaltyPerWrong('auxiliar_administrativo_diputacion_cadiz')).toBeCloseTo(3 / 8, 6) // BOP 3/8
    expect(getExamPenaltyPerWrong('correos_personal_operativo')).toBe(0)                       // sin penalización
    expect(getExamPenaltyPerWrong('auxiliar_administrativo_scs_canarias')).toBe(0)             // sin penalización
  })

  it('fallback 1/3 solo para identificadores desconocidos', () => {
    expect(getExamPenaltyPerWrong('oposicion_que_no_existe')).toBeCloseTo(1 / 3, 6)
  })
})

describe('Simulación de la nota del modo examen', () => {
  it('Extremadura (1/4): caso real — corrige el antiguo 1/3 que penalizaba de más', () => {
    // Escenario tipo examen Extremadura: 43 preguntas, 30 aciertos, 13 fallos.
    const nueva = notaModoExamen('auxiliar_administrativo_extremadura', 30, 13, 43)
    expect(nueva).toBeCloseTo(((30 - 13 / 4) / 43) * 10, 6) // 6,22
    const antigua = ((30 - 13 / 3) / 43) * 10               // lo que daba el bug
    expect(nueva).toBeGreaterThan(antigua)
  })

  it('Estado (1/3): se mantiene la regla correcta', () => {
    expect(notaModoExamen('auxiliar_administrativo_estado', 30, 12, 60))
      .toBeCloseTo(((30 - 12 / 3) / 60) * 10, 6) // 4,33
  })

  it('Correos / SCS Canarias (sin penalización): los fallos no restan', () => {
    expect(notaModoExamen('correos_personal_operativo', 20, 30, 50))
      .toBeCloseTo((20 / 50) * 10, 6) // 4,00 — los 30 fallos no penalizan
    expect(notaModoExamen('auxiliar_administrativo_scs_canarias', 40, 10, 50))
      .toBeCloseTo((40 / 50) * 10, 6)
  })

  it('Policía Nacional (1/2) y Cádiz (3/8): penalizaciones no estándar', () => {
    expect(notaModoExamen('policia_nacional', 60, 20, 100))
      .toBeCloseTo(((60 - 20 / 2) / 100) * 10, 6) // 5,00
    expect(notaModoExamen('auxiliar_administrativo_diputacion_cadiz', 40, 8, 50))
      .toBeCloseTo(((40 - 8 * (3 / 8)) / 50) * 10, 6) // 0,375 por fallo
  })

  it('la nota nunca baja de 0 (muchos fallos)', () => {
    expect(notaModoExamen('auxiliar_administrativo_estado', 2, 58, 60)).toBe(0)
  })
})

describe('Source guard — ningún componente de examen penaliza con un /3 fijo', () => {
  // Los tres componentes que calculan/derivan la nota de un examen deben usar
  // getExamPenaltyPerWrong (penalización por oposición), nunca un divisor fijo.
  const COMPONENTES = [
    'components/ExamLayout.tsx',
    'components/OfficialExamLayout.tsx',
    'components/ExamReviewLayout.tsx',
  ]

  it.each(COMPONENTES)('%s usa getExamPenaltyPerWrong', (file) => {
    expect(readFileSync(join(process.cwd(), file), 'utf8')).toContain('getExamPenaltyPerWrong')
  })

  it.each(COMPONENTES)('%s no tiene "incorrectCount / 3" hardcodeado', (file) => {
    expect(readFileSync(join(process.cwd(), file), 'utf8')).not.toMatch(/incorrectCount\s*\/\s*3/)
  })

  it.each(COMPONENTES)('%s no muestra el literal "Cada 3 fallos restan 1 correcta" hardcodeado', (file) => {
    // Regresión real (Isabel, 18/06/2026): el texto estaba fijo a "Cada 3" aunque
    // la oposición penalizara 1/4. Debe derivar de getExamPenaltyLabel.
    expect(readFileSync(join(process.cwd(), file), 'utf8')).not.toContain('Cada 3 fallos restan 1 correcta')
  })
})

describe('getExamPenaltyLabel — texto coherente con la penalización', () => {
  it('refleja el divisor real de cada oposición (anclas verificadas)', () => {
    expect(getExamPenaltyLabel('auxiliar_administrativo_estado')).toBe('Cada 3 fallos restan 1 correcta')
    expect(getExamPenaltyLabel('administrativo_seguridad_social')).toBe('Cada 4 fallos restan 1 correcta') // caso Isabel
    expect(getExamPenaltyLabel('policia_nacional')).toBe('Cada 2 fallos restan 1 correcta')
  })

  it('sin penalización (divisor null) → texto explícito, no "Cada 0…"', () => {
    expect(getExamPenaltyLabel('correos_personal_operativo')).toBe('Sin penalización por error')
    expect(getExamPenaltyLabel('auxiliar_administrativo_scs_canarias')).toBe('Sin penalización por error')
  })

  it('divisor no entero (Cádiz 8/3) → expresa el descuento por fallo, sin frase "Cada N"', () => {
    expect(getExamPenaltyLabel('auxiliar_administrativo_diputacion_cadiz')).toBe('Cada fallo resta 0.38 de una correcta')
  })

  it('identificador desconocido → mismo default que el cálculo (1/3)', () => {
    expect(getExamPenaltyLabel('oposicion_que_no_existe')).toBe('Cada 3 fallos restan 1 correcta')
  })

  it('label y getExamPenaltyPerWrong NUNCA divergen (misma fuente del divisor)', () => {
    for (const o of OPOSICIONES) {
      const perWrong = getExamPenaltyPerWrong(o.positionType)
      const label = getExamPenaltyLabel(o.positionType)
      if (perWrong === 0) {
        expect(label).toBe('Sin penalización por error')
      } else {
        const divisor = 1 / perWrong
        if (Number.isInteger(divisor)) {
          expect(label).toBe(`Cada ${divisor} fallos restan 1 correcta`)
        } else {
          expect(label).toBe(`Cada fallo resta ${perWrong.toFixed(2)} de una correcta`)
        }
      }
    }
  })
})
