/**
 * El aviso de solape: «tu suscripción actual sigue activa hasta el X». (T-355, 31/07/2026)
 *
 * Núcleo PURO —sin BD ni fechas del sistema— porque decide qué se le dice a alguien justo antes de
 * cobrarle: si el texto miente o sobra, la queja es de dinero.
 *
 * Por qué avisar y no bloquear el botón: hay quien PREFIERE contratar ya (no quiere arriesgarse a
 * quedarse sin servicio, o quiere asegurar el precio antes de que caduque la oferta). Quitarle la
 * opción sería decidir por él; decírselo con la fecha delante es informarle. Y por qué no
 * prorratear: son dos cuentas de Stripe distintas, sin clientes ni tarjetas compartidas, así que no
 * hay nada que prorratear entre ellas — la única alternativa real sería no dejarle contratar hasta
 * su fecha, y eso es peor.
 */

export interface AvisoSolape {
  /** ¿Se solaparían los cobros? */
  solapa: boolean
  /** Días que pagaría dos veces (0 si no solapa). */
  dias: number
  /** Lo que se le dice, ya redactado. Vacío si no hay nada que avisar. */
  texto: string
}

const SIN_AVISO: AvisoSolape = { solapa: false, dias: 0, texto: '' }

/**
 * @param vigenteHasta fin de la suscripción que YA tiene (null = no tiene ninguna viva)
 * @param ahora        momento de referencia
 */
export function avisoSolape(vigenteHasta: Date | string | null | undefined, ahora: Date = new Date()): AvisoSolape {
  if (!vigenteHasta) return SIN_AVISO
  const fin = vigenteHasta instanceof Date ? vigenteHasta : new Date(vigenteHasta)
  if (isNaN(fin.getTime()) || fin <= ahora) return SIN_AVISO
  const dias = Math.ceil((fin.getTime() - ahora.getTime()) / 86_400_000)
  // Un solo día de solape no merece un aviso: el texto asustaría más que el importe, y el día que
  // se contrata suele ser el mismo en que caduca lo anterior.
  if (dias <= 1) return SIN_AVISO
  const fecha = fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    solapa: true,
    dias,
    texto:
      `Tu suscripción actual sigue activa hasta el ${fecha}. Si contratas ahora, se solaparán ` +
      `(pagarías las dos durante ${dias} días). Puedes esperar a esa fecha: tu precio te espera igual.`,
  }
}
