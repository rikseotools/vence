// Detector: plazas publicadas con una suma que puede ser falsa (29/07/2026, caso Concha).
//
// Vigila el hueco de DATOS que queda tras arreglar el código: cuando no consta si la
// reserva de discapacidad va dentro del turno libre o aparte, la vista SSOT supone que va
// aparte y suma. Si iba dentro, se publican plazas que no existen.
const { detectarReservaSinDeclarar, severidadPorDesvio } = require('@/lib/convocatoria/reservaSinDeclarar.cjs')

const fila = (o = {}) => ({ slug: 'x', plazas_libres: 100, plazas_discapacidad: 10, incluidas: null, ...o })

describe('detectarReservaSinDeclarar', () => {
  it('marca la convocatoria que no declara la relación', () => {
    const r = detectarReservaSinDeclarar([fila({ slug: 'tcae-sescam', plazas_libres: 220, plazas_discapacidad: 60 })])
    expect(r).toHaveLength(1)
    expect(r[0].slug).toBe('tcae-sescam')
    // El mensaje tiene que decir las DOS cifras: la que publicamos y la que sería.
    expect(r[0].mensaje).toContain('280')
    expect(r[0].mensaje).toContain('220')
  })

  it('NO marca las que sí lo declaran, en cualquiera de los dos sentidos', () => {
    expect(detectarReservaSinDeclarar([fila({ incluidas: true })])).toHaveLength(0)
    expect(detectarReservaSinDeclarar([fila({ incluidas: false })])).toHaveLength(0)
  })

  it('NO marca las que no tienen reserva (sin reserva no hay suma posible)', () => {
    expect(detectarReservaSinDeclarar([fila({ plazas_discapacidad: 0 })])).toHaveLength(0)
    expect(detectarReservaSinDeclarar([fila({ plazas_discapacidad: null })])).toHaveLength(0)
  })

  it('la gravedad sube cuando la reserva pesa lo suficiente para desviar el número', () => {
    expect(severidadPorDesvio(220, 60)).toBe('error')   // 27% del turno libre
    expect(severidadPorDesvio(1000, 25)).toBe('error')  // pocas en % pero 25 plazas fantasma
    expect(severidadPorDesvio(100, 2)).toBe('warn')     // desviación pequeña
  })

  it('ordena por plazas en duda: primero lo que más engaña', () => {
    const r = detectarReservaSinDeclarar([
      fila({ slug: 'poca', plazas_discapacidad: 2 }),
      fila({ slug: 'mucha', plazas_discapacidad: 60, plazas_libres: 220 }),
    ])
    expect(r.map((x) => x.slug)).toEqual(['mucha', 'poca'])
  })

  it('aguanta entradas vacías o basura sin reventar el sweep', () => {
    expect(detectarReservaSinDeclarar([])).toEqual([])
    expect(detectarReservaSinDeclarar(null)).toEqual([])
    expect(detectarReservaSinDeclarar([fila({ plazas_libres: null, plazas_discapacidad: 5 })])).toHaveLength(1)
  })
})
