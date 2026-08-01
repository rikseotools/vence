/**
 * @jest-environment node
 *
 * Los términos TIENEN que prohibir la multicuenta, porque hay un aviso que lo afirma.
 *
 * POR QUÉ EXISTE (01/08/2026, [T-418]): se midió que 27 usuarios chocan 1.471 veces contra el
 * límite por DISPOSITIVO (el 53% de todos los rechazos de cupo), y que los 27 tienen 2 o más
 * cuentas en el mismo aparato (hasta 66 en un caso). La decisión de Manuel fue avisar a esa
 * gente de que se le está limitando la cuenta por usar varias.
 *
 * El problema que este guardarraíl fija: **hasta hoy los términos NO decían nada de eso**.
 * Prohibían «compartir tu cuenta con terceros», que es casi lo contrario (una cuenta usada por
 * varias personas, no varias cuentas de una persona). Un aviso que afirma un incumplimiento
 * inexistente es una acusación falsa, y el usuario que va a leer los términos lo descubre.
 *
 * Por eso el orden fue: primero la cláusula, después el aviso. Y por eso esto se vigila: si
 * alguien recorta los términos «para simplificar», el aviso que ya está enviado (o el que se
 * envíe) pasa a acusar de romper una regla que no existe. La regla y el mensaje que la invoca
 * viven en ficheros distintos y nada más los ata.
 *
 * NO comprueba la redacción exacta (eso sería frágil y no protege nada): comprueba que la
 * PROHIBICIÓN sigue estando y que sigue cubriendo los dos ejes que el aviso invoca — persona y
 * dispositivo — más el motivo (eludir el límite del plan gratuito).
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const TERMINOS = join(__dirname, '..', '..', 'app', 'terminos', 'page.js')

describe('Términos de uso — cláusula de una cuenta por persona y dispositivo', () => {
  const texto = readFileSync(TERMINOS, 'utf8')
  // El JSX parte las frases en varias líneas; se normaliza el espacio para poder buscar
  // por frase y no por cómo haya quedado el sangrado.
  const plano = texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase()

  it('prohíbe tener más de una cuenta POR PERSONA', () => {
    expect(plano).toMatch(/una (única|sola) cuenta/)
    expect(plano).toMatch(/cada persona/)
  })

  it('prohíbe usar varias cuentas EN EL MISMO DISPOSITIVO', () => {
    // El eje del dispositivo es el que de verdad hace cumplir el límite (una persona con dos
    // móviles no es el caso que nos ocupa); sin él, el aviso no se sostiene.
    expect(plano).toMatch(/dispositivo/)
    expect(plano).toMatch(/en cada dispositivo|mismo dispositivo/)
  })

  it('dice para QUÉ está prohibido: eludir el límite del plan gratuito', () => {
    // Sin el motivo, la cláusula parece arbitraria y no cubre el caso que se sanciona.
    expect(plano).toMatch(/l[ií]mites? del plan gratuito|eludirlo/)
  })

  it('enlaza con la consecuencia (poder limitar el acceso), que es lo que el aviso anuncia', () => {
    expect(plano).toMatch(/limitar el acceso/)
  })

  it('mantiene la prohibición ANTERIOR de compartir la cuenta (no se sustituye, se suma)', () => {
    // La regla vieja cubre un caso distinto (una cuenta, varias personas) y sigue haciendo
    // falta: quitarla al añadir la nueva sería cambiar un agujero por otro.
    expect(plano).toMatch(/compartir tu cuenta con terceros/)
  })
})
