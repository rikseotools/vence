/**
 * Decisión pura de Pass-1: ¿el HECHO (fecha) respalda todavía lo que dice el `status`? (T-295)
 *
 * ## El agujero que esto cierra
 *
 * Pass-1 concedía premium mirando SOLO `user_subscriptions.status IN ('active','trialing',
 * 'past_due')`, ignorando que la propia fila YA trae `current_period_end` — el hecho que dice
 * hasta cuándo era cierto ese status. El caso que destapó [T-295] (29/07/2026): un cliente
 * canceló el 26/05, Stripe cerró la sub el 27/05 al acabar el periodo pagado, el webhook que
 * debía reflejarlo en BD se perdió (incidente del 26-27/05) y la fila se quedó **congelada**
 * en `status='active'` con `current_period_end` apuntando al 27/05 — cada vez más viejo.
 *
 * Pass-1 leía esa fila cada hora, veía `status='active'`, y volvía a poner el perfil en
 * premium. **La propia reparación automática trabajaba a favor de la fuga** (así lo dice la
 * ficha: "el Pass-1 lo empeoraba"). Dos meses así. El dato para no hacerlo — la fecha — estaba
 * en la misma fila, seleccionado en la misma query, y nunca se miraba.
 *
 * ## La regla
 *
 * Si `current_period_end` existe y ya pasó, el status ya no es un hecho vigente por mucho que
 * el string siga diciendo `active` — no se concede. Si no hay fecha (fila sin ese dato) se
 * respeta el `status` tal cual: no hay hecho que lo contradiga, y negar premium por un campo
 * ausente sería inventar un motivo que no está en los datos.
 */
export function accesoVigentePorFecha(
  currentPeriodEnd: string | null | undefined,
  ahora: Date,
): boolean {
  if (!currentPeriodEnd) return true;
  const fin = new Date(currentPeriodEnd);
  if (Number.isNaN(fin.getTime())) return true;
  return fin.getTime() >= ahora.getTime();
}
