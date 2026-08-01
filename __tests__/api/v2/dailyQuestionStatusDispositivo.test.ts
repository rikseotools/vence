/**
 * @jest-environment node
 *
 * El cliente tiene que enterarse del cupo del DISPOSITIVO, no solo del de su cuenta ([T-418]).
 *
 * POR QUÉ (medido el 01/08/2026 sobre 14 días): el servidor rechaza el guardado por dos
 * motivos —cupo de la CUENTA y cupo del DISPOSITIVO (todas las cuentas free del aparato
 * sumadas)— con el MISMO texto. Pero `/api/v2/daily-question/status`, que es lo único que mira
 * el cliente para levantar el muro, solo leía el de la cuenta. Consecuencia: **27 usuarios
 * contestaron 1.471 veces** (el 53% de todos los rechazos de cupo) sin que la UI les parara, y
 * cada respuesta se tiró con un 403 que no explicaba nada. Encima la pregunta se veía corregida
 * con su explicación, así que parecía guardada. Reproducido con navegador real en
 * `scratchpad/t418/sim-goteo-2pestanas.ts`.
 *
 * La regla es deliberadamente aburrida: el conteo que se le enseña al cliente es el MAYOR de
 * los dos, así que el muro salta con el límite que primero ate y al usuario le sale el modal de
 * Premium de siempre, igual que a cualquier free que agota su cupo (decisión de Manuel: sin
 * mensaje especial ni aviso propio). Y como salta ANTES de contestar, deja de perderse trabajo.
 */
import { conteoEfectivoConDispositivo } from '@/lib/api/dailyLimit'

describe('conteoEfectivoConDispositivo — qué conteo ve el cliente', () => {
  it('sin dato de dispositivo, deja el de la cuenta intacto (fail-open)', () => {
    // `checkDeviceDailyUsage` devuelve null cuando no hay anclas o la consulta falla. Un fallo
    // de infraestructura NO puede levantar un muro que no toca.
    expect(conteoEfectivoConDispositivo(10, false, null)).toBe(10)
    expect(conteoEfectivoConDispositivo(10, false, undefined)).toBe(10)
  })

  it('si el dispositivo lleva MÁS que la cuenta, manda el del dispositivo', () => {
    // Caso real: cuenta recién creada (0) en un aparato que ya gastó 25 con otra cuenta.
    expect(conteoEfectivoConDispositivo(0, false, 25)).toBe(25)
    expect(conteoEfectivoConDispositivo(3, false, 41)).toBe(41)
  })

  it('si la cuenta lleva más que el dispositivo, manda la cuenta', () => {
    // Puede pasar con límite graduado, o si el aparato cambió de ancla.
    expect(conteoEfectivoConDispositivo(20, false, 5)).toBe(20)
  })

  it('PREMIUM nunca se limita, aunque el aparato esté saturado', () => {
    // Invariante del incidente 07/07/2026: premium NUNCA se bloquea, sea cual sea el conteo.
    expect(conteoEfectivoConDispositivo(0, true, 900)).toBe(0)
    expect(conteoEfectivoConDispositivo(12, true, 900)).toBe(12)
  })

  it('un conteo de cuenta inválido no se propaga como número raro', () => {
    expect(conteoEfectivoConDispositivo(NaN as number, false, 7)).toBe(7)
    expect(conteoEfectivoConDispositivo(-3, false, null)).toBe(0)
  })

  it('el usuario justo en el tope por dispositivo alcanza el límite del cliente', () => {
    // El cliente calcula `isLimitReached = questionsToday >= dailyLimit`. Con 25 devueltos y
    // un límite de 25, el muro sale — que es exactamente lo que no pasaba.
    const LIMITE = 25
    const visto = conteoEfectivoConDispositivo(2, false, 25)
    expect(visto >= LIMITE).toBe(true)
  })
})
