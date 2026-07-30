// GUARDARRAÍL: un referido que comparte DISPOSITIVO con su embajador no cobra.
//
// ## De dónde sale (Manuel, 30/07/2026)
//
// El programa de referidos ya excluía el autorregistro comparando la **IP de registro**. Pero
// la IP se cambia sin esfuerzo: basta salir del wifi y tirar de datos móviles, o una VPN. Es
// decir, quien quisiera fabricarse referidos solo tenía que registrarlos desde otra red con
// el MISMO teléfono, y cobraba.
//
// El rastro que sí cuesta falsear ya lo teníamos y no se estaba usando aquí: `user_devices`,
// la misma tabla que sostiene la detección de multicuenta del sistema de fraude. Ahora se
// cruza por el identificador del navegador (`device_id`) y por la huella del equipo
// (`hw_fingerprint`), que sobrevive a borrar el almacenamiento del navegador.
//
// Medido al cerrarlo: 8 referidos en el sistema, **0** compartían dispositivo. El agujero no
// estaba explotado; se cierra ahora, que el programa es pequeño y se puede revisar a mano, y
// no cuando ya no lo sea.
//
// Este test mira el SQL porque la regla vive en la consulta: no hay función pura que probar,
// y una guarda de dinero que solo existe en la cabeza de quien la escribió no es una guarda.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('el bono de registro activo excluye el mismo dispositivo', () => {
  const activeSignup = leer('lib/referrals/activeSignup.ts')

  it('sigue excluyendo la misma IP de registro (no se ha perdido la guarda vieja)', () => {
    expect(activeSignup).toMatch(/registration_ip IS DISTINCT FROM/i)
  })

  it('excluye además a quien comparte dispositivo con el embajador', () => {
    expect(activeSignup).toMatch(/NOT EXISTS[\s\S]{0,400}user_devices/i)
  })

  it('cruza por las DOS señales: identificador de navegador y huella del equipo', () => {
    // Solo por device_id sería trivial de esquivar (borrar datos del navegador).
    const bloque = activeSignup.slice(activeSignup.indexOf('NOT EXISTS'))
    expect(bloque).toMatch(/device_id/)
    expect(bloque).toMatch(/hw_fingerprint/)
  })
})

describe('la pantalla marca ese referido como no válido', () => {
  const queries = leer('lib/referrals/queries.ts')
  const vista = leer('components/embajadores/EmbajadorPanelView.tsx')

  it('la consulta trae si comparte dispositivo', () => {
    expect(queries).toMatch(/mismoDispositivo/)
    expect(queries).toMatch(/user_devices/)
  })

  it('«same_device» es un motivo de invalidez de primera clase', () => {
    expect(queries).toMatch(/'self_referral' \| 'preexisting' \| 'same_device' \| null/)
    expect(vista).toMatch(/'same_device'/)
  })

  it('el autorregistro sigue teniendo prioridad sobre el resto de motivos', () => {
    // Si dispara más de uno, se enseña el más grave; el orden importa para el texto.
    const i = queries.indexOf('const invalidReason')
    const bloque = queries.slice(i, i + 400)
    expect(bloque.indexOf('self_referral')).toBeLessThan(bloque.indexOf('same_device'))
  })

  it('el texto visible no revela qué señal saltó', () => {
    // Nombrar «mismo dispositivo» le enseña a quien lo intenta exactamente qué esquivar, y a
    // quien es legítimo (dos personas en la misma casa) no le sirve de nada.
    //
    // Se comprueba la palabra en ESPAÑOL, que es la que acabaría en pantalla. El
    // identificador técnico `same_device` tiene que existir —es el motivo— y buscar «device»
    // a lo bruto hacía que el test fallara por su propia implementación.
    // Sin comentarios: la explicación de POR QUÉ no se nombra la señal sí puede (y debe)
    // nombrarla — lo que no puede es acabar en pantalla.
    const sinComentarios = vista
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(sinComentarios).not.toMatch(/dispositivo/i)
    expect(sinComentarios).not.toMatch(/misma ip/i)
    expect(vista).toMatch(/No cuenta como captación nueva/)
  })
})
