/**
 * TRINQUETE (T-204, cabo 2): quien escribe una explicación estructurada NO puede marcar la pregunta
 * `safe` a ciegas.
 *
 * El defecto que fija: la explicación estructurada arregla la EXPLICACIÓN (las razones viajan con
 * su opción), pero no arregla unas OPCIONES que se citan entre sí —«La respuesta b) es correcta y
 * además…»—; esa pregunta sigue sin poder barajarse. Los dos escritores llamaban a
 * `record_shuffle_safety(…, 'safe', …)` incondicionalmente y era `sweep-shuffle-safety-drift` quien
 * lo descubría DESPUÉS. Medido el 27/07 con `d3419597` (art. 53.2 CE): nació `safe` en las tres
 * aplicaciones y hubo que devolverla a `unsafe` a mano. Con ~47k pendientes de backfill, el sweep
 * iría eternamente detrás recogiendo lo que el escritor acaba de romper.
 *
 * Se comprueba sobre el FUENTE, no sobre la BD, porque el fallo es de omisión: no hay nada que
 * observar en runtime hasta que ya se ha escrito mal. Un test de comportamiento exigiría RDS y no
 * correría en CI, que es justo donde tiene que sonar la alarma.
 */
import { readFileSync } from 'fs'
import path from 'path'

const ESCRITORES = ['scripts/aplicar-explicacion.ts', 'scripts/backfill-explanation-data.ts']

describe('los escritores de explicación estructurada consultan el detector de opciones cruzadas', () => {
  test.each(ESCRITORES)('%s importa optionsReferenceOtherOptions y lo usa', (fichero) => {
    const src = readFileSync(path.join(process.cwd(), fichero), 'utf8')
    expect(src).toMatch(/import \{ optionsReferenceOtherOptions \} from '@\/lib\/shuffle\/classifyShuffleMode'/)
    expect(src).toMatch(/optionsReferenceOtherOptions\(/)
  })

  test.each(ESCRITORES)('%s no marca `safe` como literal incondicional', (fichero) => {
    const src = readFileSync(path.join(process.cwd(), fichero), 'utf8')
    // Lo prohibido es la PAREJA literal de la forma vieja —veredicto y motivo fijos, sin haber
    // preguntado a nadie—. Un `'safe'` suelto es legítimo: hoy aparece como rama del ternario
    // `cruzadas ? 'unsafe' : 'safe'`, que es precisamente el arreglo. Buscar solo `'safe'` haría
    // que este trinquete se disparase con la propia solución (pasó al escribirlo).
    const formaVieja = src.match(/'safe',\s*'structured_explanation'/g) ?? []
    expect(formaVieja).toEqual([])
  })
})
