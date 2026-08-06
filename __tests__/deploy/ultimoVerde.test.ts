/**
 * [T-619] Qué commit desplegar cuando la punta de `main` no tiene veredicto.
 *
 * El caso REAL medido el 06/08/2026 y que motiva todo esto: 40 commits en el día, hueco mediano
 * de 2 minutos entre pushes, y la API devolviendo `cancelled, cancelled, cancelled, queued`. El
 * lanzador preguntaba solo por la punta, agotaba sus 12 vueltas y NO desplegaba — sin dar error.
 */
const { elegirCommitDesplegable, debeAlertar } = require('@/lib/deploy/ultimoVerde')

const c = (sha: string, estado: string) => ({ sha, estado })

describe('elegirCommitDesplegable', () => {
  it('la punta en verde: se despliega la punta y no se deja nada fuera', () => {
    const r = elegirCommitDesplegable({ candidatos: [c('aaa1', 'verde'), c('bbb2', 'verde')] })
    expect(r.accion).toBe('desplegar')
    expect(r.sha).toBe('aaa1')
    expect(r.dejaFuera).toEqual([])
  })

  it('EL CASO DE T-619: la punta sin veredicto y un verde detrás → se despliega ese verde', () => {
    const r = elegirCommitDesplegable({
      candidatos: [
        c('f5ec554f6', 'faltan'),
        c('6c4ab0bc0', 'cancelado'),
        c('7005e5a3c', 'cancelado'),
        c('37c273ab2', 'verde'),
      ],
    })
    expect(r.accion).toBe('desplegar')
    expect(r.sha).toBe('37c273ab2')
    // …y NOMBRA lo que se queda detrás: un deploy que sube «casi todo» callándolo es el mismo
    // fallo silencioso que esto viene a arreglar.
    expect(r.dejaFuera).toEqual(['f5ec554f6', '6c4ab0bc0', '7005e5a3c'])
    expect(r.motivo).toMatch(/3 commit\(s\) más nuevos sin veredicto/)
  })

  it('un ROJO no detiene la búsqueda (se despliega lo último verificado) pero se CANTA', () => {
    // Si alguien rompió la punta, desplegar el último verde es lo correcto; callar que main está
    // roto, no.
    const r = elegirCommitDesplegable({
      candidatos: [c('roto1', 'rojo'), c('curso2', 'curso'), c('verde3', 'verde')],
    })
    expect(r.accion).toBe('desplegar')
    expect(r.sha).toBe('verde3')
    expect(r.rotos).toEqual(['roto1'])
  })

  it('NUNCA hacia atrás: si el verde elegido ya está vivo, no se despliega', () => {
    const r = elegirCommitDesplegable({
      candidatos: [c('nuevo1', 'faltan'), c('yaVivo2', 'verde')],
      yaVivo: (sha: string) => sha === 'yaVivo2',
    })
    expect(r.accion).toBe('nada')
    expect(r.motivo).toMatch(/ya está desplegado/)
  })

  it('sin ningún verde pero con CI sin terminar → ESPERAR (no lo sé ≠ adelante)', () => {
    const r = elegirCommitDesplegable({
      candidatos: [c('a', 'faltan'), c('b', 'cancelado'), c('c', 'curso')],
    })
    expect(r.accion).toBe('esperar')
    expect(r.dejaFuera).toHaveLength(3)
  })

  it('todo ROJO → abortar, que es distinto de esperar', () => {
    const r = elegirCommitDesplegable({ candidatos: [c('a', 'rojo'), c('b', 'rojo')] })
    expect(r.accion).toBe('abortar')
    expect(r.rotos).toEqual(['a', 'b'])
    expect(r.motivo).toMatch(/rompió main/)
  })

  it('sin candidatos → esperar, nunca desplegar a ciegas', () => {
    for (const entrada of [undefined, {}, { candidatos: [] }, { candidatos: null }]) {
      expect(elegirCommitDesplegable(entrada as never).accion).toBe('esperar')
    }
  })

  it('descarta entradas basura sin romperse', () => {
    const r = elegirCommitDesplegable({
      candidatos: [null, { estado: 'verde' }, c('bueno', 'verde')] as never,
    })
    expect(r.accion).toBe('desplegar')
    expect(r.sha).toBe('bueno')
  })

  it('un estado desconocido NO cuenta como verde ni como pendiente', () => {
    // Si mañana `ciGate` estrena un estado, el fallo seguro es no desplegar, no desplegarlo igual.
    const r = elegirCommitDesplegable({ candidatos: [c('raro', 'estado_que_no_existe')] })
    expect(r.accion).toBe('abortar')
  })
})

describe('debeAlertar — el fallo silencioso es el que hay que hacer visible', () => {
  it('un ESPERAR normal no alerta (el CI tarda, es lo esperable)', () => {
    expect(debeAlertar({ accion: 'esperar', vueltasAgotadas: false }).alertar).toBe(false)
  })

  it('agotar las vueltas SIN desplegar sí alerta: es justo el fallo que nadie veía', () => {
    expect(debeAlertar({ accion: 'esperar', vueltasAgotadas: true })).toEqual({
      alertar: true,
      severidad: 'error',
    })
  })

  it('abortar alerta siempre, se hayan agotado las vueltas o no', () => {
    expect(debeAlertar({ accion: 'abortar', vueltasAgotadas: false }).alertar).toBe(true)
  })

  it('un deploy que SÍ sale no alerta aunque haya tardado todas las vueltas', () => {
    expect(debeAlertar({ accion: 'desplegar', vueltasAgotadas: true }).alertar).toBe(false)
    expect(debeAlertar({ accion: 'nada', vueltasAgotadas: true }).alertar).toBe(false)
  })
})
