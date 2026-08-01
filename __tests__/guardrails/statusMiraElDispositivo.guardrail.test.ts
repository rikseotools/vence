/**
 * @jest-environment node
 *
 * El endpoint de estado del cupo TIENE que mirar el dispositivo, no solo la cuenta.
 *
 * POR QUÉ ESTE GUARDARRAÍL Y NO SOLO EL TEST DE LA REGLA ([T-418], 01/08/2026): el defecto que
 * costó 1.471 respuestas perdidas **no fue una regla mal escrita**. La regla del dispositivo
 * existía y funcionaba desde abril en `answer-and-save` — lo que faltaba era que llegase al
 * CLIENTE, que decide si levanta el muro leyendo únicamente este endpoint. O sea: el fallo
 * estuvo en el CABLEADO, no en la lógica, y un test que solo pruebe la función pura seguiría en
 * verde con el cableado quitado.
 *
 * Por eso aquí se comprueba que el endpoint sigue enchufado a las tres piezas: que lee las
 * cabeceras del aparato, que consulta el uso del dispositivo, y que aplica la regla al conteo
 * que devuelve. Validado por mutación: quitar cualquiera de las tres pone esto en rojo.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const RUTA = join(__dirname, '..', '..', 'app', 'api', 'v2', 'daily-question', 'status', 'route.ts')

describe('/api/v2/daily-question/status — cableado del cupo por dispositivo', () => {
  const fuente = readFileSync(RUTA, 'utf8')

  it('lee las cabeceras del dispositivo que ya manda el cliente', () => {
    // `getAuthHeaders()` envía X-Device-Id y X-Hw-Fingerprint en TODAS las llamadas, así que el
    // dato está disponible sin pedirle nada nuevo al cliente. Si alguien quita esto, el
    // endpoint vuelve a ser ciego al aparato.
    expect(fuente).toMatch(/getDeviceIdFromRequest\s*\(\s*request\s*\)/)
    expect(fuente).toMatch(/getHwFingerprintFromRequest\s*\(\s*request\s*\)/)
  })

  it('consulta el uso del DISPOSITIVO (no solo get_daily_question_status)', () => {
    expect(fuente).toMatch(/checkDeviceDailyUsage\s*\(/)
  })

  it('aplica la regla al conteo que se devuelve al cliente', () => {
    // No basta con consultarlo: el número que sale por la respuesta tiene que ser el efectivo,
    // porque es el que el hook compara contra el límite para decidir el muro.
    expect(fuente).toMatch(/conteoEfectivoConDispositivo\s*\(/)
    expect(fuente).toMatch(/questions_today\s*=\s*conteoEfectivoConDispositivo/)
  })

  it('sigue sacando el usuario del TOKEN, nunca del cuerpo ni de una cabecera', () => {
    // Invariante de seguridad preexistente: el conteo es de quien dice el token. Las cabeceras
    // del aparato son un dato ADICIONAL, no una identidad.
    expect(fuente).toMatch(/get_daily_question_status\(\$\{auth\.userId\}/)
  })
})
