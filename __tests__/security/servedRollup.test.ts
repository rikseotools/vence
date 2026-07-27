// Tests de la lógica PURA del rollup de preguntas servidas
// (lib/security/challengePolicy/servedRollup.ts).
//
// Contexto (auditoría 27/07/2026): todo lo que medía consumo miraba respuestas
// GUARDADAS (`daily_question_usage`). La cosecha de un banco no responde: el
// 16/05/2026 un usuario tuvo ese contador en 2 mientras se le servían 5.495
// preguntas. Este rollup hace duradero el contador de SERVIDAS que ya existía en
// Redis, con los mismos sujetos, para que los detectores puedan verlo.

import {
  subjectKindOf,
  rollupRowsFor,
} from '@/lib/security/challengePolicy/servedRollup'
import type { GateSubject } from '@/lib/security/challengePolicy/questionsServed'

const sub = (key: string): GateSubject => ({ key, threshold: 500 })

describe('subjectKindOf', () => {
  // Las claves las construye gateSubjects(): uuid en crudo, ip:<ip>, device:<id>.
  it('reconoce los tres tipos que produce gateSubjects', () => {
    expect(subjectKindOf('9f1c8e2a-0000-0000-0000-000000000000')).toBe('user')
    expect(subjectKindOf('ip:203.0.113.7')).toBe('ip')
    expect(subjectKindOf('device:abc-123')).toBe('device')
  })

  it('IPv6 con dos puntos no se confunde con un prefijo', () => {
    expect(subjectKindOf('ip:2a0c:5a84:f60e:7600:105:e4ad:abec:85c6')).toBe('ip')
  })

  it('lo no prefijado se trata como usuario (así se construyen hoy)', () => {
    expect(subjectKindOf('cualquier-cosa')).toBe('user')
  })
})

describe('rollupRowsFor', () => {
  it('produce una fila por sujeto con su tipo', () => {
    const rows = rollupRowsFor([sub('user-1'), sub('device:d1')], 25)
    expect(rows).toEqual([
      { subjectKey: 'user-1', subjectKind: 'user', served: 25 },
      { subjectKey: 'device:d1', subjectKind: 'device', served: 25 },
    ])
  })

  // El UPSERT usa (subject_key, usage_date) como PK: dos filas con la misma
  // clave en el mismo INSERT harían fallar la sentencia entera en Postgres
  // ("ON CONFLICT DO UPDATE command cannot affect row a second time").
  it('deduplica claves repetidas para no romper el ON CONFLICT', () => {
    const rows = rollupRowsFor([sub('user-1'), sub('user-1')], 10)
    expect(rows).toHaveLength(1)
  })

  it('ignora claves vacías o en blanco', () => {
    expect(rollupRowsFor([sub(''), sub('   '), sub('user-1')], 5)).toEqual([
      { subjectKey: 'user-1', subjectKind: 'user', served: 5 },
    ])
  })

  it('recorta espacios de la clave (misma clave = misma fila)', () => {
    expect(rollupRowsFor([sub('  user-1  ')], 5)[0].subjectKey).toBe('user-1')
  })

  describe('cantidades que no hay que contabilizar', () => {
    it.each([0, -1, NaN, Infinity])('no genera filas con n=%p', (n) => {
      expect(rollupRowsFor([sub('user-1')], n)).toEqual([])
    })

    it('trunca decimales (la columna es integer)', () => {
      expect(rollupRowsFor([sub('user-1')], 25.9)[0].served).toBe(25)
    })
  })

  it('sin sujetos no hay nada que escribir', () => {
    expect(rollupRowsFor([], 25)).toEqual([])
  })
})
