/**
 * CAPA 1 (unit) — núcleo puro de la purga ISR cross-instancia.
 *
 * Importa la función REAL de producción (nunca una copia): si `diffIsrPurgeLog`
 * cambia o desaparece, estos tests se enteran.
 */
import { diffIsrPurgeLog, type IsrPurgeSnapshot } from '@/lib/cache/isrPurgeLog'

describe('diffIsrPurgeLog — qué purga cada instancia', () => {
  it('BASELINE: la primera lectura tras arrancar no purga nada', () => {
    // Una instancia recién arrancada tiene el ISR frío. Purgar el histórico sería
    // un pico de recomputación en cada deploy/escalado, justo cuando es más frágil.
    const actual: IsrPurgeSnapshot = { '/a': 7, '/b': 2 }
    expect(diffIsrPurgeLog(null, actual)).toEqual([])
  })

  it('purga la ruta cuyo contador SUBIÓ', () => {
    expect(diffIsrPurgeLog({ '/a': 1, '/b': 5 }, { '/a': 2, '/b': 5 })).toEqual(['/a'])
  })

  it('purga una ruta NUEVA que no había visto', () => {
    expect(diffIsrPurgeLog({ '/a': 1 }, { '/a': 1, '/nueva': 1 })).toEqual(['/nueva'])
  })

  it('NO purga si nada cambió (el caso del 99% de los ciclos)', () => {
    expect(diffIsrPurgeLog({ '/a': 3 }, { '/a': 3 })).toEqual([])
  })

  it('recupera varias purgas perdidas mientras el KV estuvo inaccesible', () => {
    // Da igual cuántos incrementos se perdiera: basta con que el contador sea mayor.
    expect(diffIsrPurgeLog({ '/a': 1 }, { '/a': 9 })).toEqual(['/a'])
  })

  it('NO purga si el contador BAJA o la ruta desaparece (TTL o FLUSH del KV)', () => {
    // Un contador que retrocede solo puede venir de infraestructura, no de
    // contenido nuevo. Purgar ahí tiraría el ISR de TODAS las instancias a la vez.
    expect(diffIsrPurgeLog({ '/a': 5 }, { '/a': 1 })).toEqual([])
    expect(diffIsrPurgeLog({ '/a': 5, '/b': 2 }, { '/b': 2 })).toEqual([])
    expect(diffIsrPurgeLog({ '/a': 5 }, {})).toEqual([])
  })

  it('devuelve las rutas ordenadas (salida determinista para logs y tests)', () => {
    const out = diffIsrPurgeLog({}, { '/z': 1, '/a': 1, '/m': 1 })
    expect(out).toEqual(['/a', '/m', '/z'])
  })

  it('un snapshot vacío leído de verdad NO es lo mismo que no poder leer', () => {
    // `{}` (leído, vacío) hace baseline vacío y a partir de ahí purga lo que llegue.
    expect(diffIsrPurgeLog({}, { '/a': 1 })).toEqual(['/a'])
  })
})
