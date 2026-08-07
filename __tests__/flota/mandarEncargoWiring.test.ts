/**
 * @jest-environment node
 */
// __tests__/flota/mandarEncargoWiring.test.ts — [T-617, hallazgo de la revisión 07/08]
//
// La entrega de T-617 (crash-loop de cuota) tenía tests verdes y aun así le faltaba una capa: TODO
// lo que probaba `cuota_agotada` y el `sudo -u flota` condicional testeaba `AUT.clasificar()` en
// aislamiento, o el TEXTO fuente de `flota.cjs` con `grep` — nunca el CABLEADO real. Un criterio
// correcto no prueba que su llamador lo use: el propio incidente que motivó T-617 (27 relanzamientos
// contra un trabajador sin cuota) pasó con `clasificar()` ya escrito y correcto, porque el camino de
// "retomar turno muerto" no lo llamaba.
//
// Este fichero ejercita el código REAL (no una reimplementación) mockeando `child_process.execFileSync`
// — el único punto de E/S del que cuelgan `enMaquina`, `logDelTurno`, `comandoDelPanel` y
// `turnosVivosDe` — y usando trabajadores YA REGISTRADOS (`l1`=portátil/local, `w1`=VPS/remoto) en
// vez de mockear `lib/flota/maquinas.cjs`, para no fingir una forma de máquina que el registro no
// tiene.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execFileSync: jest.fn(),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execFileSync } = require('child_process')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FLOTA = require('../../scripts/flota/flota.cjs')

const mockExec = execFileSync as unknown as jest.Mock

/** La "orden" de shell real, esté como bash -c orden o como …ssh … host orden (siempre el último arg). */
function ordenDe(llamada: unknown[]): string {
  const args = llamada[1] as unknown[]
  return Array.isArray(args) ? String(args[args.length - 1]) : ''
}

function llamadasQueContienen(fragmento: string): number {
  return mockExec.mock.calls.filter((c) => ordenDe(c).includes(fragmento)).length
}

const MENSAJE_CUOTA = "You've hit your weekly limit · resets 11pm (UTC)\nBye."

beforeEach(() => {
  mockExec.mockReset()
  delete process.env.VENCE_FLOTA_AQUI // l1 local / w1 remoto por registro, sin forzar nada
})

describe('[T-617] logDelTurno — el comando cambia según la máquina, no solo lo dice el comentario', () => {
  test('trabajador LOCAL (l1, portátil): el tail va SIN "sudo -u flota"', () => {
    mockExec.mockReturnValue('')
    FLOTA.logDelTurno('l1')
    expect(mockExec).toHaveBeenCalledTimes(1)
    const orden = ordenDe(mockExec.mock.calls[0])
    expect(orden).toContain('tail -c 4000 ~/flota-l1.log')
    expect(orden).not.toContain('sudo -u flota')
    // Y se ejecuta con bash -c (sin SSH): confirma que "local" de verdad quita la red del camino.
    expect(mockExec.mock.calls[0][0]).toBe('bash')
  })

  test('trabajador REMOTO (w1, VPS): el tail va CON "sudo -u flota" — el bug real de T-642', () => {
    mockExec.mockReturnValue('')
    FLOTA.logDelTurno('w1')
    expect(mockExec).toHaveBeenCalledTimes(1)
    const orden = ordenDe(mockExec.mock.calls[0])
    expect(orden).toContain('sudo -u flota')
    expect(orden).toContain('tail -c 4000 ~/flota-w1.log')
    // Y sale por ssh, no por bash local.
    expect(mockExec.mock.calls[0][0]).toBe('ssh')
  })

  test('si execFileSync falla (sin red, sin permiso…) devuelve cadena vacía, NUNCA lanza', () => {
    mockExec.mockImplementation(() => { throw new Error('Connection refused') })
    expect(FLOTA.logDelTurno('w1')).toBe('')
  })
})

describe('[T-617→T-642] mandarEncargo — SIN CUOTA NO SE MANDA NADA, medido en el cableado real', () => {
  // Simula: panel libre (bash), 0 turnos vivos, y el log del turno ANTERIOR con el mensaje real
  // de cuota agotada capturado en el incidente (T-617). Es la secuencia exacta por la que pasa
  // `mandarEncargo` antes de decidir.
  function mockearComoSiEstuvieraLibrePeroSinCuota() {
    mockExec.mockImplementation((_file: string, args: string[]) => {
      const orden = args[args.length - 1] || ''
      if (orden.includes('list-panes')) return 'bash\n' // panel libre
      if (orden.includes('pgrep -fc')) return '0\n' // 0 turnos vivos
      if (orden.includes('tail -c 4000')) return MENSAJE_CUOTA // el turno anterior murió por cuota
      throw new Error(`orden no esperada en este test: ${orden}`)
    })
  }

  test('bloquea ANTES de mandar nada: no hay send-keys, no hay fichero de encargo', () => {
    mockearComoSiEstuvieraLibrePeroSinCuota()
    const r = FLOTA.mandarEncargo('w1', 'Eres w1, ...')
    expect(r).toEqual({ ok: false, sinCuota: true, motivo: expect.stringContaining('resets') })
    // La prueba real de que bloqueó DE VERDAD (no que casualmente devolvió lo correcto): el
    // camino de mandar el encargo (send-keys / escribir el fichero) nunca se ejecutó.
    expect(llamadasQueContienen('send-keys')).toBe(0)
    expect(llamadasQueContienen('mkdir -p')).toBe(0)
  })

  test('el motivo que devuelve es el de AUT.clasificar (misma fuente, no reimplementado)', () => {
    mockearComoSiEstuvieraLibrePeroSinCuota()
    const AUT = require('../../lib/flota/autenticacion.cjs')
    const esperado = AUT.clasificar(MENSAJE_CUOTA)
    const r = FLOTA.mandarEncargo('w1', 'texto')
    expect(r.motivo).toBe(esperado.detalle)
  })

  test('si el panel está ocupado, bloquea ANTES de leer el log (no gasta esa comprobación de más)', () => {
    mockExec.mockImplementation((_file: string, args: string[]) => {
      const orden = args[args.length - 1] || ''
      if (orden.includes('list-panes')) return 'node\n' // ocupado: no es un shell
      throw new Error(`orden no esperada — no debería llegar aquí: ${orden}`)
    })
    const r = FLOTA.mandarEncargo('w1', 'texto')
    expect(r.ok).toBe(false)
    expect(r.ocupado).toBe(true)
    expect(llamadasQueContienen('tail -c 4000')).toBe(0)
  })
})
