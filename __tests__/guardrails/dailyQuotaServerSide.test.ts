// __tests__/guardrails/dailyQuotaServerSide.test.ts
//
// GUARDARRAÍL: el cupo diario del plan gratuito lo cobra el SERVIDOR, tras guardar.
//
// Incidente que lo motiva (29/07/2026, caso Sergio): el contador lo incrementaba solo
// el cliente (`useDailyQuestionLimit.recordAnswer` → POST /api/v2/daily-question/increment),
// desacoplado del guardado y sin idempotencia. Efecto medido en 14 días sobre las tablas
// completas: 41 usuarios free agotaron el tope de 25 con una media de 13 respuestas reales.
//
// Vigila tres cosas que un test unitario no puede ver:
//   1. Ningún componente/hook de CLIENTE vuelve a llamar al endpoint de incremento.
//   2. Los DOS servidores que sirven answer-and-save (route de Next y controller del
//      backend NestJS, según el flag de canary) cobran, y lo hacen por `debeConsumirCupo`.
//   3. La política duplicada en ambos lados se comporta igual (paridad), mismo patrón
//      que `examPositionMapParity`.
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { debeConsumirCupo as debeConsumirCupoFront } from '@/lib/api/dailyLimit'

const raiz = process.cwd()
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

const ENDPOINT_INCREMENTO = '/api/v2/daily-question/increment'

// Ficheros de cliente que responden preguntas (los 4 callers de recordAnswer).
const COMPONENTES_CLIENTE = [
  'components/TestLayout.tsx',
  'components/ExamLayout.tsx',
  'components/OfficialExamLayout.tsx',
  'components/PsychometricTestLayout.tsx',
  'hooks/useDailyQuestionLimit.ts',
]

describe('guardarraíl: el cupo diario lo cobra el servidor', () => {
  it('ningún componente de cliente llama al endpoint de incremento', () => {
    const infractores: string[] = []

    for (const rel of COMPONENTES_CLIENTE) {
      if (!existsSync(join(raiz, rel))) continue
      const src = leer(rel)
      // Se busca la llamada real (fetch al endpoint), no la mención en comentarios.
      const lineas = src.split('\n')
      lineas.forEach((linea, i) => {
        const esComentario = /^\s*(\/\/|\*|\/\*)/.test(linea)
        if (esComentario) return
        if (linea.includes(ENDPOINT_INCREMENTO)) {
          infractores.push(`${rel}:${i + 1} → ${linea.trim().slice(0, 100)}`)
        }
      })
    }

    expect(infractores).toEqual([])
  })

  it('el route de Next cobra tras guardar, usando la política', () => {
    const src = leer('app/api/v2/answer-and-save/route.ts')
    expect(src).toContain('debeConsumirCupo(')
    expect(src).toContain('incrementDailyCount(')
    // El cobro va DESPUÉS del guardado: la llamada usa el resultado del save.
    expect(src).toMatch(/debeConsumirCupo\(\s*result\.saveAction/)
  })

  it('el controller del backend NestJS cobra igual (mismo endpoint por canary)', () => {
    const rel = 'backend/src/answer-save/answer-save.controller.ts'
    const src = leer(rel)
    expect(src).toContain('debeConsumirCupo(')
    expect(src).toContain('incrementDailyCount(')
    expect(src).toMatch(/debeConsumirCupo\(\s*result\.saveAction/)
  })

  it('psicotécnicos y ortografía también cobran server-side', () => {
    for (const rel of ['app/api/answer/psychometric/route.ts', 'app/api/answer/spelling/route.ts']) {
      const src = leer(rel)
      expect(src).toContain('incrementDailyCount(')
    }
  })

  // T-450 (01/08/2026): EL PUNTO CIEGO DE ESTE MISMO GUARDARRAÍL.
  //
  // Cuando el 29/07 se movió el cobro del cliente al servidor, este fichero listó los
  // caminos que cobran… y se dejó fuera el MODO EXAMEN, que no pasa por answer-and-save:
  // persiste sus respuestas EN BLOQUE en /api/exam/validate. Resultado medido cuatro días
  // después: 10.181 respuestas de examen en 7 días sin llegar al contador, y un usuario
  // free con 489 respuestas en 4 días mientras su contador marcaba ~65.
  //
  // La lección no es «se olvidó un fichero»: es que un guardarraíl que enumera caminos
  // solo protege los que enumeró. Por eso aquí se comprueba también el ORDEN (cobrar
  // después de persistir) y la CONDICIÓN (solo lo que se estrena), que es lo que
  // distingue cobrar bien de cobrar.
  it('el modo EXAMEN cobra al persistir en bloque, y solo lo que se estrena', () => {
    const src = leer('app/api/exam/validate/route.ts')
    expect(src).toContain('incrementDailyCount(')
    // Se cobra con IMPORTE, no una llamada por respuesta: el examen se persiste en bloque.
    expect(src).toMatch(/incrementDailyCount\([^)]*nuevasRespondidas/)
    // Y solo si de verdad se ha estrenado alguna respuesta.
    expect(src).toMatch(/nuevasRespondidas\s*>\s*0/)
    // El cobro va DESPUÉS de persistir: usa el resultado de la persistencia.
    expect(src.indexOf('persistExamQuestions(testId')).toBeLessThan(src.indexOf('incrementDailyCount('))
  })

  it('el examen NO cobra lo que no ha podido guardar', () => {
    // Misma regla que `save_failed` en answer-and-save: si la persistencia falla, no se le
    // cobra al usuario cupo por respuestas que no existen. El catch devuelve 0.
    const src = leer('app/api/exam/validate/route.ts')
    const captura = src.slice(src.indexOf('Error persistiendo test_questions'))
    expect(captura).toMatch(/nuevasRespondidas:\s*0/)
  })

  it('la política del backend es paritaria con la del frontend', () => {
    // Se compara COMPORTAMIENTO, no texto: se extrae la copia del backend y se
    // evalúan los mismos casos que la del frontend.
    const src = leer('backend/src/daily-limit/daily-limit.service.ts')
    expect(src).toContain('export function debeConsumirCupo(')

    const cuerpo = src.slice(src.indexOf('export function debeConsumirCupo('))
    const fin = cuerpo.indexOf('\n}')
    const fuente = cuerpo.slice(0, fin + 2)
      .replace('export function', 'function')
      .replace(/: string \| null \| undefined/g, '')
      .replace(/: boolean/g, '')

    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const debeConsumirCupoBack = new Function(
      `${fuente}; return debeConsumirCupo;`,
    )() as (a: unknown, p: boolean) => boolean

    const casos: Array<[string | null | undefined, boolean]> = [
      ['saved_new', false],
      ['already_saved', false],
      ['save_failed', false],
      ['saved_new', true],
      ['already_saved', true],
      [null, false],
      [undefined, false],
      ['ruido', false],
    ]

    for (const [accion, premium] of casos) {
      expect(debeConsumirCupoBack(accion, premium)).toBe(
        debeConsumirCupoFront(accion as never, premium),
      )
    }
  })
})
