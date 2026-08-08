/**
 * @jest-environment node
 *
 * [T-620] Una espera de deploy que no se puede cumplir no es una pausa: es perder la tarea.
 *
 * `pause --tras-deploy <sha>` guarda el sha, y `deployed` despierta la tarea cuando ese commit
 * está CONTENIDO en el desplegado (`merge-base --is-ancestor`). Esa parte es correcta. Lo que
 * faltaba es comprobar que el sha PUEDA llegar a estar contenido en algo: si no, la tarea se
 * duerme para siempre y en `list` se ve igual que una espera legítima.
 *
 * Medido el 06/08/2026: 2 de las 11 tareas que esperaban un deploy tenían un sha inalcanzable.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarShaEspera } = require('../../lib/backlog/esperaDeploy.cjs')

describe('[T-620] clasificarShaEspera', () => {
  it('publicado en origin/main: es el caso normal y no molesta', () => {
    const v = clasificarShaEspera({ existe: true, enOriginMain: true, enHead: true })
    expect(v.estado).toBe('desplegable')
    expect(v.bloquea).toBe(false)
  })

  it('commiteado y sin pushear: AVISA pero NO bloquea', () => {
    // Pausar antes de pushear es un orden legítimo y muy común (`pause` y luego `git push`).
    // Bloquearlo enseñaría a rodear la puerta, que es como mueren los guardarraíles (T-375).
    const v = clasificarShaEspera({ existe: true, enOriginMain: false, enHead: true })
    expect(v.estado).toBe('sin_pushear')
    expect(v.bloquea).toBe(false)
    // …y avisa de lo que va a pasar después, que es la variante 2 del defecto.
    expect(v.motivo).toMatch(/rebase/i)
  })

  it('EL CASO 1 (rescate): commit que solo vive en otra rama → BLOQUEA', () => {
    // Al traer `flota/w3` a main, T-159/T-270/T-319 esperaban `2fefc60e` y `cdc323e6`, shas de
    // la rama. El cherry-pick les da shas nuevos, así que el original no llega nunca.
    const v = clasificarShaEspera({ existe: true, enOriginMain: false, enHead: false })
    expect(v.estado).toBe('inalcanzable')
    expect(v.bloquea).toBe(true)
  })

  it('EL CASO 2 (rebase): sha reescrito, git ya no lo reconoce → BLOQUEA', () => {
    // La traicionera, porque la comete quien hace todo bien: pausa con el sha recién
    // commiteado, el push se rechaza por no-ff, rebasa, y el rebase le da un sha nuevo.
    // Le pasó a T-609 en la misma sesión que escribió esto (313355c09 → 6bf2ffd17).
    const v = clasificarShaEspera({ existe: false })
    expect(v.estado).toBe('inalcanzable')
    expect(v.bloquea).toBe(true)
    expect(v.motivo).toMatch(/no reconoce/i)
  })

  it('si git no puede contestar, NO bloquea (fail-open)', () => {
    // Aquí el fail-open sí es correcto, y conviene decir por qué para no confundirlo con
    // [T-615]: allí el veredicto guardaba algo irreversible (borrar un worktree, mandar un
    // correo). Aquí lo peor que pasa por dejar pasar es que la tarea siga esperando, que es
    // exactamente lo que ya hacía. No hay nada que proteger cerrando.
    expect(clasificarShaEspera({}).bloquea).toBe(false)
    expect(clasificarShaEspera({}).estado).toBe('desconocido')
    expect(clasificarShaEspera({ existe: true }).bloquea).toBe(false)
  })

  it('el motivo del bloqueo DICE qué hacer, no solo que falló', () => {
    const v = clasificarShaEspera({ existe: true, enOriginMain: false, enHead: false })
    expect(v.motivo).toMatch(/otra rama|rebase/i)
    expect(v.motivo.length).toBeGreaterThan(40)
  })
})

/**
 * [T-735] La pregunta HERMANA: el sha de espera puede estar impecable y no llevar dentro nada de
 * la tarea.
 *
 * Medido el 08/08/2026 sobre las 57 tareas vivas con un pendiente escrito: 5 no tenían NI UN
 * commit declarante en `origin/main` (T-328, T-352, T-381, T-411, T-562), más T-600 y T-635
 * encontradas y fusionadas ese mismo día. Siete en una jornada. Y no fallaban en silencio: el
 * canario de T-381 salía ROJO y parecía que su arreglo no servía; T-352 llevaba 7 días sin
 * emitir su evento. En los dos casos el código sencillamente no estaba en main.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarTrabajoEnMain } = require('../../lib/backlog/esperaDeploy.cjs')

describe('[T-735] clasificarTrabajoEnMain', () => {
  it('con trabajo publicado en main, la espera significa algo: no molesta', () => {
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 3, enMain: 3, enHead: 3 })
    expect(v.estado).toBe('en_main')
    expect(v.bloquea).toBe(false)
  })

  it('basta UN commit en main: una tarea puede seguir trabajándose después de publicar parte', () => {
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 4, enMain: 1, enHead: 4 })
    expect(v.estado).toBe('en_main')
    expect(v.bloquea).toBe(false)
  })

  it('EL CASO MEDIDO: commits solo en otra rama → bloquea, porque ningún deploy puede incluirlos', () => {
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 3, enMain: 0, enHead: 0 })
    expect(v.estado).toBe('sin_fusionar')
    expect(v.bloquea).toBe(true)
    expect(v.motivo).toMatch(/otra rama/)
  })

  it('commiteado y sin pushear NO bloquea: contradiría a clasificarShaEspera, que ya lo permite', () => {
    // Dos puertas del MISMO comando con criterios distintos no protegen, se estorban (T-375).
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 2, enMain: 0, enHead: 2 })
    expect(v.estado).toBe('sin_pushear')
    expect(v.bloquea).toBe(false)
  })

  it('sin commits que la declaren NO bloquea: media ficha del repo no se despliega', () => {
    const v = clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 0, enMain: 0, enHead: 0 })
    expect(v.estado).toBe('sin_commits')
    expect(v.bloquea).toBe(false)
  })

  it('sin git: FAIL-OPEN, como el resto del andamiaje', () => {
    expect(clasificarTrabajoEnMain({ gitDisponible: false }).bloquea).toBe(false)
    expect(clasificarTrabajoEnMain({}).bloquea).toBe(false)
    expect(clasificarTrabajoEnMain().bloquea).toBe(false)
    expect(clasificarTrabajoEnMain({ gitDisponible: true }).estado).toBe('desconocido')
  })

  it('el sha de espera y el trabajo de la tarea son preguntas DISTINTAS (el fallo del 08/08)', () => {
    // `50e50e08` estaba en origin/main y era un deploy real de esa tarde: la puerta hermana lo
    // da por bueno, con razón. Y aun así ninguno de los commits de T-352/T-381 iba dentro.
    expect(clasificarShaEspera({ existe: true, enOriginMain: true, enHead: false }).bloquea).toBe(false)
    expect(clasificarTrabajoEnMain({ gitDisponible: true, declarantes: 3, enMain: 0, enHead: 0 }).bloquea).toBe(true)
  })
})
