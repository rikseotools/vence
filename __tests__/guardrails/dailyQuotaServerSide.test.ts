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
  // T-450 SEGUNDA VUELTA (01/08/2026): el primer arreglo se desplegó y NO SIRVIÓ.
  //
  // Cobrar en `/api/exam/validate` «solo lo que se estrena» es correcto como frase y es
  // inerte como código: `/api/exam/answer` ya ha escrito cada respuesta durante el examen,
  // así que cuando `validate` corre no estrena ninguna y cobra 0. Verificado en producción
  // con el primer examen posterior al deploy (10 respuestas, contador sin fila).
  //
  // La lección se repite una capa más abajo: este guardarraíl lee el CÓDIGO, así que puede
  // confirmar que el cobro existe y con qué condición, pero **no puede ver que la condición
  // nunca se cumple**. Eso solo lo ve el canario `npm run canary:cupo-vs-respuestas`, que
  // mira los datos. Por eso el cobro se comprueba en los DOS sitios y por eso el canario
  // no es opcional.
  it('el modo EXAMEN cobra donde persiste cada respuesta (el camino en vivo)', () => {
    const src = leer('app/api/exam/answer/route.ts')
    expect(src).toContain('incrementDailyCount(')
    // Misma política que answer-and-save, no un criterio propio.
    expect(src).toMatch(/debeConsumirCupo\(\s*result\.saveAction/)
    // El cobro va DESPUÉS de guardar: usa el resultado del save.
    expect(src.indexOf('saveAnswer(data)')).toBeLessThan(src.indexOf('incrementDailyCount('))
    // Y el comentario que decía «se incrementa en el frontend» no puede volver: describía
    // el reparto anterior al 29/07 y es literalmente el hueco por el que se coló esto.
    expect(src).not.toMatch(/Daily count se incrementa en el frontend/)
  })

  it('el examen deriva el `saveAction` de si la respuesta se ESTRENA', () => {
    // Rellenar una fila en blanco es estrenar (se cobra); re-responder una que ya tenía
    // respuesta, no. Y el caso de dos clics a la vez lo arbitra el motor (`xmax = 0`), no
    // el SELECT previo: los dos verían «no existe» y cobrarían dos veces la misma respuesta.
    const src = leer('lib/api/exam/queries.ts')
    expect(src).toMatch(/saveAction:\s*estabaEnBlanco\s*\?\s*'saved_new'\s*:\s*'already_saved'/)
    expect(src).toMatch(/xmax\s*=\s*0/)
    expect(src).toMatch(/saveAction:\s*result\[0\]\.insertada\s*\?\s*'saved_new'\s*:\s*'already_saved'/)
  })

  // TERCER camino, encontrado el 02/08 verificando T-450 en producción: el SIMULACRO
  // (examen oficial) tiene endpoints propios y no cobraba NADA. Medido antes de tocarlo:
  // 100 usuarios free y 4.975 respuestas en 7 días. Comparte el modo de fallo con el
  // examen normal — pre-crea sus filas al abrirse, así que guardar es un UPDATE y «la
  // fila ya existía» se confundía con «ya había respondido».
  it('el SIMULACRO (examen oficial) cobra donde guarda cada respuesta', () => {
    const src = leer('app/api/v2/official-exams/answer/route.ts')
    expect(src).toContain('incrementDailyCount(')
    expect(src).toMatch(/debeConsumirCupo\(\s*result\.saveAction/)
    // Después de guardar, nunca antes.
    expect(src.indexOf('saveOfficialExamAnswer(')).toBeLessThan(src.indexOf('incrementDailyCount('))
  })

  it('«premium» se decide con la lista canónica, no con una comparación a mano', () => {
    // El 02/08 este mismo arreglo introdujo `plan_type === 'premium'`, que dejaba fuera a
    // trial, legacy_free, premium_semester y admin. No cobró de más porque la función SQL
    // corta igual — pero eran dos definiciones del mismo concepto, que es como se rompen
    // las cosas más tarde y en otro sitio.
    const src = leer('lib/api/official-exams/queries.ts')
    expect(src).toContain('esPlanPremium(')
    expect(src).not.toMatch(/planType\s*===\s*'premium'/)
  })

  it('la lista de planes exentos del código es la MISMA que aplica la función SQL', () => {
    const { PREMIUM_PLAN_TYPES } = require('@/lib/api/daily-limit/config')
    const sql = leer('supabase/migrations/20260801_increment_daily_questions_amount.sql')
    // La migración la escribe como IN ('premium', 'trial', …). Si alguien añade un plan en
    // un sitio y no en el otro, el cupo se cobra distinto según por dónde entre la respuesta.
    const enSql = (sql.match(/IN \(([^)]*)\)/) || [])[1] || ''
    for (const plan of PREMIUM_PLAN_TYPES) {
      expect(enSql).toContain(`'${plan}'`)
    }
  })

  it('el SIMULACRO deriva el `saveAction` con la MISMA regla compartida', () => {
    const src = leer('lib/api/official-exams/queries.ts')
    // La regla no se reescribe aquí: se importa de la política de cupo. Una tercera copia
    // sería la tercera forma de equivocarse.
    expect(src).toContain("from '@/lib/api/dailyLimit'")
    expect(src).toMatch(/estrenaRespuesta\(record\.userAnswerPrevio\)/)
  })

  it('los TRES caminos usan la misma regla de «estrena», sin copias a mano', () => {
    // Si alguien vuelve a escribir la comparación a pelo en vez de importarla, este test
    // lo caza: es exactamente como nació el hueco del simulacro.
    for (const f of ['lib/api/exam/queries.ts', 'lib/api/official-exams/queries.ts']) {
      expect(leer(f)).toContain('estrenaRespuesta(')
    }
  })

  it('el modo EXAMEN cobra también al persistir en bloque lo que el save en vivo perdió', () => {
    const src = leer('app/api/exam/validate/route.ts')
    expect(src).toContain('incrementDailyCount(')
    // Se cobra con IMPORTE, no una llamada por respuesta: el examen se persiste en bloque.
    expect(src).toMatch(/incrementDailyCount\([^)]*nuevasRespondidas/)
    // Y solo si de verdad se ha estrenado alguna respuesta.
    expect(src).toMatch(/nuevasRespondidas\s*>\s*0/)
    // El cobro va DESPUÉS de persistir: usa el resultado de la persistencia.
    expect(src.indexOf('persistExamQuestions(testId')).toBeLessThan(src.indexOf('incrementDailyCount('))
  })

  // ── EL CUARTO CAMINO (T-450, 04/08/2026) ───────────────────────────────────────────────────
  // La red de seguridad de `complete-test` rellena en bloque las respuestas que la cola del
  // cliente no consiguió drenar, y lo hacía SIN cobrar. No era teórico: un free respondió 56
  // preguntas con el contador a cero porque sus 112 llamadas a `answer-and-save` se toparon con
  // el 403 del límite de dispositivos, así que TODAS acabaron aquí. El guardarraíl de
  // dispositivos frenaba el camino que cobra y dejaba entero el que no.
  it('la red de seguridad de complete-test cobra lo que rellena', () => {
    const src = leer('lib/api/v2/complete-test/queries.ts')
    expect(src).toContain('incrementDailyCount(')
    // Con IMPORTE y solo por lo que se ESTRENA: `gapFilledCount` son las filas que este insert
    // creó de verdad (el ON CONFLICT deja fuera las que ya estaban), así que no puede solaparse
    // con lo que ya cobró answer-and-save.
    expect(src).toMatch(/incrementDailyCount\([^)]*gapFilledCount/)
    // Y DESPUÉS de persistir, nunca antes.
    expect(src.indexOf('fillMissingTestQuestions')).toBeLessThan(src.indexOf('incrementDailyCount('))
  })

  it('la red de seguridad deja rastro: cuántas respuestas entran por ahí', () => {
    // Era un `console.log`, o sea invisible. Sin evento, el próximo agujero de cupo se vuelve a
    // descubrir por un usuario — que es exactamente como se descubrió este.
    const src = leer('lib/api/v2/complete-test/queries.ts')
    expect(src).toMatch(/eventType:\s*'cupo_safety_net'/)
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
