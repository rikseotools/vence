/**
 * El dossier traduce la letra que VIO el usuario a la de la BD (T-080 Fase 1).
 *
 * Qué defiende: con el barajado encendido, el serve permuta las opciones por exposición y guarda
 * esa permutación en `test_questions.option_order`. La letra que el usuario nombra en su
 * impugnación («la opción C es errónea») es la que vio ÉL, no la de la BD. Sin traducir, se abre
 * la C de la BD —otra opción distinta— y se diagnostica la pregunta equivocada con total
 * seguridad; y peor, se le responde nombrándole una letra que él no vio.
 *
 * El dato ya se guardaba desde la migración del 22/07: lo que faltaba era mirarlo. Medido el
 * 28/07 antes de encender el flag: 0 referencias a `option_order` en todo `scripts/impugnaciones/`.
 */
const path = require('path')
const { mapaExposicion, traducirLetrasDelUsuario } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/revisar-impugnacion.cjs')
)

describe('mapaExposicion — posición mostrada → letra en BD', () => {
  test('permutación real: order[i] es el índice ORIGINAL mostrado en la posición i', () => {
    expect(mapaExposicion([2, 0, 3, 1])).toEqual([
      { vio: 'A', enBd: 'C' }, { vio: 'B', enBd: 'A' },
      { vio: 'C', enBd: 'D' }, { vio: 'D', enBd: 'B' },
    ])
  })

  test('la identidad se mapea a sí misma (sirve de red: no inventa desplazamientos)', () => {
    expect(mapaExposicion([0, 1, 2, 3])).toEqual([
      { vio: 'A', enBd: 'A' }, { vio: 'B', enBd: 'B' },
      { vio: 'C', enBd: 'C' }, { vio: 'D', enBd: 'D' },
    ])
  })

  test('sin permutación guardada no afirma nada (orden natural)', () => {
    expect(mapaExposicion(null)).toBeNull()
    expect(mapaExposicion([])).toBeNull()
  })

  test('preguntas de 5 opciones (E) también se mapean', () => {
    expect(mapaExposicion([4, 3, 2, 1, 0])[0]).toEqual({ vio: 'A', enBd: 'E' })
  })
})

describe('traducirLetrasDelUsuario — qué opción está señalando de verdad', () => {
  test('caza las formas con que se nombra una opción y las traduce', () => {
    expect(traducirLetrasDelUsuario('La opción C está mal, debería ser la A)', [2, 0, 3, 1]))
      .toEqual([{ dijo: 'A', esEnBd: 'C' }, { dijo: 'C', esEnBd: 'D' }])
    expect(traducirLetrasDelUsuario('la respuesta b no es correcta', [1, 0, 2, 3]))
      .toEqual([{ dijo: 'B', esEnBd: 'A' }])
  })

  test('si el usuario no nombra ninguna letra, no se inventa una traducción', () => {
    expect(traducirLetrasDelUsuario('La pregunta está mal planteada', [2, 0, 3, 1])).toBeNull()
  })

  test('sin permutación no traduce (lo que dijo el usuario ES lo de la BD)', () => {
    expect(traducirLetrasDelUsuario('la opción C está mal', null)).toBeNull()
  })
})
