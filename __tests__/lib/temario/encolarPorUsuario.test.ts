/**
 * @jest-environment node
 */
// Un tema que no cabe SE ENCOLA para que el worker lo prepare (T-273/T-159).
//
// ## Qué se juega
//
// Hasta el 30/07 ese camino devolvía el error y ahí moría. Era **la única señal de que un premium
// REAL quería ESE tema concreto** —la cola solo se alimentaba del hook de scope, ciego y masivo, y
// de barridos a mano— y se tiraba. Medido: 5 rechazos en 30 días que nadie convirtió en trabajo.
//
// Lo que estos tests clavan es el contrato de la cola en el que se apoya el arreglo, y sobre todo
// que **encolar no puede perjudicar al usuario**: ni hacerle esperar ni romperle la respuesta.

import { enqueuePdfJob } from '@/lib/temario/pdf/pdfJobQueue'

/** BD de mentira: registra lo que se le manda y puede fingir avería. */
function dbFalsa(opts: { filasDevueltas?: number; revienta?: boolean } = {}) {
  const llamadas: unknown[] = []
  return {
    llamadas,
    execute: async (q: unknown) => {
      llamadas.push(q)
      if (opts.revienta) throw new Error('cola caída')
      return Array.from({ length: opts.filasDevueltas ?? 1 }, (_, i) => ({ id: `job-${i}` }))
    },
  }
}

describe('encolar un tema que no cabe', () => {
  it('encola y dice que el trabajo es NUEVO', async () => {
    const db = dbFalsa({ filasDevueltas: 1 })
    await expect(enqueuePdfJob(db, { oposicion: 'x-op', tema: 109, contentHash: 'abc123' })).resolves.toBe(true)
    expect(db.llamadas).toHaveLength(1)
  })

  it('🎯 N usuarios pidiendo el MISMO tema generan UN trabajo, no N', async () => {
    // La tabla deduplica con ON CONFLICT DO NOTHING → 0 filas devueltas = ya estaba encolado.
    // Sin esto, un tema popular llenaría la cola de trabajos idénticos y el worker los repetiría.
    const db = dbFalsa({ filasDevueltas: 0 })
    await expect(enqueuePdfJob(db, { oposicion: 'x-op', tema: 109, contentHash: 'abc123' })).resolves.toBe(false)
  })

  it('el hash forma parte del trabajo: si cambia el temario, es un trabajo NUEVO', async () => {
    // Es lo que hace que el sistema se cure solo cuando cambia el `topic_scope`: hash distinto →
    // no colisiona con el anterior → se regenera.
    const db = dbFalsa({ filasDevueltas: 1 })
    await enqueuePdfJob(db, { oposicion: 'x-op', tema: 109, contentHash: 'hash-viejo' })
    await enqueuePdfJob(db, { oposicion: 'x-op', tema: 109, contentHash: 'hash-nuevo' })
    const enviado = JSON.stringify(db.llamadas)
    expect(enviado).toContain('hash-viejo')
    expect(enviado).toContain('hash-nuevo')
  })

  it('🎯 si la cola está caída, el fallo NO puede escaparse al usuario', async () => {
    // La ruta lo llama sin await y envuelto: el opositor debe recibir exactamente lo que recibía
    // antes de que esto existiera. Aquí se comprueba que el error es capturable, no silencioso a
    // medias (una promesa rechazada sin dueño tumbaría el proceso en Node).
    const db = dbFalsa({ revienta: true })
    await expect(enqueuePdfJob(db, { oposicion: 'x-op', tema: 109, contentHash: 'abc' })).rejects.toThrow('cola caída')
  })
})
