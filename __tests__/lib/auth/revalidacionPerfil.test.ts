/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que decide si hay que revalidar que `appUserId` SIGUE existiendo.
// Importa la función REAL que corre el callback `jwt` de Auth.js, no una copia. (T-352)

import {
  decidirRevalidacionPerfil,
  VENTANA_REVALIDACION_S,
  CAMPO_REVALIDACION,
} from '@/lib/auth/revalidacionPerfil'

const AHORA = 1_800_000_000
const ID = '11111111-2222-3333-4444-555555555555'

describe('decidirRevalidacionPerfil — sin appUserId no hay nada que revalidar', () => {
  it('sin appUserId → `no_aplica` (lo cubre reintentoPerfil)', () => {
    expect(decidirRevalidacionPerfil({ email: 'a@b.com' }, AHORA)).toEqual({ accion: 'no_aplica' })
  })

  it('appUserId vacío o basura → `no_aplica`, igual que en reintentoPerfil', () => {
    for (const basura of ['', '   ', null, 0, false, {}, []]) {
      expect(decidirRevalidacionPerfil({ appUserId: basura, email: 'a@b.com' }, AHORA)).toEqual({
        accion: 'no_aplica',
      })
    }
  })

  it('token nulo o indefinido no explota', () => {
    expect(decidirRevalidacionPerfil(null, AHORA)).toEqual({ accion: 'no_aplica' })
    expect(decidirRevalidacionPerfil(undefined, AHORA)).toEqual({ accion: 'no_aplica' })
  })
})

describe('decidirRevalidacionPerfil — el caso normal, primera vez', () => {
  it('appUserId presente y SIN marca previa → toca revalidar (nunca se ha comprobado)', () => {
    expect(decidirRevalidacionPerfil({ appUserId: ID, email: 'Ana@Gmail.com' }, AHORA)).toEqual({
      accion: 'revalidar',
      appUserId: ID,
      email: 'ana@gmail.com',
    })
  })

  it('sin email en el token, revalidar igual — la reconciliación decidirá si puede o no', () => {
    expect(decidirRevalidacionPerfil({ appUserId: ID }, AHORA)).toEqual({
      accion: 'revalidar',
      appUserId: ID,
      email: null,
    })
  })
})

// Sin esta guarda, CADA carga de página de CADA usuario pagaría una consulta extra — el mismo
// principio que ya protege decidirReintentoPerfil.
describe('decidirRevalidacionPerfil — la ventana que evita martillear la base de datos', () => {
  it('recién revalidado → espera, y dice cuánto falta', () => {
    const d = decidirRevalidacionPerfil(
      { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: AHORA - 10 },
      AHORA,
    )
    expect(d).toEqual({ accion: 'en_espera', faltanS: VENTANA_REVALIDACION_S - 10 })
  })

  it('justo en el límite de la ventana ya se revalida (frontera cerrada por arriba)', () => {
    expect(
      decidirRevalidacionPerfil(
        { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: AHORA - VENTANA_REVALIDACION_S },
        AHORA,
      ).accion,
    ).toBe('revalidar')
    expect(
      decidirRevalidacionPerfil(
        { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: AHORA - VENTANA_REVALIDACION_S + 1 },
        AHORA,
      ).accion,
    ).toBe('en_espera')
  })

  it('la ventana se puede ajustar sin tocar el núcleo', () => {
    expect(
      decidirRevalidacionPerfil(
        { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: AHORA - 30 },
        AHORA,
        20,
      ).accion,
    ).toBe('revalidar')
  })
})

// Misma regresión que reintentoPerfil: un guardarraíl que se puede desactivar con un valor raro
// no es un guardarraíl. Una marca en el FUTURO silenciaría la revalidación de por vida — es
// justo el modo de fallo que dejó a este mismo tipo de usuario roto indefinidamente antes.
describe('decidirRevalidacionPerfil — un token con basura no puede silenciar la revalidación', () => {
  it('marca en el FUTURO (reloj torcido o token manipulado) → se revalida igual', () => {
    const d = decidirRevalidacionPerfil(
      { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: AHORA + 999_999 },
      AHORA,
    )
    expect(d.accion).toBe('revalidar')
  })

  it('marca que no es un número → se ignora, se revalida', () => {
    for (const basura of ['ayer', null, {}, [], true, NaN, Infinity]) {
      expect(
        decidirRevalidacionPerfil(
          { appUserId: ID, email: 'a@b.com', [CAMPO_REVALIDACION]: basura },
          AHORA,
        ).accion,
      ).toBe('revalidar')
    }
  })
})
