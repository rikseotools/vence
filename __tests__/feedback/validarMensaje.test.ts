/**
 * @jest-environment node
 *
 * Lo que NO se le dice a un usuario, hecho cumplir en el punto de escritura.
 *
 * Los casos de abajo son REALES: los dos primeros son borradores que se escribieron el 07/08/2026
 * incumpliendo reglas que ya estaban documentadas. Un manual de 2.000 líneas no se relee antes de
 * cada mensaje; esto sí corre siempre.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validarMensajeAUsuario } = require('../../lib/feedback/validarMensaje.cjs')

const ids = (t: string) => validarMensajeAUsuario(t).incumple.map((i: { id: string }) => i.id)

describe('mensajes que NO pueden salir', () => {
  it('el borrador real que mencionaba el apartado de recompensas', () => {
    expect(ids('Sobre tus aportaciones: en tu apartado de recompensas puedes ver cuáles se han registrado.'))
      .toContain('recompensa_mencionada')
  })

  it('«tienes razón», retirado el 07/08 (con y sin tilde)', () => {
    expect(ids('Hola Laura, tienes razón: las estadísticas no se mostraban.')).toContain('tienes_razon')
    expect(ids('tienes razon en lo que dices')).toContain('tienes_razon')
  })

  it('«no era cosa tuya» y la culpa proclamada', () => {
    expect(ids('Las estadísticas fallaban y no era cosa tuya.')).toContain('culpa_proclamada')
    expect(ids('El fallo era nuestro, ya está.')).toContain('culpa_proclamada')
  })

  it('las disculpas por la espera', () => {
    expect(ids('Gracias por tu paciencia con esto.')).toContain('disculpa_por_la_espera')
  })

  it('afirmar el arreglo en vez de dejarlo en condicional', () => {
    expect(ids('Ya está arreglado, puedes entrar.')).toContain('afirmar_el_arreglo')
  })

  it('decir que lo hace una IA', () => {
    expect(ids('El contenido está generado por IA.')).toContain('dice_que_es_ia')
  })

  it('un mensaje puede incumplir varias a la vez y las lista todas', () => {
    const v = validarMensajeAUsuario('Tienes razón, el fallo era nuestro. Ya está arreglado y verás tu recompensa.')
    expect(v.ok).toBe(false)
    expect(v.incumple.length).toBeGreaterThanOrEqual(4)
  })
})

describe('el borrador BUENO pasa', () => {
  it('el que se aprobó para Laura tras las dos correcciones', () => {
    const bueno = [
      'Hola Laura,', '',
      'Gracias por escribirnos.', '',
      'Las estadísticas no te aparecían, y ya debería estar resuelto. Tus datos siguen ahí, con',
      'todas tus preguntas respondidas y tu racha. Cuando puedas, entra y échales un vistazo.', '',
      'Cualquier otra duda, aquí estamos.', '',
      'Un saludo', 'Equipo de Vence',
    ].join('\n')
    expect(validarMensajeAUsuario(bueno)).toEqual({ ok: true, incumple: [] })
  })

  it('el de Diego, que ya se envió', () => {
    const enviado = 'Hola Diego,\n\nGracias por escribirnos.\n\nEl contador de preguntas diarias no ' +
      'estaba contando bien y te daba el cupo por agotado. Ya debería estar resuelto.\n\nUn saludo\nEquipo de Vence'
    expect(validarMensajeAUsuario(enviado).ok).toBe(true)
  })

  it('no marca «razón» en otros usos («con razón de», «la razón por la que»)', () => {
    expect(validarMensajeAUsuario('Esa es la razón por la que no aparecía.').ok).toBe(true)
  })

  it('un mensaje vacío o nulo no revienta', () => {
    expect(validarMensajeAUsuario('').ok).toBe(true)
    expect(validarMensajeAUsuario(null).ok).toBe(true)
  })
})
