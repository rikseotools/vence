/**
 * @jest-environment node
 *
 * [T-677] La salud de la MÁQUINA de la flota, que era el hueco: se vigilaba al trabajador
 * (autenticación, clon, productividad, turno) y nunca el sitio donde trabaja.
 *
 * El caso real está aquí abajo como test: es la foto de `flota-1` el 07/08/2026 mientras el panel
 * pintaba los cuatro trabajadores en verde.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clasificarMaquina, turnoSinProgreso } = require('../../lib/flota/saludMaquina.cjs')

/** La máquina sana de referencia: 4 núcleos, memoria de sobra, un solo build. */
const SANA = {
  memTotalMb: 7751, memDisponibleMb: 5200, swapTotalMb: 0,
  load1: 1.2, nucleos: 4, cpuOciosaPct: 70, buildsNode: 1,
}

describe('clasificarMaquina', () => {
  it('una máquina con sitio y un build no molesta a nadie', () => {
    expect(clasificarMaquina(SANA).estado).toBe('ok')
  })

  it('EL CASO REAL de flota-1 (07/08): ahogada, con los tres motivos', () => {
    const v = clasificarMaquina({
      memTotalMb: 7751, memDisponibleMb: 702, swapTotalMb: 0,
      load1: 19.69, nucleos: 4, cpuOciosaPct: 97.7, buildsNode: 4, turnosEnEsperaIo: 4,
    })
    expect(v.estado).toBe('ahogada')
    expect(v.motivos.join(' | ')).toMatch(/9 % de memoria/)
    expect(v.motivos.join(' | ')).toMatch(/esperando disco/)
    expect(v.motivos.join(' | ')).toMatch(/4 builds/)
    expect(v.motivos.join(' | ')).toMatch(/sin swap/)
    expect(v.señales.memDisponiblePct).toBe(9)
    expect(v.señales.cargaPorNucleo).toBeCloseTo(4.92, 1)
  })

  it('CARGA ALTA CON CPU OCUPADA NO ES AVERÍA: es una máquina trabajando', () => {
    // Esta es la distinción que hace usable la señal. Sin ella, cualquier build honesto alerta.
    const v = clasificarMaquina({ ...SANA, load1: 20, cpuOciosaPct: 5 })
    expect(v.estado).toBe('ok')
    expect(v.motivos.join(' ')).not.toMatch(/carga/)
  })

  it('la misma carga con la CPU ociosa SÍ acusa (los procesos esperan disco)', () => {
    const v = clasificarMaquina({ ...SANA, load1: 20, cpuOciosaPct: 95 })
    expect(v.estado).toBe('ahogada')
  })

  it('mide `available`, no `free`: un Linux sano usa casi toda la RAM en caché', () => {
    // 5.200 MB disponibles con 300 «libres» es una máquina perfectamente sana.
    const v = clasificarMaquina({ ...SANA, memDisponibleMb: 5200 })
    expect(v.estado).toBe('ok')
  })

  it('dos builds a la vez ya aprietan; tres ahogan', () => {
    expect(clasificarMaquina({ ...SANA, buildsNode: 2 }).estado).toBe('apretada')
    expect(clasificarMaquina({ ...SANA, buildsNode: 3 }).estado).toBe('ahogada')
  })

  it('la falta de swap NO alerta por sí sola (una máquina sin swap puede estar sana)', () => {
    const v = clasificarMaquina({ ...SANA, swapTotalMb: 0 })
    expect(v.estado).toBe('ok')
    expect(v.motivos.join(' ')).not.toMatch(/swap/)
  })

  it('pero cuando ya hay ahogo, explica por qué no hay amortiguador', () => {
    const v = clasificarMaquina({ ...SANA, memDisponibleMb: 500, swapTotalMb: 0 })
    expect(v.motivos.join(' ')).toMatch(/sin swap/)
  })

  it('el estado siempre sube al peor motivo, nunca baja', () => {
    const v = clasificarMaquina({ ...SANA, buildsNode: 2, memDisponibleMb: 600 })
    expect(v.estado).toBe('ahogada') // memoria ahogada gana sobre builds apretados
  })
})

describe('turnoSinProgreso — el cruce que faltaba', () => {
  it('EL CASO REAL de w1: proceso vivo y 8,5 h sin latir', () => {
    const v = turnoSinProgreso({ ejecutando: true, latidoMin: 508, turnoMin: 151 })
    expect(v.sospechoso).toBe(true)
    expect(v.motivo).toMatch(/508 min sin que su andamiaje dé señal/)
    expect(v.motivo).toMatch(/151 min/)
  })

  it('un turno largo que SÍ va latiendo no es sospechoso (trabajo legítimo)', () => {
    expect(turnoSinProgreso({ ejecutando: true, latidoMin: 12, turnoMin: 300 }).sospechoso).toBe(false)
  })

  it('sin proceso ejecutando no opina: ese caso ya lo cubre «cogida y sin proceso»', () => {
    expect(turnoSinProgreso({ ejecutando: false, latidoMin: 900, turnoMin: null }).sospechoso).toBe(false)
  })

  it('sin dato de latido no inventa un veredicto', () => {
    expect(turnoSinProgreso({ ejecutando: true, latidoMin: null, turnoMin: 60 }).sospechoso).toBe(false)
  })

  it('el límite es configurable y se respeta en el borde', () => {
    expect(turnoSinProgreso({ ejecutando: true, latidoMin: 119, turnoMin: 10 }, 120).sospechoso).toBe(false)
    expect(turnoSinProgreso({ ejecutando: true, latidoMin: 120, turnoMin: 10 }, 120).sospechoso).toBe(true)
  })
})
