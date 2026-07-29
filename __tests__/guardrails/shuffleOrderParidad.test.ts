// __tests__/guardrails/shuffleOrderParidad.test.ts
//
// GUARDARRAÍL: las DOS implementaciones de /api/v2/answer-and-save tratan el barajado igual.
//
// INCIDENTE QUE LO MOTIVA (T-235, piloto de barajado): el canary enruta ese endpoint al
// backend NestJS (`lib/api/backend-router.ts` → 'answer-and-save': true), pero el backend
// no sabía NADA del barajado:
//   · su esquema Zod no declaraba `optionOrder` → Zod lo BORRA en silencio,
//   · su schema Drizzle no tenía la columna `option_order`,
//   · y comparaba la posición MOSTRADA contra la clave ORIGINAL.
// Resultado: `test_questions.option_order` NULL en el 100% de la historia y 56 respuestas
// ACERTADAS marcadas como fallo (8 usuarios de Valencia), irreparables porque la
// permutación no se guardó. El frontend estaba correcto de punta a punta: por eso la
// revisión "de la cadena" no lo encontró — miraba UNA de las dos implementaciones.
//
// Este test falla si vuelven a divergir.
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { isValidOrder, displayedToOriginal } from '@/lib/shuffle/permute'
import { isValidExposureOrder } from '@/lib/shuffle/subsetOrder'

const raiz = process.cwd()
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

describe('paridad del barajado entre frontend y backend', () => {
  it('AMBOS esquemas de entrada declaran optionOrder (si no, Zod lo borra sin avisar)', () => {
    expect(leer('lib/api/v2/answer-and-save/schemas.ts')).toMatch(/optionOrder:\s*z\.array\(z\.number\(\)\.int\(\)\)/)
    expect(leer('backend/src/answer-save/answer-save.types.ts')).toMatch(/optionOrder:\s*z\.array\(z\.number\(\)\.int\(\)\)/)
  })

  it('AMBOS schemas de BD declaran la columna option_order', () => {
    expect(leer('db/schema.ts')).toMatch(/optionOrder:\s*integer\(["']option_order["']\)\.array\(\)/)
    expect(leer('backend/src/db/schema.ts')).toMatch(/optionOrder:\s*integer\(["']option_order["']\)\.array\(\)/)
  })

  it('AMBOS validan con la versión que admite SUBCONJUNTOS (T-267)', () => {
    // Desde T-267 una pregunta puede servirse con 3 de sus 4 opciones. `isValidOrder`
    // exige permutación completa: con él, esos órdenes se tomarían por corruptos → se
    // trataría como identidad → se corregiría la posición mostrada contra la clave
    // original. Es el mismo fallo que marcó 56 aciertos como error, por otra puerta.
    for (const rel of [
      'lib/api/v2/answer-and-save/queries.ts',
      'backend/src/answer-save/answer-save.service.ts',
    ]) {
      const src = leer(rel)
      expect(src).toContain('isValidExposureOrder')
      expect(src).not.toMatch(/\bisValidOrder\(/)
    }
  })

  it('la copia backend de isValidExposureOrder se comporta IGUAL que el original', () => {
    const cuerpo = leer('backend/src/shuffle/subset-order.ts')
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/export const/g, 'const')
      .replace(/export function/g, 'function')
      .replace(/order: unknown/g, 'order')
      .replace(/mostradas: number/g, 'mostradas')
      .replace(/maxOriginales: number = MAX_OPCIONES_BANCO/g, 'maxOriginales = MAX_OPCIONES_BANCO')
      .replace(/\): order is number\[\] \{/g, ') {')
      .replace(/new Set<number>\(\)/g, 'new Set()')
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const back = new Function(`${cuerpo}; return { isValidExposureOrder };`)() as {
      isValidExposureOrder: (o: unknown, m: number) => boolean
    }
    const casos: Array<[unknown, number]> = [
      [[2, 3, 0, 1], 4], [[2, 0, 3], 3], [[3, 1, 0], 3], [[2, 0, 3], 4],
      [[0, 0, 1], 3], [[0, 1, 9], 3], [[0, 1, -1], 3], [null, 3], ['0,1,2', 3], [[], 0],
    ]
    for (const [orden, mostradas] of casos) {
      expect(back.isValidExposureOrder(orden, mostradas)).toBe(isValidExposureOrder(orden, mostradas))
    }
  })

  it('AMBOS mapean la posición mostrada al índice original antes de corregir', () => {
    // Comparar `userAnswer === correctOption` a pelo es EXACTAMENTE el bug: marca
    // fallo a quien acertó cuando la pregunta se sirvió barajada.
    for (const rel of [
      'lib/api/v2/answer-and-save/queries.ts',
      'backend/src/answer-save/answer-save.service.ts',
    ]) {
      const src = leer(rel)
      expect(src).toContain('displayedToOriginal')
      // La validación es la que admite subconjuntos (ver el test de arriba).
      expect(src).toContain('isValidExposureOrder')
    }
  })

  it('AMBOS emiten el detector de clave rota ante un orden inválido', () => {
    for (const rel of [
      'lib/api/v2/answer-and-save/queries.ts',
      'backend/src/answer-save/answer-save.service.ts',
    ]) {
      expect(leer(rel)).toContain('shuffle_option_order_invalid')
    }
  })

  it('la copia del backend se comporta IGUAL que el original (no basta con que exista)', () => {
    const rel = 'backend/src/shuffle/permute.ts'
    expect(existsSync(join(raiz, rel))).toBe(true)

    // Se despoja de tipos y comentarios para poder EJECUTAR la copia y comparar su
    // comportamiento con el original (comparar texto no valdría: los estilos difieren).
    const cuerpo = leer(rel)
      .replace(/\/\*\*[\s\S]*?\*\//g, '')
      .replace(/export function/g, 'function')
      .replace(/order: number\[\] \| null \| undefined/g, 'order')
      .replace(/order: unknown/g, 'order')
      .replace(/displayedIdx: number/g, 'displayedIdx')
      .replace(/n: number/g, 'n')
      .replace(/\): order is number\[\] \{/g, ') {')
      .replace(/\): number \{/g, ') {')
      .replace(/\): boolean \{/g, ') {')
      .replace(/const seen = new Set<number>\(\)/g, 'const seen = new Set()')

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const back = new Function(
      `${cuerpo}; return { isValidOrder, displayedToOriginal };`,
    )() as { isValidOrder: (o: unknown, n: number) => boolean; displayedToOriginal: (o: number[] | null, i: number) => number }

    const casosValidez: Array<[unknown, number]> = [
      [[2, 3, 0, 1], 4], [[0, 1, 2, 3], 4], [[0, 1, 2], 4], [[0, 1, 1, 2], 4],
      [[0, 1, 2, 9], 4], [[0, 1, 2, -1], 4], [null, 4], ['0,1,2,3', 4], [[], 4], [[0], 1],
    ]
    for (const [orden, n] of casosValidez) {
      expect(back.isValidOrder(orden, n)).toBe(isValidOrder(orden, n))
    }

    const casosMapeo: Array<[number[] | null, number]> = [
      [[2, 3, 0, 1], 0], [[2, 3, 0, 1], 1], [[2, 3, 0, 1], 2], [[2, 3, 0, 1], 3],
      [null, 0], [null, 3], [[1, 0], 0], [[1, 0], 1],
    ]
    for (const [orden, idx] of casosMapeo) {
      expect(back.displayedToOriginal(orden, idx)).toBe(displayedToOriginal(orden, idx))
    }
  })
})
