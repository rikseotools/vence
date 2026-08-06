/**
 * @jest-environment node
 *
 * [T-632] Una revisión no puede aprobar trabajo que no está a salvo.
 *
 * Reconstruido sobre [T-560] el 06/08/2026, y **nadie mintió en ningún paso**: `w1` hizo el
 * trabajo (commit `db2c44e2c`), `w2` lo revisó bien —leyó el diff y reprodujo la medición contra
 * RDS—, `w1` no pudo empujarlo (sin credenciales, [T-628]) y después su rama se movió, dejando el
 * commit **huérfano**: existe como objeto y ninguna rama lo contiene.
 *
 * Resultado: ficha diciendo «arreglado», veredicto `ok`, y el bug intacto en `main`.
 *
 * El hueco no está en el trabajo ni en la revisión, sino en QUÉ se revisó: un COMMIT, no un
 * ESTADO ALCANZABLE.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { puedeRevisarse } = require('../../lib/backlog/revision.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shasCitados } = require('../../lib/backlog/ramasDeTarea.cjs')

describe('[T-632] puedeRevisarse', () => {
  it('EL CASO T-560: commit que no cuelga de ninguna rama remota → NO se aprueba', () => {
    const v = puedeRevisarse({ alcanzable: false })
    expect(v.permitido).toBe(false)
    expect(v.motivo).toMatch(/recolector de basura|se evapora/)
  })

  it('a salvo en un remoto → adelante', () => {
    expect(puedeRevisarse({ alcanzable: true, referencias: ['origin/flota/w1'] }).permitido).toBe(true)
  })

  it('si NO se pudo comprobar, se deja pasar', () => {
    // Aquí el fail-open es el correcto y conviene decir por qué, para no confundirlo con [T-615]:
    // esto es una comprobación auxiliar, no la autoridad. Dejar a la flota sin poder revisar
    // porque el git local falla sería peor que el problema — y el daño no es irreversible: la
    // tarea sigue ahí, revisable otra vez.
    expect(puedeRevisarse({}).permitido).toBe(true)
    expect(puedeRevisarse({ alcanzable: null }).permitido).toBe(true)
  })

  it('el motivo del bloqueo explica el DAÑO, no solo la regla', () => {
    // Un bloqueo que solo dice «no cumple X» se rodea; uno que dice qué se pierde, se entiende.
    expect(puedeRevisarse({ alcanzable: false }).motivo.length).toBeGreaterThan(60)
  })
})

describe('[T-632] shasCitados — de dónde sale el commit a comprobar', () => {
  it('coge el sha que la entrega escribe para que otro lo mire', () => {
    expect(shasCitados('Arreglado en commit db2c44e2c, rama flota/w1')).toEqual(['db2c44e2c'])
  })

  it('coge varios sin repetir', () => {
    expect(shasCitados('db2c44e2c y 491f6236b, y otra vez db2c44e2c').sort())
      .toEqual(['491f6236b', 'db2c44e2c'])
  })

  it('NO casa palabras que solo parecen hexadecimales', () => {
    // Por debajo de 7 caracteres se cuela cualquier cosa: «added», «face», «faced»…
    expect(shasCitados('added a facade to the beef')).toEqual([])
  })

  it('sin ningún sha no se inventa uno', () => {
    expect(shasCitados('lo arreglé y lo dejé listo')).toEqual([])
  })
})
