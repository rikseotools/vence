import { repartirArgumentos } from '@/scripts/aplicar-explicacion'

// El reparto de argumentos de `aplicar-explicacion.ts` ya se rompió una vez al añadir el modo
// lote: sin `--lote`, `indexOf` devuelve -1 y `iLote + 1` vale 0 — la posición del question_id —,
// así que el modo suelto se quedó sin su primer posicional y el script solo imprimía el uso.
// No se ve leyendo el `filter`; se ve ejecutándolo.
describe('aplicar-explicacion — reparto de argumentos', () => {
  it('modo suelto: conserva question_id y fichero', () => {
    const r = repartirArgumentos(['abc-123', 'expl.json'])
    expect(r.qid).toBe('abc-123')
    expect(r.fichero).toBe('expl.json')
    expect(r.lote).toBeNull()
    expect(r.apply).toBe(false)
  })

  it('modo suelto con --apply: la bandera no se cuela como posicional', () => {
    const r = repartirArgumentos(['abc-123', 'expl.json', '--apply'])
    expect(r).toMatchObject({ qid: 'abc-123', fichero: 'expl.json', apply: true, lote: null })
  })

  it('modo lote: el directorio NO se toma por question_id', () => {
    const r = repartirArgumentos(['--lote', '/tmp/l01', '--apply'])
    expect(r.lote).toBe('/tmp/l01')
    expect(r.qid).toBeUndefined()
    expect(r.apply).toBe(true)
  })

  it('modo lote con la bandera delante: sigue distinguiendo directorio de posicionales', () => {
    const r = repartirArgumentos(['--apply', '--lote', '/tmp/l02'])
    expect(r).toMatchObject({ lote: '/tmp/l02', apply: true })
    expect(r.qid).toBeUndefined()
  })

  it('--lote sin valor no revienta: devuelve null y el uso se imprime', () => {
    expect(repartirArgumentos(['--lote']).lote).toBeNull()
  })
})
