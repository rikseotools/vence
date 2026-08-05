/**
 * @jest-environment node
 */
// ¿La flota produce, y a qué coste para Manuel? (T-486)
//
// La ficha del piloto declaró ANTES de empezar cómo se sabría si salía bien, para no juzgarlo por
// la impresión. De sus tres criterios, solo uno tenía comando. Este fichero fija los otros dos —
// y sobre todo el que decide: **si la flota produce el doble pero duplica el tiempo de Manuel, ha
// fallado aunque los contadores suban**. Él es el recurso escaso, no el cómputo.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const P = require('@/lib/sessions/productividad.cjs')

const AHORA = new Date('2026-08-05T15:00:00Z')
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()

describe('de quién es cada cierre', () => {
  it.each(['w1', 'w2-vence-flota-w1-386bf8', 'l3', 'l12-fedora-abc'])('«%s» es un trabajador', (sid) => {
    expect(P.quienEs(sid)).toBe('trabajador')
  })

  // Los worktrees de Manuel se llaman por su tema, no por un número de flota.
  it.each(['t486-flota', 'imp-04ago-c', 'vence', 'movil-163760', null, ''])('«%s» es una persona', (sid) => {
    expect(P.quienEs(sid)).toBe('persona')
  })
})

describe('lo que se cuenta como producción, y lo que NO', () => {
  it('separa lo cerrado por la flota de lo cerrado por personas', () => {
    const m = P.medir({
      cerradas: [
        { claimed_by: 'w1', worked_seconds: 3600 },
        { claimed_by: 'l2', worked_seconds: 1800 },
        { claimed_by: 't486-flota', worked_seconds: 7200 },
      ],
      ahora: AHORA,
    })
    expect(m.porOrigen).toEqual({ trabajador: 2, persona: 1 })
  })

  // Una tarea ENTREGADA no está hecha: está esperando a una persona. Contarla como producción es
  // exactamente cómo un panel empieza a mentir.
  it('una entrega NO cuenta como cerrada', () => {
    const m = P.medir({ cerradas: [], entregadas: [{ review_requested_at: hace(2), review_requested_by: 'w1' }], ahora: AHORA })
    expect(m.porOrigen).toEqual({ trabajador: 0, persona: 0 })
    expect(m.entregas.pendientes).toBe(1)
  })

  // `worked_seconds` solo existe desde T-414: promediar sobre las que lo tienen y callar cuántas
  // son daría una cifra que nadie puede desmentir.
  it('dice cuántas NO tienen tiempo medido en vez de promediar a ciegas', () => {
    const m = P.medir({
      cerradas: [{ claimed_by: 'w1', worked_seconds: 7200 }, { claimed_by: 'w2', worked_seconds: null }],
      ahora: AHORA,
    })
    expect(m.tiempo).toMatchObject({ conMedida: 1, sinMedida: 1, horasTotales: 2, horasPorTarea: 2 })
  })

  it('sin ninguna medida no se inventa un promedio', () => {
    const m = P.medir({ cerradas: [{ claimed_by: 'w1', worked_seconds: 0 }], ahora: AHORA })
    expect(m.tiempo.horasPorTarea).toBeNull()
  })
})

describe('la cola de revisión: la MEDIANA, no la media', () => {
  // Una entrega olvidada de hace tres días desplaza la media y esconde el resto.
  it('una entrega muy vieja no arrastra el dato del resto', () => {
    const m = P.medir({
      entregadas: [1, 2, 2, 3, 72].map((h) => ({ review_requested_at: hace(h), review_requested_by: 'w1' })),
      ahora: AHORA,
    })
    expect(m.entregas.esperaMedianaH).toBe(2)
    expect(m.entregas.esperaMaximaH).toBe(72)
  })

  it('cuenta cuántas vienen de la flota: es el coste que ella genera', () => {
    const m = P.medir({
      entregadas: [
        { review_requested_at: hace(1), review_requested_by: 'w1' },
        { review_requested_at: hace(1), review_requested_by: 't486-flota' },
      ],
      ahora: AHORA,
    })
    expect(m.entregas.deLaFlota).toBe(1)
  })
})

describe('el veredicto mira el tiempo de Manuel, no la producción', () => {
  it('sin cola, verde', () => {
    expect(P.medir({ ahora: AHORA }).veredicto.color).toBe('verde')
  })

  // El criterio de FRACASO declarado en la ficha: producir más a costa del tiempo de Manuel.
  it('si la mitad de las entregas lleva ≥24 h, es ROJO aunque se haya producido mucho', () => {
    const m = P.medir({
      cerradas: Array.from({ length: 30 }, () => ({ claimed_by: 'w1', worked_seconds: 600 })),
      entregadas: [30, 40, 50].map((h) => ({ review_requested_at: hace(h), review_requested_by: 'w1' })),
      ahora: AHORA,
    })
    expect(m.porOrigen.trabajador).toBe(30)          // producción alta…
    expect(m.veredicto.color).toBe('rojo')           // …y aun así rojo
    expect(m.veredicto.razon).toMatch(/revisar/)
  })

  it('muchas entregas recientes son ámbar: se acumulan más rápido de lo que se revisan', () => {
    const m = P.medir({
      entregadas: Array.from({ length: 9 }, () => ({ review_requested_at: hace(1), review_requested_by: 'w1' })),
      ahora: AHORA,
    })
    expect(m.veredicto.color).toBe('ambar')
  })
})

describe('el informe dice el porqué, no solo el número', () => {
  it('cuando no está verde, recuerda cuál era el criterio de fracaso', () => {
    const m = P.medir({
      entregadas: [30, 40, 50].map((h) => ({ review_requested_at: hace(h), review_requested_by: 'w1' })),
      ahora: AHORA,
    })
    const texto = P.formatear(m).join('\n')
    expect(texto).toMatch(/ha fallado aunque produzca m[áa]s/)
    expect(texto).toMatch(/ESPERANDO TU REVISI[ÓO]N/)
  })

  it('y no promete tiempo medido cuando no lo hay', () => {
    const texto = P.formatear(P.medir({ cerradas: [{ claimed_by: 'w1' }], ahora: AHORA })).join('\n')
    expect(texto).toMatch(/ninguna tarea lo trae/)
  })
})

// ── LA MÉTRICA DECLARADA ERA CIEGA, Y SE VIO AL ESTRENARLA ──────────────────────────────────
// La ficha pedía «tareas cerradas y verificadas POR TRABAJADOR». Eso sale 0 **por construcción**:
// un trabajador no cierra, ENTREGA — cerrar exige verificar, y verificar es de una persona. Medido
// el 05/08: 162 cerradas en 7 días, TODAS por personas, con nueve entregas de la flota en cola al
// mismo tiempo. Contar solo cierres haría que una flota que funciona pareciera no producir nada.
describe('la producción de la flota son sus ENTREGAS, no sus cierres', () => {
  it('una entrega de la flota que ya se cerró cuenta como producción suya', () => {
    const m = P.medir({
      cerradas: [
        { claimed_by: 't486-flota', review_requested_by: 'w1' },   // la cerró una persona…
        { claimed_by: 't486-flota', review_requested_by: 'l2' },   // …pero la trabajó la flota
        { claimed_by: 't486-flota', review_requested_by: null },   // ésta es de una persona entera
      ],
      entregadas: [{ review_requested_at: hace(1), review_requested_by: 'w2' }],
      ahora: AHORA,
    })
    expect(m.porOrigen).toEqual({ trabajador: 0, persona: 3 })     // por CIERRE, cero: correcto
    expect(m.produccionFlota).toMatchObject({ entregadasYaCerradas: 2, enCola: 1 })
    expect(m.produccionFlota.tasaAceptacion).toBe(67)
  })

  // Dividir por la nada daría un 0% que se lee como «la flota no sirve» el primer día.
  it('sin nada cerrado todavía no se afirma una tasa', () => {
    const m = P.medir({ entregadas: [], cerradas: [], ahora: AHORA })
    expect(m.produccionFlota.tasaAceptacion).toBeNull()
    expect(P.formatear(m).join('\n')).toMatch(/a[úu]n sin tasa/)
  })
})
