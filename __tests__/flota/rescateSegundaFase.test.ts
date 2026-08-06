/**
 * @jest-environment node
 *
 * [T-628] El rescate corre en la máquina del trabajador y empuja desde allí. En el VPS ese push
 * falla SIEMPRE —los trabajadores no tienen credenciales de git—, así que el rescate encontraba
 * el trabajo y lo dejaba donde estaba.
 *
 * Medido el 06/08/2026: **11 ramas atrapadas** en el VPS con contenido que no existía en ningún
 * otro sitio (una con un bug de producción, `fix/T-397`), y **6 tareas** que el panel presentaba
 * como «esperando tu decisión» cuando solo esperaban esto.
 *
 * El portátil es el único sitio con las DOS mitades: acceso SSH a la máquina y credenciales del
 * repo. La segunda fase remata desde ahí — con el NOMBRE QUE YA CALCULÓ EL RESCATE, no uno
 * recalculado: dos generadores del mismo nombre divergen ([T-130]).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ordenRescate, parsearRescate, necesitaSegundaFase } = require('../../lib/flota/rescate.cjs')

const LOCAL = { local: true }
const REMOTA = { local: false, host: '1.2.3.4', usuario: 'root' }

describe('[T-628] parsearRescate — un solo lector de la salida', () => {
  it('lee los pares origen|destino que emite el rescate', () => {
    const s = [
      'RAMA=rescate/w1-flota-T-525-491f6236b',
      'ORIGEN=flota/T-525|rescate/w1-flota-T-525-491f6236b',
      'SALVADO=2',
    ].join('\n')
    expect(parsearRescate(s).pares).toEqual([
      { origen: 'flota/T-525', destino: 'rescate/w1-flota-T-525-491f6236b' },
    ])
    expect(parsearRescate(s).salvado).toBe(2)
  })

  it('reconoce OCUPADO y NADA, que NO son fallos', () => {
    expect(parsearRescate('OCUPADO').ocupado).toBe(true)
    expect(parsearRescate('NADA').nada).toBe(true)
  })

  it('sin SALVADO devuelve null, no 0: «no lo dijo» ≠ «todo a salvo»', () => {
    // Mismo criterio que [T-615]: un cero que no se ha medido es una afirmación falsa.
    expect(parsearRescate('RAMA=x').salvado).toBeNull()
  })

  it('un destino con guiones y barras aplanadas no rompe el par', () => {
    const s = 'ORIGEN=fix/T-397-target-oposicion|rescate/w2-fix-T-397-target-oposicion-466d247f8'
    expect(parsearRescate(s).pares[0]).toEqual({
      origen: 'fix/T-397-target-oposicion',
      destino: 'rescate/w2-fix-T-397-target-oposicion-466d247f8',
    })
  })
})

describe('[T-628] necesitaSegundaFase — solo donde hace falta', () => {
  const conTrabajo = parsearRescate('ORIGEN=flota/T-525|rescate/w1-x-abc\nSALVADO=2')

  it('EL CASO DEL VPS: máquina remota que no pudo empujar → SÍ', () => {
    const v = necesitaSegundaFase(REMOTA, conTrabajo)
    expect(v.hace_falta).toBe(true)
    expect(v.motivo).toMatch(/fuera de todo remoto/)
  })

  it('máquina LOCAL: nunca — su propio push es el bueno', () => {
    // Repetirlo desde fuera sería un segundo camino al mismo sitio, y entonces «se rescató»
    // dejaría de ser comprobable por un solo indicador.
    expect(necesitaSegundaFase(LOCAL, conTrabajo).hace_falta).toBe(false)
  })

  it('remota que SÍ pudo empujar (SALVADO=0): no se repite', () => {
    const ya = parsearRescate('ORIGEN=a|b\nSALVADO=0')
    expect(necesitaSegundaFase(REMOTA, ya).hace_falta).toBe(false)
  })

  it('sin ramas que rescatar: no se hace nada', () => {
    expect(necesitaSegundaFase(REMOTA, parsearRescate('NADA')).hace_falta).toBe(false)
  })

  it('máquina desconocida no dispara una fase contra nadie', () => {
    expect(necesitaSegundaFase(null, conTrabajo).hace_falta).toBe(false)
  })

  it('SALVADO sin confirmar (null) con ramas identificadas: SÍ remata, y lo dice', () => {
    // Si el rescate se cortó antes de contar, lo prudente es rematar: el coste de repetir un
    // push idempotente es cero, y el de no hacerlo es dejar el trabajo en una sola máquina.
    const v = necesitaSegundaFase(REMOTA, parsearRescate('ORIGEN=a|b'))
    expect(v.hace_falta).toBe(true)
    expect(v.motivo).toMatch(/sin confirmar/)
  })
})

describe('[T-628] la orden sigue emitiendo lo que ya consumían', () => {
  it('no rompe el contrato anterior (RAMA= y SALVADO=)', () => {
    const orden = ordenRescate({ arbol: '/x', trabajador: 'w1' })
    expect(orden).toContain('echo RAMA=$RAMA')
    expect(orden).toContain('echo SALVADO=')
  })

  it('…y añade el par, con el MISMO nombre que ya calculaba', () => {
    const orden = ordenRescate({ arbol: '/x', trabajador: 'w1' })
    expect(orden).toContain('echo ORIGEN=$R\\|$RAMA')
    // El namer sigue siendo uno: el destino sale de $RAMA, no se reconstruye en otro sitio.
    expect((orden.match(/RAMA=rescate\//g) || []).length).toBe(1)
  })
})
