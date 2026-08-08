// lib/api/premium/campanaSinEnvios.ts — «había a quién avisar y no salió ninguno». [T-448]
//
// El punto ciego que cubre: un cron que responde 2xx **parece** que fue bien. Si la consulta se
// rompe, el dedup se pasa de listo o el proveedor de correo está caído, la campaña tica en verde
// y no sale un solo aviso — y no hay señal de nada. El heartbeat tampoco lo ve, porque el cron SÍ
// disparó.
//
// Por qué vive aquí y no suelto en el handler: en `/api/cron/renewal-reminders` corren DOS
// campañas hermanas (recordatorio de cobro y aviso de fin de suscripción) y solo la primera
// estaba protegida. La segunda avisa a quien va a **perder su precio antiguo**, que es más caro
// de fallar, y sus resultados solo iban a `console.log`. Con el criterio en un sitio, cubrir una
// campaña nueva es pasarle sus números — no acordarse de copiar un `if`.

export interface ResultadoCampanaEnvios {
  /** A cuántas personas HABÍA que avisar. */
  total: number
  /** A cuántas se avisó de verdad. */
  sent: number
  skipped?: number
  failed?: number
}

/**
 * ¿Hay que dar la voz de alarma? Solo cuando había destinatarios y no salió NINGUNO.
 *
 * `total === 0` NO es alarma: es el caso normal la mayoría de los días («hoy no vencía nadie»).
 * Confundir los dos es el error de [T-613] al revés — allí un cero se leyó como «nada que hacer»
 * cuando era «no hice nada»; aquí hay que distinguirlos por el denominador.
 */
export function campanaNoEnvioNada(r: ResultadoCampanaEnvios): boolean {
  return Number(r.total) > 0 && Number(r.sent) === 0
}

/** Mensaje con los números que hacen falta para diagnosticar sin abrir otra consulta. */
export function mensajeSinEnvios(campana: string, r: ResultadoCampanaEnvios): string {
  return (
    `[${campana}] ${r.total} destinatario(s) y 0 avisos enviados ` +
    `(omitidos:${r.skipped ?? 0}, fallidos:${r.failed ?? 0})`
  )
}
