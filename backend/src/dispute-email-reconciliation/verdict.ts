/**
 * Veredicto de la invariante "impugnación cerrada ⇒ email enviado (o salto legítimo)".
 *
 * Núcleo PURO (sin BD, sin red) para poder testear el criterio, que es donde estuvo el
 * defecto: hasta el 31/07/2026 la clasificación se hacía entera en SQL leyendo
 * `email_preferences.email_soporte_disabled` — una columna **mutable** — para juzgar un
 * envío que se decidió en el pasado.
 *
 * EL FALLO, medido (T-422): el 31/07 [T-373] restauró `email_soporte_disabled=false` a 79
 * usuarios a los que el botón de baja masiva se lo había apagado sin que lo pidieran. Las
 * impugnaciones que se les habían cerrado ANTES —correctamente saltadas, porque en ese
 * momento el soporte estaba apagado— se releyeron con la preferencia NUEVA y pasaron a
 * `real_drop`. La alerta `dispute_email_drop` disparó 7 veces por 3 impugnaciones de una
 * misma usuaria que ya estaban bien resueltas, y mandó a una sesión a "reenviar" correos
 * que no se habían perdido por avería.
 *
 * Y falla también en la dirección PELIGROSA, que es la que importa: si alguien apaga el
 * soporte DESPUÉS de un drop real, ese drop se reclasifica como salto esperado y la alerta
 * no salta nunca. Un criterio que se puede volver ciego por una escritura posterior no es
 * un criterio.
 *
 * REGLA: manda la EVIDENCIA del momento (`dispute_email_skipped`, que emite la propia ruta
 * de resolución al saltar), no el estado actual. Cuando no hay evidencia —impugnaciones
 * cerradas antes de que ese evento existiera— se dice explícitamente que se está
 * INFIRIENDO (`expected_skip_inferred`) en vez de afirmarlo: poder decir "no lo sé" es lo
 * que separa esta clasificación de la anterior. Ese contador debe tender a 0 según entran
 * cierres nuevos; si no baja, el emisor de evidencia no está llegando a producción.
 */

export type Veredicto =
  /** Hay fila en `email_events`: la respuesta salió. */
  | 'delivered'
  /** Se saltó a propósito y hay EVIDENCIA del momento (evento `dispute_email_skipped`). */
  | 'expected_skip'
  /** Sin evidencia, pero la preferencia ACTUAL explica el salto. Sospecha, no afirmación. */
  | 'expected_skip_inferred'
  /** El usuario no tiene email: no había a dónde enviarlo. */
  | 'no_user_email'
  /** Debía salir, no salió y nadie registró haberlo saltado → fallo silencioso REAL. */
  | 'real_drop';

export interface HechosReconciliacion {
  /** Email del usuario en `user_profiles` (null = no hay destinatario). */
  email: string | null;
  /** Valor ACTUAL de `email_preferences.email_soporte_disabled` (mutable: solo indicio). */
  soporteDisabled: boolean;
  /** ¿Hay fila en `email_events` para esta respuesta? */
  hasEmailEvent: boolean;
  /** ¿Hay evento `*_email_skipped` de esta respuesta? (evidencia del momento) */
  hasSkipEvent: boolean;
  /**
   * ¿Hay token de baja (`email_unsubscribe_tokens`) de esta respuesta?
   *
   * Es la SEGUNDA evidencia, y es del momento igual que la anterior: el token se inserta
   * DENTRO de `sendEmailV2`, **después** de que `canSendEmail` haya dejado pasar el envío.
   * Su presencia prueba que el envío superó el gate de preferencias; su ausencia, que se
   * cortó antes. No depende de releer ninguna columna mutable.
   *
   * Medido el 03/08/2026 sobre 90 días de respuestas a feedback: **489 de 489** de las que
   * SÍ tienen email tienen también token (control limpio), y de las 43 sin email solo 1
   * tenía token — esa 1 es un drop real (`garciamoyanoraquel7179@`, 14/07: se le contestó
   * cómo evitar el siguiente cobro y el correo no salió). Sin este hecho ese caso queda
   * enterrado entre 42 saltos legítimos.
   *
   * Opcional: el reconciliador de impugnaciones no lo pasa todavía (su criterio se acaba de
   * verificar en producción y no se cambia en el mismo paso que estrena un consumidor
   * nuevo). Ver [T-501].
   */
  hasUnsubscribeToken?: boolean;
}

export function clasificarVerdicto(h: HechosReconciliacion): Veredicto {
  // 1. El email salió. Cualquier otra consideración sobra.
  if (h.hasEmailEvent) return 'delivered';

  // 2. EVIDENCIA del momento por encima de todo lo demás, incluido `email` y la preferencia
  //    actual: si la ruta de resolución registró que saltaba, sabemos qué pasó y por qué.
  if (h.hasSkipEvent) return 'expected_skip';

  // 3. La otra evidencia del momento, y en la dirección contraria: hubo token, así que el
  //    envío pasó el gate y se intentó de verdad. Que no haya fila en `email_events` es
  //    entonces una pérdida REAL, se diga lo que se diga la preferencia de hoy. Va ANTES de
  //    los dos indicios de abajo justamente por eso: es lo único que puede afirmar un drop
  //    sin depender de una columna que alguien puede reescribir después.
  if (h.hasUnsubscribeToken) return 'real_drop';

  // 4. Sin destinatario no hay envío posible (y no es un fallo nuestro de entrega).
  if (h.email === null || h.email === '') return 'no_user_email';

  // 5. Sin evidencia: la preferencia actual es lo ÚNICO que queda, y puede haber cambiado
  //    después. Se marca como inferido para no contarlo como certeza.
  if (h.soporteDisabled) return 'expected_skip_inferred';

  // 6. Debía salir y no hay ni email ni constancia de haberlo saltado.
  return 'real_drop';
}

/** Solo esto dispara la alerta: un fallo silencioso del que nadie dejó constancia. */
export function esDropReal(v: Veredicto): boolean {
  return v === 'real_drop';
}
