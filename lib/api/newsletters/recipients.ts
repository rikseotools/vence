// lib/api/newsletters/recipients.ts
//
// Núcleo PURO del filtro de destinatarios de newsletter (T-457).
//
// POR QUÉ EXISTE. La newsletter tenía DOS vías de envío y solo una filtraba:
// por audiencia excluía `unsubscribed_all` y `email_newsletter_disabled`; por
// selección MANUAL (`selectedUserIds`) solo comprobaba que tuvieran email. El
// filtro no estaba en el punto de escritura, sino en una de las dos puertas —
// y dos puertas al mismo recurso con criterios distintos no protegen (T-130).
//
// Aquí vive el criterio, sin tocar BD, para que las dos vías lo compartan y
// para poder testearlo sin levantar nada. Quien consulte la BD trae las filas;
// quién puede recibir se decide SIEMPRE aquí.
//
// Y el filtro va en el ENVÍO, no en las pantallas que alimentan la selección:
// una lista de destinatarios que llega ya filtrada sigue pudiendo envejecer
// entre que se construye y se pulsa "enviar".

/** Fila de `email_preferences` en lo que respecta a newsletters. */
export interface NewsletterPreference {
  userId: string
  unsubscribedAll?: boolean | null
  emailNewsletterDisabled?: boolean | null
}

/** Candidato a recibir, tal y como sale de `user_profiles`. */
export interface RecipientCandidate {
  id: string
  email: string | null
  fullName?: string | null
  targetOposicion?: string | null
}

export interface FilterResult<T extends RecipientCandidate> {
  /** Los que SÍ pueden recibir. */
  recipients: T[]
  /** Descartados por haberse dado de baja o desactivar newsletters. */
  skippedBlocked: number
  /** Descartados por no tener email (no es una preferencia, es un dato que falta). */
  skippedNoEmail: number
}

/**
 * EL criterio. Dos preferencias distintas bloquean una newsletter:
 *  · `unsubscribedAll` — no quiere recibir NADA nuestro.
 *  · `emailNewsletterDisabled` — quiere lo transaccional pero no la newsletter.
 * Ausente o `null` = nunca lo pidió = puede recibir.
 */
export function isBlockedForNewsletter(pref: NewsletterPreference | undefined | null): boolean {
  if (!pref) return false
  return pref.unsubscribedAll === true || pref.emailNewsletterDisabled === true
}

/** Conjunto de ids bloqueados a partir de las filas de preferencias. */
export function blockedUserIds(prefs: readonly NewsletterPreference[]): Set<string> {
  const blocked = new Set<string>()
  for (const p of prefs) {
    if (isBlockedForNewsletter(p)) blocked.add(p.userId)
  }
  return blocked
}

/**
 * Deja pasar solo a quien puede recibir, y CUENTA lo que descarta: un envío
 * manual del que desaparecen 12 destinatarios en silencio es indistinguible de
 * uno que salió entero.
 */
export function filterEligibleRecipients<T extends RecipientCandidate>(
  candidates: readonly T[],
  blocked: ReadonlySet<string>
): FilterResult<T> {
  const recipients: T[] = []
  let skippedBlocked = 0
  let skippedNoEmail = 0

  for (const c of candidates) {
    if (!c.email) { skippedNoEmail++; continue }
    if (blocked.has(c.id)) { skippedBlocked++; continue }
    recipients.push(c)
  }

  return { recipients, skippedBlocked, skippedNoEmail }
}
