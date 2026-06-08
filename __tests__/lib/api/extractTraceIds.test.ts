// __tests__/lib/api/extractTraceIds.test.ts
//
// Tests del helper de observabilidad extractTraceIds (withErrorLogging).
//
// Contexto: tras el caso Rosa (07/06), los eventos request_completed no
// llevaban identificadores → imposible trazar las ~50 llamadas de un examen
// concreto entre cientos de POST anónimos. Este helper extrae userId/testId/
// questionId/questionOrder del body para poder reconstruir el journey desde SQL.
//
// Invariantes que protege:
//   - Whitelist estricta: solo claves conocidas, nunca PII ni texto libre.
//   - Type-safe: ignora valores del tipo incorrecto (no ensucia user_id::uuid).
//   - Defensivo: body undefined / no-objeto no rompe.

import { extractTraceIds } from '@/lib/api/withErrorLogging'

describe('extractTraceIds — observabilidad de traza', () => {

  describe('Extracción de identificadores conocidos', () => {
    it('extrae testId y questionId (caso /api/exam/answer)', () => {
      const body = {
        testId: 'a31549e2-fb1b-44e2-9773-8d1fc9d597e6',
        questionId: '9710395b-0534-4ea9-9864-e056e586968f',
        questionOrder: 12,
        userAnswer: 'c', // ← NO debe extraerse (no es identificador de traza)
      }
      const result = extractTraceIds(body)
      expect(result.testId).toBe('a31549e2-fb1b-44e2-9773-8d1fc9d597e6')
      expect(result.questionId).toBe('9710395b-0534-4ea9-9864-e056e586968f')
      expect(result.questionOrder).toBe(12)
    })

    it('extrae userId cuando el body lo incluye', () => {
      const body = { userId: 'aac0f10d-44a1-44ed-9b33-904c5ac09dab', testId: 'x' }
      expect(extractTraceIds(body).userId).toBe('aac0f10d-44a1-44ed-9b33-904c5ac09dab')
    })

    it('omite claves ausentes (solo devuelve lo presente)', () => {
      const result = extractTraceIds({ testId: 'solo-test' })
      expect(result.testId).toBe('solo-test')
      expect(result.userId).toBeUndefined()
      expect(result.questionId).toBeUndefined()
      expect(result.questionOrder).toBeUndefined()
    })
  })

  describe('Seguridad de tipos (no ensuciar columnas)', () => {
    it('ignora testId que no es string', () => {
      expect(extractTraceIds({ testId: 12345 as unknown as string }).testId).toBeUndefined()
    })

    it('ignora questionOrder que no es number', () => {
      expect(extractTraceIds({ questionOrder: '12' as unknown as number }).questionOrder).toBeUndefined()
    })

    it('ignora userId null/objeto (no rompe user_id::uuid)', () => {
      expect(extractTraceIds({ userId: null as unknown as string }).userId).toBeUndefined()
      expect(extractTraceIds({ userId: {} as unknown as string }).userId).toBeUndefined()
    })

    it('NO extrae campos sensibles ni de texto libre', () => {
      const body = {
        testId: 'ok',
        email: 'rosa@example.com',
        password: 'secreto',
        questionText: 'texto largo de la pregunta',
        userAnswer: 'b',
      }
      const result = extractTraceIds(body)
      // Solo testId pasa la whitelist
      expect(result).toEqual({ testId: 'ok' })
      expect(JSON.stringify(result)).not.toContain('rosa@example.com')
      expect(JSON.stringify(result)).not.toContain('secreto')
    })
  })

  describe('Robustez (input defensivo)', () => {
    it('body undefined devuelve objeto vacío', () => {
      expect(extractTraceIds(undefined)).toEqual({})
    })

    it('body vacío devuelve objeto vacío', () => {
      expect(extractTraceIds({})).toEqual({})
    })

    it('questionOrder=0 se extrae (0 es válido, no falsy-skip)', () => {
      // Nota: el caller filtra con `!= null`, así que 0 debe propagarse aquí.
      expect(extractTraceIds({ questionOrder: 0 }).questionOrder).toBe(0)
    })
  })
})
