const { leerCuota, utilizacionQueManda, UMBRAL_PROVEEDOR } = require('@/lib/observability/cuotaProveedor.cjs')

/**
 * [T-709] — las cabeceras son REALES, copiadas de una respuesta de producción del 08/08/2026.
 * Escribirlas a mano sería probar el lector contra lo que yo creo que devuelve el proveedor,
 * que es justo el error que este módulo existe para corregir: la versión anterior de este
 * trabajo AFIRMÓ que estas cabeceras no existían y construyó una estimación encima.
 */
const CABECERAS_REALES = {
  'anthropic-ratelimit-unified-status': 'allowed_warning',
  'anthropic-ratelimit-unified-5h-status': 'allowed',
  'anthropic-ratelimit-unified-5h-reset': '1786202400',
  'anthropic-ratelimit-unified-5h-utilization': '0.5',
  'anthropic-ratelimit-unified-7d-status': 'allowed_warning',
  'anthropic-ratelimit-unified-7d-reset': '1786500000',
  'anthropic-ratelimit-unified-7d-utilization': '0.84',
  'anthropic-ratelimit-unified-7d-surpassed-threshold': '0.75',
}

/** La otra cuenta el mismo día: sin tocar. */
const CABECERAS_LIBRE = {
  'anthropic-ratelimit-unified-status': 'allowed',
  'anthropic-ratelimit-unified-5h-utilization': '0.0',
  'anthropic-ratelimit-unified-7d-utilization': '0.0',
  'anthropic-ratelimit-unified-7d-reset': '1786748400',
}

describe('leerCuota — el dato del proveedor, tal como llega', () => {
  it('lee la cuenta cargada del 08/08: 84% semanal, aviso ya disparado', () => {
    const c = leerCuota(CABECERAS_REALES)
    expect(c).toMatchObject({
      utilizacion5h: 0.5,
      utilizacion7d: 0.84,
      umbral: 0.75,
      estado: 'allowed_warning',
      reset7d: 1786500000,
    })
  })

  it('y la cuenta libre del mismo día: cero', () => {
    const c = leerCuota(CABECERAS_LIBRE)
    expect(c!.utilizacion7d).toBe(0)
    expect(c!.estado).toBe('allowed')
  })

  it('el 0.0 NO se confunde con «no vino» — es la diferencia entre libre y desconocido', () => {
    // Con un `||` en vez de un `??` esto devolvería null y una cuenta intacta se leería como
    // «no se sabe», que es justo lo contrario de lo que dice.
    const c = leerCuota({ 'anthropic-ratelimit-unified-7d-utilization': '0.0' })
    expect(c).not.toBeNull()
    expect(c!.utilizacion7d).toBe(0)
  })

  it('sin cabeceras de cuota devuelve null: no se inventa una lectura', () => {
    expect(leerCuota({})).toBeNull()
    expect(leerCuota({ 'content-type': 'application/json' })).toBeNull()
  })

  it('si el proveedor deja de mandar su umbral, se usa el suyo conocido, no uno nuestro', () => {
    // Se sigue SU criterio: el día que lo cambien queremos su número, no el nuestro de hace
    // meses congelado en una constante.
    const c = leerCuota({ 'anthropic-ratelimit-unified-7d-utilization': '0.9' })
    expect(c!.umbral).toBe(UMBRAL_PROVEEDOR)
    expect(UMBRAL_PROVEEDOR).toBe(0.75)
  })

  it('un valor que no es número no rompe ni se cuela', () => {
    const c = leerCuota({
      'anthropic-ratelimit-unified-7d-utilization': 'raro',
      'anthropic-ratelimit-unified-5h-utilization': '0.2',
    })
    expect(c!.utilizacion7d).toBeNull()
    expect(c!.utilizacion5h).toBe(0.2)
  })
})

describe('utilizacionQueManda — la peor de las dos ventanas', () => {
  it('manda la semanal cuando es la más alta (el caso real: 0.84 vs 0.5)', () => {
    expect(utilizacionQueManda(leerCuota(CABECERAS_REALES))).toBe(0.84)
  })

  it('pero manda la de 5 h si es ella la que va a cortar', () => {
    // Agotar la ventana corta también te deja parado, y quien está a media tarea no distingue
    // una cosa de la otra.
    const c = leerCuota({
      'anthropic-ratelimit-unified-5h-utilization': '0.97',
      'anthropic-ratelimit-unified-7d-utilization': '0.3',
    })
    expect(utilizacionQueManda(c)).toBe(0.97)
  })

  it('sin lectura, null — y el llamante tiene que tratarlo como «no lo sé»', () => {
    expect(utilizacionQueManda(null)).toBeNull()
    expect(utilizacionQueManda(leerCuota({}))).toBeNull()
  })
})
