/**
 * [T-648] El canario de la cola de PDFs disparaba con CUALQUIER job en `failed`, y llevaba días en
 * crítico cada 15 minutos. Dentro no había una avería: había **dos cosas distintas en el mismo
 * cajón** — 112 `oposicion_desconocida` del defecto ya arreglado (cero desde el arreglo) y 50
 * `tema_no_encontrado`, que es el fallo legítimo de una personalizada sin temas montados y que
 * **ningún reintento puede arreglar**.
 *
 * Un canario que grita algo que nadie puede resolver se aprende a ignorar, y entonces deja de
 * avisar del día en que la cola SÍ se rompa.
 */
const {
  clasificarFallo, triarDlq, IRRECUPERABLES, SQL_IRRECUPERABLE,
} = require('@/lib/temario/pdf/dlqTriage.cjs')

describe('[T-648] clasificarFallo — ¿lo arreglaría un reintento?', () => {
  it('«tema no encontrado» NO se arregla reintentando: no hay nada que renderizar', () => {
    const r = clasificarFallo('tema_no_encontrado: personalizada_f228bd11 tema 3')
    expect(r.reintentable).toBe(false)
    expect(r.motivo).toMatch(/personalizada/)
  })

  it('casa aunque el motivo lleve contexto detrás, que es como lo escribe el worker', () => {
    // Comparar por igualdad no casaría ninguno de los 50 reales: todos llevan la oposición detrás.
    expect(clasificarFallo('tema_no_encontrado').reintentable).toBe(false)
    expect(clasificarFallo('  tema_no_encontrado: x  ').reintentable).toBe(false)
  })

  it('el defecto que YA se arregló sigue contando como reintentable', () => {
    // `oposicion_desconocida` ya no ocurre, pero si volviera hay que enterarse: reintentar ahora
    // funcionaría, así que es una avería de verdad y debe paginar.
    expect(clasificarFallo('oposicion_desconocida: personalizada_abc').reintentable).toBe(true)
  })

  it('un motivo NUEVO cuenta como reintentable — el silencio se declara, no se hereda', () => {
    // Misma regla que las señales benignas: para callar un aviso hay que decir por qué. Si un
    // motivo desconocido callara por defecto, la cola se llenaría de fallos invisibles.
    expect(clasificarFallo('timeout_renderizando').reintentable).toBe(true)
    expect(clasificarFallo('s3_upload_failed').reintentable).toBe(true)
    expect(clasificarFallo(null).reintentable).toBe(true)
    expect(clasificarFallo('').reintentable).toBe(true)
  })
})

describe('[T-648] triarDlq — los dos números, nunca uno restado del otro', () => {
  it('separa sin perder nada: reintentables + irrecuperables = total', () => {
    // Restarlos escondería los irrecuperables, y esos son una señal real (usuarios con una
    // personalizada sin temas). Se publican aparte, no se descuentan.
    const r = triarDlq([
      { last_error: 'tema_no_encontrado: a' },
      { last_error: 'tema_no_encontrado: b' },
      { last_error: 'oposicion_desconocida: c' },
      { last_error: 'timeout' },
    ])
    expect(r).toEqual({ reintentables: 2, irrecuperables: 2, total: 4 })
  })

  it('cola vacía o ausente no revienta', () => {
    expect(triarDlq([])).toEqual({ reintentables: 0, irrecuperables: 0, total: 0 })
    expect(triarDlq(undefined)).toEqual({ reintentables: 0, irrecuperables: 0, total: 0 })
  })
})

describe('[T-648] paridad: el canario del backend usa el MISMO criterio', () => {
  const fs = require('fs')
  const path = require('path')
  const canario = fs.readFileSync(
    path.join(process.cwd(), 'backend/src/canary-pdf-queue/canary-pdf-queue.service.ts'),
    'utf8',
  )

  it('cada motivo irrecuperable del núcleo aparece en el SQL del canario', () => {
    // El backend no puede importar `lib/`, así que lleva su espejo en SQL. Dos criterios sobre el
    // mismo hecho acaban divergiendo en silencio: esto lo impide.
    for (const clave of Object.keys(IRRECUPERABLES)) {
      expect(canario).toContain(clave)
    }
  })

  it('el SQL generado por el núcleo cubre exactamente esos motivos', () => {
    expect(SQL_IRRECUPERABLE).toContain('tema_no_encontrado')
    expect(SQL_IRRECUPERABLE.split(' OR ')).toHaveLength(Object.keys(IRRECUPERABLES).length)
  })

  it('el canario PUBLICA los irrecuperables aunque no dispare por ellos', () => {
    // Lo que no se publica deja de mirarse. Se separan para no despertar a nadie, no para
    // esconderlos.
    expect(canario).toMatch(/dlqIrrecuperable/)
    expect(canario).toMatch(/metadata = \{[^}]*dlqIrrecuperable/)
  })
})
