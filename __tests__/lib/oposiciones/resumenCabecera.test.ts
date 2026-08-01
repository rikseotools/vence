/**
 * La frase de la cabecera de /oposiciones.
 *
 * Existe por un defecto que el CÓDIGO FUENTE no delataba: se leía
 *
 *     {' '}{conInscripcion.length} con inscripción abierta ahora.
 *
 * y en pantalla salía **«8con inscripción abierta ahora»**. JSX recorta el espacio inicial de un
 * texto que empieza justo detrás de una expresión, así que React recibía
 * `[" ", 8, "con inscripción…"]`. Solo se veía en el HTML servido.
 *
 * La lección que fija este fichero: cuando una frase se construye pegando trozos en JSX, el
 * espaciado deja de ser evidente. Aquí es una cadena normal y se puede afirmar.
 */
import {
  fraseInscripcionAbierta,
  formatoPlazas,
} from '@/lib/oposiciones/resumenCabecera'

describe('la frase de inscripción abierta', () => {
  it('separa el número de la palabra siguiente (el defecto exacto)', () => {
    const f = fraseInscripcionAbierta(8)!
    expect(f).toBe('8 con inscripción abierta ahora.')
    expect(f).not.toMatch(/\dcon/)
  })

  it('nunca deja un número pegado, sea cual sea la cifra', () => {
    for (const n of [1, 2, 9, 10, 99, 124]) {
      expect(fraseInscripcionAbierta(n)).not.toMatch(/\dcon/)
    }
  })

  it('con una sola no dice «1 con» de forma rara', () => {
    expect(fraseInscripcionAbierta(1)).toBe('1 con inscripción abierta ahora.')
  })

  it('sin ninguna no hay frase (no se pinta un «0 con inscripción abierta»)', () => {
    expect(fraseInscripcionAbierta(0)).toBeNull()
    expect(fraseInscripcionAbierta(-3)).toBeNull()
  })

  it('una entrada basura no imprime «NaN con inscripción abierta»', () => {
    expect(fraseInscripcionAbierta(NaN)).toBeNull()
    expect(fraseInscripcionAbierta(undefined as unknown as number)).toBeNull()
  })
})

describe('el formato de plazas', () => {
  it('usa el separador español de miles', () => {
    expect(formatoPlazas(42261)).toBe('42.261')
  })

  it('un valor ausente no imprime «NaN»', () => {
    expect(formatoPlazas(undefined as unknown as number)).toBe('0')
    expect(formatoPlazas(NaN)).toBe('0')
  })
})
