/**
 * @jest-environment node
 *
 * Cuándo sale el aviso de «una cuenta por persona y dispositivo» ([T-418], 01/08/2026).
 *
 * El caso que más importa aquí NO es el positivo, es el negativo: **a un premium no se le
 * enseña nunca**. Manuel lo señaló expresamente (*«ojo, no bloquear a ningún premium, muchas
 * veces tienen cuentas free y premium»*), y hay dos filtros por eso: el endpoint solo cuenta
 * cuentas FREE del aparato, y esta regla descarta al premium aunque el flag llegara puesto.
 * Dos puertas para el mismo invariante, a propósito: es un cliente que paga.
 */
import { claveAceptacion, debeMostrarAviso, diaLocal } from '@/lib/multicuenta/aviso'

const base = {
  multiCuenta: true,
  esPremium: false,
  userId: 'u-1',
  yaAceptadoHoy: false,
  cargando: false,
}

describe('debeMostrarAviso', () => {
  it('sale cuando hay varias cuentas free en el aparato y aún no lo ha aceptado hoy', () => {
    expect(debeMostrarAviso(base)).toBe(true)
  })

  it('NUNCA sale a un premium, aunque el flag venga puesto', () => {
    expect(debeMostrarAviso({ ...base, esPremium: true })).toBe(false)
  })

  it('no sale si el aparato no tiene varias cuentas', () => {
    expect(debeMostrarAviso({ ...base, multiCuenta: false })).toBe(false)
  })

  it('no vuelve a salir el mismo día una vez aceptado', () => {
    expect(debeMostrarAviso({ ...base, yaAceptadoHoy: true })).toBe(false)
  })

  it('no sale mientras el estado del cupo se está cargando', () => {
    // Si no, parpadea en cada carga de página antes de saber siquiera si es premium.
    expect(debeMostrarAviso({ ...base, cargando: true })).toBe(false)
  })

  it('no sale sin usuario resuelto (sesión a medio cargar)', () => {
    expect(debeMostrarAviso({ ...base, userId: null })).toBe(false)
    expect(debeMostrarAviso({ ...base, userId: undefined })).toBe(false)
  })
})

describe('clave de aceptación', () => {
  it('cambia con el DÍA, para que vuelva a salir mañana si sigue la situación', () => {
    expect(claveAceptacion('u-1', '2026-08-01')).not.toBe(claveAceptacion('u-1', '2026-08-02'))
  })

  it('cambia con el USUARIO: el mismo equipo tiene varias cuentas', () => {
    // Sin esto, aceptar con una cuenta callaría el aviso para las demás del aparato, que es
    // justo a quienes hay que avisar.
    expect(claveAceptacion('u-1', '2026-08-01')).not.toBe(claveAceptacion('u-2', '2026-08-01'))
  })

  it('diaLocal da YYYY-MM-DD con ceros a la izquierda', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(diaLocal(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})
