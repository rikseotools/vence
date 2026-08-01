/**
 * T-448 — lo que ve la persona en el perfil cuando su suscripción se apaga.
 *
 * La regla que de verdad protege este test es la NEGATIVA: sin oferta creada no se promete
 * cifra. Prometer «20 € al mes» a quien luego aterriza en «No tienes ningún precio de fidelidad
 * activo» es peor que no haber enseñado ningún importe, y esa condición vivía dentro de un
 * ternario anidado en el JSX, donde no se podía probar.
 */
import { textoBotonSuscripcion, textoAvisoCancelacion } from '../../lib/api/premium/textoPrecioFidelidad'

const precio = { importe: '35 €', periodicidad: 'cada 3 meses' }

describe('textoBotonSuscripcion', () => {
  it('con su cuenta vigente, el botón es el de siempre (no se le ofrece nada raro)', () => {
    expect(textoBotonSuscripcion(true, null)).toBe('Reactivar suscripción')
    expect(textoBotonSuscripcion(true, precio)).toBe('Reactivar suscripción')
  })

  it('sin campo (servidor viejo) se comporta como antes: reactivar', () => {
    expect(textoBotonSuscripcion(undefined, precio)).toBe('Reactivar suscripción')
  })

  it('cuenta antigua CON precio conocido: la cifra va en el botón, que es donde decide', () => {
    expect(textoBotonSuscripcion(false, precio)).toBe('Mantener mi precio: 35 € cada 3 meses')
  })

  it('cuenta antigua SIN precio: invita, pero NO promete cifra', () => {
    for (const p of [null, undefined, { importe: '', periodicidad: 'al mes' }]) {
      const t = textoBotonSuscripcion(false, p)
      expect(t).toBe('Mantener mi precio de fidelidad')
      expect(t).not.toMatch(/\d/)
    }
  })
})

describe('textoAvisoCancelacion', () => {
  it('cuenta vigente: se le recuerda que puede reactivar', () => {
    expect(textoAvisoCancelacion(true, precio)).toMatch(/puedes reactivarla/)
  })

  it('cuenta antigua con precio: dice la cifra', () => {
    expect(textoAvisoCancelacion(false, precio)).toMatch(/35 € cada 3 meses/)
  })

  it('cuenta antigua sin precio: ni una cifra inventada', () => {
    expect(textoAvisoCancelacion(false, null)).not.toMatch(/\d/)
  })

  it('siempre deja claro que conserva el acceso hasta la fecha (nadie se queda sin saberlo)', () => {
    for (const args of [[true, null], [false, null], [false, precio]] as const) {
      expect(textoAvisoCancelacion(args[0], args[1])).toMatch(/acceso Premium hasta esa fecha/)
    }
  })
})
