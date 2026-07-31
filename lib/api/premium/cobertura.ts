/**
 * Volver con tu precio SIN pagar dos veces. (T-363, 31/07/2026)
 *
 * ## El problema
 *
 * Quien vuelve con su precio heredado puede tener todavía **servicio pagado** en la cuenta antigua:
 * pagó su trimestre por adelantado y le quedan semanas. Si contrata hoy en la cuenta nueva empieza a
 * pagar desde hoy y **paga dos veces el mismo periodo**. Y no se puede prorratear entre cuentas: son
 * dos cuentas de Stripe distintas, sin clientes ni tarjetas compartidas, así que la nueva no tiene
 * nada que descontar.
 *
 * ## La solución: no cobrarle hasta que se le acabe lo que ya pagó
 *
 * La suscripción nueva se crea con `trial_end` en la fecha en que expira su cobertura anterior.
 * Contrata hoy, con su precio de siempre, y **la primera factura sale el día que le tocaba**. Sin
 * doble cobro, sin devoluciones y sin un solo día sin servicio. Es lo que hace cualquier producto al
 * mejorar de plan; aquí hay que calcularlo a mano porque el corte de cuenta impide el prorrateo.
 *
 * **El acceso no depende de esto:** el sistema ya cuenta `trialing` como premium — lo aceptan el
 * webhook (`VALID_STATUSES`), el validador del checkout y la comprobación de acceso.
 *
 * ## Se calcula en el CLIC, no al crear la oferta
 *
 * La oferta y su enlace se guardan y se reutilizan. Unos días calculados al crearla serían mentira
 * el día que se usen: quien tarde dos meses en decidirse tendría dos meses de regalo. El checkout se
 * crea al pagar, así que ahí el número es siempre el de ese día.
 */

export interface CoberturaPendiente {
  /** ¿Se puede aplazar el primer cobro? */
  aplica: boolean
  /** Timestamp UNIX para `trial_end` de Stripe (null si no aplica). */
  trialEnd: number | null
  /** Días de cobertura que le quedan. */
  dias: number
  /** Lo que se le dice antes de pagar. Vacío si no hay nada que decir. */
  texto: string
}

const NADA: CoberturaPendiente = { aplica: false, trialEnd: null, dias: 0, texto: '' }

/**
 * Stripe exige que `trial_end` esté **al menos 48 h en el futuro**. Por debajo no se puede aplazar —
 * y tampoco merece la pena: un solape de un día no justifica ni el aviso.
 */
const MINIMO_HORAS = 48

export function coberturaPendiente(
  vigenteHasta: Date | string | null | undefined,
  ahora: Date = new Date(),
): CoberturaPendiente {
  if (!vigenteHasta) return NADA
  const fin = vigenteHasta instanceof Date ? vigenteHasta : new Date(vigenteHasta)
  if (isNaN(fin.getTime())) return NADA
  const horas = (fin.getTime() - ahora.getTime()) / 3_600_000
  if (horas < MINIMO_HORAS) return NADA
  const dias = Math.ceil(horas / 24)
  const fecha = fin.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    aplica: true,
    trialEnd: Math.floor(fin.getTime() / 1000),
    dias,
    texto:
      `Tu suscripción actual está pagada hasta el ${fecha}, así que no se te cobrará nada hasta ` +
      `entonces: el primer cobro será ese día, con tu precio de siempre.`,
  }
}
