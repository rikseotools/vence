// lib/auth/canonicalSub.ts
// El `sub` que se acuña DEBE existir en `user_profiles`. Si no, se reconcilia por email.
//
// EL FALLO QUE CIERRA (28/07/2026): un usuario llegó con una sesión cuyo `sub`
// (`0f8e35ae…`) no tenía fila en `user_profiles`, mientras su email SÍ tenía perfil con
// otro id (`8330df66…`, premium). Como `/api/stripe/create-checkout`, `/api/stripe/subscription`
// y `/api/feedback` se indexan por ese id, le rebotó TODO:
//   · 24 intentos de compra → «User not found in database»
//   · 6 avisos a soporte    → 500 (violación de FK contra user_profiles)
// Y el estado no se cura navegando: el id viaja dentro de la sesión. Medido en
// `observable_events`: 8 usuarios y 70 checkouts rechazados por esta causa desde el 07/07.
//
// El agravante que lo hacía invisible: el usuario roto TAMPOCO puede quejarse, porque el
// formulario de soporte falla por el mismo motivo. El fallo se oculta a sí mismo.
//
// POR QUÉ AQUÍ: `/api/auth/token` es el único punto donde se decide la identidad
// (`docs/roadmap/fase-b-ejecucion-authjs-rs256.md`). Reconciliar aquí cura a TODOS los
// afectados en su siguiente tick de sesión —sin re-login, sin tocar la BD, sin pasar por
// los endpoints de pago—, en vez de parchear endpoint por endpoint.
//
// SEGURIDAD: el email viene de la sesión/token YA VERIFICADO, nunca del input crudo, y
// `user_profiles.email` es UNIQUE — el mismo criterio (y la misma garantía) que usa
// `resolveAppUserId` en el primer login. Si el email no resuelve, NO se inventa un id:
// se acuña con el `sub` original y se emite la señal.

/** Qué hacer con el `sub` de una sesión, según lo que exista en BD. PURA. */
export type DecisionSub = {
  /** El `sub` que debe llevar el token acuñado. */
  sub: string
  /** true si hubo que cambiarlo (el original no tenía perfil). Se emite señal. */
  reconciliado: boolean
  /**
   * true si el `sub` no tiene perfil Y el email tampoco resuelve: el usuario está roto
   * y no podemos arreglarlo aquí. Se acuña igual (no romper la sesión) pero se emite
   * `error` para que deje de ser invisible.
   */
  huerfano: boolean
}

/**
 * @param subToken     `sub` que trae la sesión verificada
 * @param subExiste    ¿hay fila en user_profiles con ese id?
 * @param idPorEmail   id del perfil que tiene ese email (o null si no hay/no se buscó)
 */
export function decidirSub(
  subToken: string,
  subExiste: boolean,
  idPorEmail: string | null,
): DecisionSub {
  // Caso normal (>99,9%): el sub existe. No se toca nada y no se paga ni una consulta más.
  if (subExiste) return { sub: subToken, reconciliado: false, huerfano: false }

  // El sub no existe pero el email sí tiene perfil → esa es la identidad canónica.
  if (idPorEmail && idPorEmail !== subToken) {
    return { sub: idPorEmail, reconciliado: true, huerfano: false }
  }

  // Ni sub ni email resuelven: NO inventamos identidad. Se acuña con el original para no
  // tumbar la sesión, pero queda registrado como huérfano.
  return { sub: subToken, reconciliado: false, huerfano: true }
}
