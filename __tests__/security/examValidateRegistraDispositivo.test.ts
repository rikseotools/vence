/**
 * @jest-environment node
 */
// Guardarraíl: el camino del modo EXAMEN tiene que registrar el dispositivo. (T-454, 01/08/2026)
//
// ── QUÉ PASABA ───────────────────────────────────────────────────────────────────────────────
// De los cuatro endpoints por los que se responde una pregunta, tres llamaban a
// `registerAndCheckDevice` y `/api/exam/validate` **no**: leía el `device_id` para el contador de
// servidas y lo tiraba. Quien solo hace exámenes no existía en `user_devices` — **39 usuarios en
// 7 días**, uno de ellos con 70 respuestas insertadas en el mismo minuto (un solo `test_id`,
// `question_order` 1-70: la firma de la inserción en bloque). Con ellos se quedaban ciegos el
// sweep de fraude (`multi_account_device`, `device_daily_farming`, `premium_sharing`), el límite
// de dispositivos por cuenta y el anti-autoreferido de `lib/referrals/activeSignup.ts`.
//
// ── POR QUÉ ESTE TEST ES DE FICHERO ──────────────────────────────────────────────────────────
// Lo que hay que impedir no es un cálculo, es una **omisión**: que alguien reescriba ese bloque y
// se deje el registro fuera otra vez, en silencio, como llevaba pasando. Un unitario del handler
// exigiría montar Next + Drizzle + la RPC; lo que de verdad protege aquí es que la llamada esté
// escrita y que el matiz de NO bloquear siga documentado donde se lee.
import fs from 'fs'
import path from 'path'

const RAIZ = path.join(__dirname, '..', '..')
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), 'utf8')

const VALIDATE = 'app/api/exam/validate/route.ts'

describe('el modo examen registra el dispositivo', () => {
  const src = leer(VALIDATE)

  it('llama a `registerAndCheckDevice` (era la única de las cuatro vías que no lo hacía)', () => {
    // `\b` no es decoración: sin él, `XXregisterAndCheckDevice(` pasaba el test — comprobado
    // mutando el fichero. Una coincidencia de SUBCADENA convierte el guardarraíl en teatro.
    expect(src).toMatch(/(?<![\w$])registerAndCheckDevice\s*\(/)
  })

  it('le pasa la HUELLA, no solo el `device_id`', () => {
    // Sin la huella, el registro depende de un `localStorage` que se borra en dos clics — que es
    // justo lo que [T-304] existe para no repetir.
    expect(src).toContain('getHwFingerprintFromRequest')
  })

  it('NO hace cumplir el límite: el veredicto se descarta', () => {
    // `validate` es el FINAL de un examen entero. Cortar aquí le tiraría al opositor el trabajo
    // de una hora, así que registrar no puede convertirse en bloquear.
    const bloque = src.slice(src.indexOf('registerAndCheckDevice('), src.indexOf('registerAndCheckDevice(') + 400)
    expect(bloque).toMatch(/\.catch\(/)
    // Si alguien empieza a usar su resultado para decidir, esto salta.
    expect(bloque).not.toMatch(/const\s+\w+\s*=\s*await\s+registerAndCheckDevice/)
    expect(bloque).not.toMatch(/\.allowed/)
  })

  it('el porqué de no bloquear sigue escrito donde se toca', () => {
    // Un matiz que solo vive en el commit se pierde. Si alguien borra la explicación, es señal
    // de que no la leyó.
    expect(src).toMatch(/NO se hace cumplir el límite|NO se hace cumplir el limite/)
  })
})

describe('las CUATRO vías de responder registran dispositivo', () => {
  // El fallo fue que una se quedó fuera y nadie lo notó durante meses. Enumerarlas aquí hace que
  // añadir una quinta sin registro ponga el CI en rojo.
  const VIAS = [
    'app/api/v2/answer-and-save/route.ts',
    'app/api/answer/psychometric/route.ts',
    'app/api/answer/spelling/route.ts',
    'app/api/exam/answer/route.ts',
    VALIDATE,
  ]

  it.each(VIAS)('%s registra el dispositivo', (ruta) => {
    expect(leer(ruta)).toMatch(/(?<![\w$])registerAndCheckDevice\s*\(/)
  })
})
