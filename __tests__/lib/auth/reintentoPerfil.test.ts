/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que decide si hay que volver a resolver el perfil de una sesión.
// Importa la función REAL que corre el callback `jwt` de Auth.js, no una copia. (T-434)

import {
  decidirReintentoPerfil,
  VENTANA_REINTENTO_S,
  CAMPO_REINTENTO,
} from '@/lib/auth/reintentoPerfil'

const AHORA = 1_800_000_000
const ID = '11111111-2222-3333-4444-555555555555'

describe('decidirReintentoPerfil — el caso normal no cuesta nada', () => {
  it('con perfil resuelto NO se toca la base de datos', () => {
    expect(decidirReintentoPerfil({ appUserId: ID, email: 'a@b.com' }, AHORA)).toEqual({
      accion: 'ya_resuelto',
    })
  })

  it('se mira `appUserId` ANTES que nada: ni una marca de reintento vieja lo cambia', () => {
    const d = decidirReintentoPerfil(
      { appUserId: ID, email: 'a@b.com', [CAMPO_REINTENTO]: 1 },
      AHORA,
    )
    expect(d.accion).toBe('ya_resuelto')
  })
})

describe('decidirReintentoPerfil — cuándo SÍ hay que reintentar', () => {
  it('falta el perfil y hay email → se reintenta (el caso de los 235 rotos)', () => {
    expect(decidirReintentoPerfil({ email: 'Ana@Gmail.com' }, AHORA)).toEqual({
      accion: 'reintentar',
      email: 'ana@gmail.com',
    })
  })

  it('el email se normaliza igual que en el resolutor (minúsculas y sin espacios)', () => {
    const d = decidirReintentoPerfil({ email: '  ANA@GMAIL.COM  ' }, AHORA)
    expect(d).toEqual({ accion: 'reintentar', email: 'ana@gmail.com' })
  })

  it('con la marca ya vencida se vuelve a intentar', () => {
    const d = decidirReintentoPerfil(
      { email: 'a@b.com', [CAMPO_REINTENTO]: AHORA - VENTANA_REINTENTO_S },
      AHORA,
    )
    expect(d.accion).toBe('reintentar')
  })
})

// Sin esta guarda, un usuario irresoluble consultaría la BD en CADA carga de página.
describe('decidirReintentoPerfil — la ventana que evita martillear la base de datos', () => {
  it('recién intentado → espera, y dice cuánto falta', () => {
    const d = decidirReintentoPerfil({ email: 'a@b.com', [CAMPO_REINTENTO]: AHORA - 10 }, AHORA)
    expect(d).toEqual({ accion: 'en_espera', faltanS: VENTANA_REINTENTO_S - 10 })
  })

  it('justo en el límite de la ventana ya se reintenta (frontera cerrada por arriba)', () => {
    expect(
      decidirReintentoPerfil({ email: 'a@b.com', [CAMPO_REINTENTO]: AHORA - VENTANA_REINTENTO_S }, AHORA)
        .accion,
    ).toBe('reintentar')
    expect(
      decidirReintentoPerfil(
        { email: 'a@b.com', [CAMPO_REINTENTO]: AHORA - VENTANA_REINTENTO_S + 1 },
        AHORA,
      ).accion,
    ).toBe('en_espera')
  })

  it('la ventana se puede ajustar sin tocar el núcleo', () => {
    expect(
      decidirReintentoPerfil({ email: 'a@b.com', [CAMPO_REINTENTO]: AHORA - 30 }, AHORA, 20).accion,
    ).toBe('reintentar')
  })
})

// La regresión que más importa: un guardarraíl que se puede desactivar con un valor raro no es
// un guardarraíl. Una marca en el FUTURO silenciaría el reintento de por vida.
describe('decidirReintentoPerfil — un token con basura no puede silenciar el reintento', () => {
  it('marca en el FUTURO (reloj torcido o token manipulado) → se reintenta igual', () => {
    const d = decidirReintentoPerfil({ email: 'a@b.com', [CAMPO_REINTENTO]: AHORA + 999_999 }, AHORA)
    expect(d.accion).toBe('reintentar')
  })

  it('marca que no es un número → se ignora', () => {
    for (const basura of ['ayer', null, {}, [], true, NaN, Infinity]) {
      expect(
        decidirReintentoPerfil({ email: 'a@b.com', [CAMPO_REINTENTO]: basura }, AHORA).accion,
      ).toBe('reintentar')
    }
  })

  it('`appUserId` que no es una cadena con contenido NO cuenta como resuelto', () => {
    for (const basura of ['', '   ', null, 0, false, {}, []]) {
      expect(
        decidirReintentoPerfil({ appUserId: basura, email: 'a@b.com' }, AHORA).accion,
      ).not.toBe('ya_resuelto')
    }
  })
})

// Sin email el reintento NO puede curar a nadie: es un caso distinto y hay que poder verlo.
describe('decidirReintentoPerfil — sin email es otra cosa, no un fallo de la resolución', () => {
  it('sin email → `sin_email`', () => {
    expect(decidirReintentoPerfil({}, AHORA)).toEqual({ accion: 'sin_email' })
  })

  it('email vacío o en blanco cuenta como sin email', () => {
    for (const v of ['', '   ', null, undefined, 42, {}]) {
      expect(decidirReintentoPerfil({ email: v }, AHORA).accion).toBe('sin_email')
    }
  })

  it('«sin email» gana a la ventana: no se queda esperando algo que nunca podrá pasar', () => {
    expect(decidirReintentoPerfil({ [CAMPO_REINTENTO]: AHORA - 1 }, AHORA).accion).toBe('sin_email')
  })

  it('token nulo o indefinido no explota', () => {
    expect(decidirReintentoPerfil(null, AHORA).accion).toBe('sin_email')
    expect(decidirReintentoPerfil(undefined, AHORA).accion).toBe('sin_email')
  })
})
