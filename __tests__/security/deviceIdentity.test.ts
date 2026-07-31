// [T-371] Qué ancla identifica a un usuario ante el antifraude, y —lo que más importa— cuándo
// esa ancla puede además CORTARLE el servicio. Son dos decisiones distintas y el bug nacía de
// tratarlas como una sola.

import {
  resolverAnclaDispositivo,
  esAnclaDerivada,
  PREFIJO_ANCLA_HUELLA,
} from '@/lib/security/deviceIdentity'

describe('resolverAnclaDispositivo', () => {
  it('prefiere el identificador del navegador cuando existe (es con el que está calibrado el límite)', () => {
    const a = resolverAnclaDispositivo('dev-123', 'fp2_abc')
    expect(a).toEqual({ deviceId: 'dev-123', origen: 'navegador', aplicaLimite: true })
  })

  it('SIN identificador de navegador, se apoya en la huella en vez de rendirse', () => {
    // Este es el caso de T-371: antes se devolvía fail-open y no se registraba nada, así que
    // el usuario quedaba invisible para el sweep de multicuenta y para los referidos.
    const a = resolverAnclaDispositivo(null, 'fp2_abc')
    expect(a.deviceId).toBe('hw:fp2_abc')
    expect(a.origen).toBe('huella')
  })

  it('el ancla derivada NO habilita el límite: registrar no puede costar un bloqueo', () => {
    // Agrupa cuentas que antes no se agrupaban. Estrenar esa agrupación cortando es lo que
    // T-304 prohíbe: la huella v1 llegó a juntar 83 cuentas bajo un mismo valor.
    expect(resolverAnclaDispositivo(null, 'fp2_abc').aplicaLimite).toBe(false)
    expect(resolverAnclaDispositivo('dev-123', 'fp2_abc').aplicaLimite).toBe(true)
  })

  it('sin ninguna de las dos señales no se inventa un ancla', () => {
    expect(resolverAnclaDispositivo(null, null).deviceId).toBeNull()
    expect(resolverAnclaDispositivo(undefined, undefined).origen).toBe('ninguno')
  })

  it('una cadena vacía o de espacios no es un identificador', () => {
    // Llega por cabecera HTTP: `X-Device-Id:` vacío se lee como '' y colaría como ancla válida,
    // creando UNA fila compartida por todos los que manden la cabecera vacía.
    expect(resolverAnclaDispositivo('', 'fp2_abc').origen).toBe('huella')
    expect(resolverAnclaDispositivo('   ', null).deviceId).toBeNull()
    expect(resolverAnclaDispositivo('', '  ').deviceId).toBeNull()
  })

  it('no vuelve a prefijar una huella ya derivada', () => {
    // `hw:hw:fp2_abc` sería un tercer dispositivo fantasma de la misma persona, y encima
    // rompería el recuento del límite.
    expect(resolverAnclaDispositivo(null, 'hw:fp2_abc').deviceId).toBe('hw:fp2_abc')
  })

  it('recorta espacios alrededor del identificador', () => {
    expect(resolverAnclaDispositivo(' dev-123 ', null).deviceId).toBe('dev-123')
  })
})

describe('esAnclaDerivada', () => {
  it('distingue las filas registradas por huella de las normales', () => {
    expect(esAnclaDerivada(`${PREFIJO_ANCLA_HUELLA}fp2_abc`)).toBe(true)
    expect(esAnclaDerivada('dev-123')).toBe(false)
    expect(esAnclaDerivada(null)).toBe(false)
  })
})
