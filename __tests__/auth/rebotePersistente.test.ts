/**
 * «Cree que está dentro, y no lo está» (T-434).
 *
 * Lo que decide este núcleo es a quién se llama ROTO. Pasarse marca como avería la caducidad de
 * sesión de medio mundo —y un canario que grita por lo normal se apaga—; quedarse corto deja a
 * gente usando la aplicación sin que se le guarde nada, que es el fallo que motivó la tarea.
 */
const {
  clasificarRebotes,
  bandaRebotes,
  MIN_DIAS_PERSISTENTE,
} = require('@/lib/auth/rebotePersistente.cjs')

const fila = (userId: string, dias: number, eventos = 1) => ({ userId, dias, eventos })

describe('clasificarRebotes — roto vs simplemente caducado', () => {
  it('rebotar UN solo día es una caducidad normal, no un roto', () => {
    const r = clasificarRebotes([fila('a', 1, 4)])
    expect(r.resumen.rotos).toBe(0)
    expect(r.resumen.caducados).toBe(1)
  })

  // El corte sale de datos, no de intuición: 391 de 483 usuarios rebotaban un solo día.
  it('dos días sigue siendo zona gris: no se reporta como roto', () => {
    expect(clasificarRebotes([fila('a', 2, 30)]).resumen.rotos).toBe(0)
  })

  it('tres días distintos ya es un roto, aunque haya rebotado poco', () => {
    const r = clasificarRebotes([fila('a', 3, 3)])
    expect(r.resumen.rotos).toBe(1)
    expect(r.persistentes[0].userId).toBe('a')
  })

  // El volumen NO decide: al medirlo, un caducado de un día acumulaba tantos rebotes como un
  // roto. Si el volumen mandara, el detector marcaría caducidades y perdería a los rotos.
  it('muchos rebotes en un día NO es un roto; pocos en muchos días SÍ', () => {
    const r = clasificarRebotes([fila('ruidoso', 1, 500), fila('roto', 4, 6)])
    expect(r.persistentes.map((f: { userId: string }) => f.userId)).toEqual(['roto'])
  })

  it('ordena por días roto: primero quien lleva más tiempo sin que se le guarde nada', () => {
    const r = clasificarRebotes([fila('c', 3), fila('a', 11), fila('b', 7)])
    expect(r.persistentes.map((f: { userId: string }) => f.userId)).toEqual(['a', 'b', 'c'])
  })

  it('a igualdad de días, desempata el que más rebota', () => {
    const r = clasificarRebotes([fila('pocos', 5, 2), fila('muchos', 5, 90)])
    expect(r.persistentes[0].userId).toBe('muchos')
  })

  it('el umbral se puede endurecer sin tocar el núcleo', () => {
    expect(clasificarRebotes([fila('a', 4)], { minDias: 7 }).resumen.rotos).toBe(0)
    expect(clasificarRebotes([fila('a', 8)], { minDias: 7 }).resumen.rotos).toBe(1)
  })

  it('el umbral por defecto es el calibrado, no uno cualquiera', () => {
    expect(MIN_DIAS_PERSISTENTE).toBe(3)
  })

  // Un canario que revienta con una fila rara deja de medir, y dejar de medir se lee como verde.
  it('filas basura no tumban la medición', () => {
    const r = clasificarRebotes([null, undefined, {}, { userId: '' }, fila('ok', 5)] as never)
    expect(r.resumen.total).toBe(1)
    expect(r.resumen.rotos).toBe(1)
  })

  it('sin datos no inventa nada', () => {
    expect(clasificarRebotes([]).resumen).toMatchObject({ rotos: 0, caducados: 0, total: 0 })
    expect(clasificarRebotes(null as never).resumen.total).toBe(0)
  })
})

describe('bandaRebotes — no hay un número aceptable de esto', () => {
  it('cero es verde', () => {
    expect(bandaRebotes({ rotos: 0 })).toEqual({ banda: 'ok', codigo: 0 })
  })

  // A propósito sin umbral de tolerancia: cada unidad es una persona a la que no se le guarda
  // nada y que lleva días así.
  it('UNO ya es error, no se tolera un margen', () => {
    expect(bandaRebotes({ rotos: 1 }).banda).toBe('error')
    expect(bandaRebotes({ rotos: 46 }).banda).toBe('error')
  })

  it('un resumen ausente no se lee como verde por accidente', () => {
    expect(bandaRebotes(undefined).codigo).toBe(0)
  })
})
