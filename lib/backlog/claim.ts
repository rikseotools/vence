// lib/backlog/claim.ts — lógica PURA del claim del backlog (sin BD, testeable directa).
//
// Vive aparte del CLI (scripts/backlog.cjs) para que los tests importen la función REAL
// de producción y no una copia (una copia da falso verde cuando el original cambia).
//
// Contrato con la BD: la tabla `backlog_tasks` guarda el estado; el markdown
// `docs/roadmap/tareas-pendientes.md` guarda el contenido. El join es el id `T-xxx`.

export type BacklogPriority = 'critica' | 'alta' | 'media' | 'baja'
export type BacklogStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'dropped'

export interface BacklogTask {
  id: string
  title: string
  priority: BacklogPriority
  status: BacklogStatus
  claimed_by: string | null
  lease_until: string | Date | null
  blocked_by?: string[]
  /** Hasta cuándo NO tiene sentido cogerla (espera a un reloj externo). Vence sola. */
  snooze_until?: string | Date | null
  snooze_reason?: string | null
  /** Cuántas veces se ha aplazado (aplazar en bucle es no decidir). */
  snooze_count?: number | null
  /** Al pausar: qué quedó HECHO. */
  progress_note?: string | null
  /** Al pausar: qué hay que VERIFICAR al despertar. */
  resume_check?: string | null
}

/** Estados en los que la tarea sigue viva (aparece en el pool y en "Abiertas"). */
export const OPEN_STATUSES: readonly BacklogStatus[] = ['open', 'in_progress', 'blocked']
export const CLOSED_STATUSES: readonly BacklogStatus[] = ['done', 'dropped']

/** Orden de ataque. Menor = antes. */
const PRIORITY_RANK: Record<BacklogPriority, number> = { critica: 0, alta: 1, media: 2, baja: 3 }

export const PRIORITY_EMOJI: Record<BacklogPriority, string> = {
  critica: '🔴', alta: '🟠', media: '🟡', baja: '🟢',
}
const EMOJI_TO_PRIORITY: Record<string, BacklogPriority> = {
  '🔴': 'critica', '🟠': 'alta', '🟡': 'media', '🟢': 'baja',
}

/**
 * ¿Puede `sid` coger esta tarea?
 *
 * LEASE, NO LOCK: una tarea cogida por una sesión MUERTA debe volver al pool, o el
 * backlog se bloquea solo. Pero una tarea legítima de 6h no debe robarse mientras la
 * sesión siga dando señales (heartbeat renueva `lease_until`).
 *
 * Libre si: nadie la tiene · la tienes tú (re-claim idempotente) · el lease caducó.
 * Nunca si está cerrada (done/dropped) o bloqueada por otra tarea abierta.
 */
export function isClaimable(task: BacklogTask, sid: string, now: Date = new Date()): boolean {
  if (CLOSED_STATUSES.includes(task.status)) return false
  if (task.claimed_by === sid) return true
  if (task.claimed_by == null) return true
  const lease = task.lease_until == null ? null : new Date(task.lease_until)
  return lease != null && lease.getTime() < now.getTime()
}

/** Motivo legible de por qué NO es reclamable (para que el CLI no diga solo "no"). */
export function claimBlockedReason(task: BacklogTask, sid: string, now: Date = new Date()): string | null {
  if (isClaimable(task, sid, now)) return null
  if (CLOSED_STATUSES.includes(task.status)) return `ya está cerrada (${task.status})`
  const lease = task.lease_until == null ? null : new Date(task.lease_until)
  const mins = lease ? Math.max(0, Math.round((lease.getTime() - now.getTime()) / 60000)) : 0
  return `la tiene ${String(task.claimed_by).slice(0, 12)} (lease vivo, ${mins} min)`
}

/**
 * ¿Está APLAZADA ahora mismo? (espera a un reloj: un cron que aún no ha corrido, una cosecha,
 * una fecha en la que toca medir).
 *
 * Es distinto del claim y de `blocked_by`: no la tiene nadie y no depende de otra tarea nuestra
 * — simplemente todavía no hay nada que hacer. Vence sola, como el lease: una tarea aplazada al
 * pasado está DESPIERTA, sin que nadie tenga que acordarse de despertarla.
 */
export function isSnoozed(task: BacklogTask, now: Date = new Date()): boolean {
  if (task.snooze_until == null) return false
  return new Date(task.snooze_until).getTime() > now.getTime()
}

/** Descripción del aplazamiento para el CLI (null si está despierta). */
export function snoozeInfo(
  task: BacklogTask,
  now: Date = new Date(),
): { until: Date; reason: string | null; minutos: number } | null {
  if (!isSnoozed(task, now)) return null
  const until = new Date(task.snooze_until as string | Date)
  return {
    until,
    reason: task.snooze_reason ?? null,
    minutos: Math.max(0, Math.round((until.getTime() - now.getTime()) / 60000)),
  }
}

// La PUERTA del claim (lease + reloj + dependencia) vive en `lib/backlog/claimGate.cjs`:
// la necesita el CLI, que es CommonJS, y una segunda implementación aquí sería una copia que
// se separa de la de producción al primer cambio. Aquí quedan los predicados sueltos que sí
// usan el parser y `pickNext`.

/** Orden de reparto: prioridad y, a igualdad, id (estable y determinista). */
export function sortByAttackOrder(tasks: BacklogTask[]): BacklogTask[] {
  return [...tasks].sort((a, b) =>
    (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || a.id.localeCompare(b.id))
}

/**
 * Siguiente tarea reclamable respetando prioridad, dependencias y aplazamientos.
 *
 * Las APLAZADAS se saltan aquí (no en `isClaimable`) a propósito: sugerir es un acto de reparto
 * —nunca ofrezcas trabajo que hoy no se puede hacer— pero coger sigue siendo decisión de quien
 * la coge, que puede querer adelantar la preparación.
 */
export function pickNext(tasks: BacklogTask[], sid: string, now: Date = new Date()): BacklogTask | null {
  const openIds = new Set(tasks.filter(t => OPEN_STATUSES.includes(t.status)).map(t => t.id))
  const libres = sortByAttackOrder(tasks).filter(t =>
    isClaimable(t, sid, now) &&
    !isSnoozed(t, now) &&
    !(t.blocked_by || []).some(dep => openIds.has(dep)))  // bloqueada por otra viva
  return libres[0] ?? null
}

// ────────────────────────────────────────────────────────────────────────────
// Parseo del markdown — la otra mitad del contrato
// ────────────────────────────────────────────────────────────────────────────

export interface MarkdownTask {
  id: string
  title: string
  priority: BacklogPriority | null
  /** true si la cabecera está bajo la sección "## Abiertas". */
  inOpenSection: boolean
  /** true si la cabecera lleva ✅ (convención del fichero para "ya hecha"). */
  doneMarked: boolean
  /**
   * true si la cabecera lleva ⬜ = APARCADA a propósito (p.ej. por tamaño/coste):
   * sigue viva y con contexto, pero deliberadamente fuera del orden de ataque.
   * Es un estado legítimo distinto de "se me olvidó ponerle prioridad", por eso
   * el guardarraíl la exime de declarar 🔴/🟠/🟡/🟢 (si no, obligaría a inventar
   * una prioridad falsa para algo que se decidió NO priorizar).
   */
  parked: boolean
}

/**
 * Extrae las tareas de `tareas-pendientes.md`.
 * Formato de cabecera esperado: `### [T-042] 🔴 Título…`
 * (el emoji de prioridad puede ir antes o después del id; se acepta cualquiera de los dos).
 */
export function parseBacklogMarkdown(md: string): MarkdownTask[] {
  const out: MarkdownTask[] = []
  let inOpen = false
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.*)$/.exec(line)
    if (h2) { inOpen = /abiertas/i.test(h2[1]); continue }
    const h3 = /^###\s+(.*)$/.exec(line)
    if (!h3) continue
    const rest = h3[1]
    const idM = /\[(T-\d+)\]/.exec(rest)
    if (!idM) continue                       // cabecera sin id → la caza el guardarraíl
    const emoji = Object.keys(EMOJI_TO_PRIORITY).find(e => rest.includes(e))
    const title = rest
      .replace(/\[(T-\d+)\]/, '')
      .replace(/[🔴🟠🟡🟢✅⬜]/g, '')
      .replace(/^\s*\[[^\]]*\]\s*/, '')      // etiquetas tipo [ABIERTO 19/07]
      .trim()
    out.push({
      id: idM[1],
      title,
      priority: emoji ? EMOJI_TO_PRIORITY[emoji] : null,
      inOpenSection: inOpen,
      doneMarked: rest.includes('✅'),
      parked: rest.includes('⬜'),
    })
  }
  return out
}

/**
 * Candados de fecha escritos en el TÍTULO — el síntoma de que el campo existe y no se usa.
 *
 * Casos reales el 29/07, un día después de que `snooze_until` existiera:
 *   · T-221 «⛔ NO COGER HASTA EL 29/07 07:00 UTC (esperando la cosecha del cron) — …»
 *   · T-234 «⏱ MEDIR EL 11/08 — 873 usuarios estudian con una oposición que no existe»
 *
 * Un título no despierta solo: la fecha de T-221 venció y el título siguió diciendo "no coger",
 * así que la tarea quedó congelada por un texto. La fecha va en `snooze_until`, que vence sola.
 *
 * PRECISIÓN sobre recall, como el resto de detectores del repo: solo se marca el candado
 * IMPERATIVO («no coger hasta», «medir el 11/08»), nunca la fecha descriptiva («no completa una
 * ejecución desde el 24/07»), que es información legítima del título.
 */
const RE_CANDADO_FECHA: Array<{ nombre: string; re: RegExp }> = [
  { nombre: 'no coger/tocar', re: /\bno\s+(coger|tocar|empezar|atacar|abrir)\b/i },
  { nombre: 'esperar a', re: /\besperar\s+(a|al|hasta)\b/i },
  { nombre: 'imperativo + fecha', re: /\b(medir|revisar|verificar|comprobar|releer|retomar)\s+(el|la)\s+\d{1,2}([/-]\d{1,2})/i },
  { nombre: 'hasta el <fecha>', re: /\bhasta\s+(el\s+)?\d{1,2}([/-]\d{1,2})/i },
  { nombre: 'emoji de candado/reloj', re: /[⛔⏱🕒]/ },
]

export interface DateLockedTitle {
  id: string
  title: string
  /** Qué patrón lo delató (para que el mensaje del guardarraíl sea accionable). */
  patron: string
}

/** Títulos que codifican un candado temporal en vez de usar `snooze_until`. */
export function findDateLockedTitles(tasks: Array<{ id: string; title: string }>): DateLockedTitle[] {
  const out: DateLockedTitle[] = []
  for (const t of tasks) {
    const hit = RE_CANDADO_FECHA.find(p => p.re.test(t.title))
    if (hit) out.push({ id: t.id, title: t.title, patron: hit.nombre })
  }
  return out
}

/** Cabeceras `###` SIN id — deben ser cero, o el join markdown↔BD se rompe en silencio. */
export function findHeadingsWithoutId(md: string): string[] {
  const out: string[] = []
  for (const line of md.split('\n')) {
    const h3 = /^###\s+(.*)$/.exec(line)
    if (h3 && !/\[(T-\d+)\]/.test(h3[1])) out.push(h3[1].trim())
  }
  return out
}

export interface BacklogDrift {
  /** En el markdown pero no en la tabla → nadie puede cogerla. */
  soloEnMarkdown: string[]
  /** En la tabla pero no en el markdown → tarea fantasma, sin contexto. */
  soloEnBd: string[]
  /** Cerrada en BD pero sigue listada como abierta en el markdown (el fallo del 20/07). */
  cerradaPeroAbiertaEnMarkdown: string[]
  /** Viva en BD pero movida a "Hechas" en el markdown. */
  vivaPeroCerradaEnMarkdown: string[]
}

/**
 * Compara markdown ↔ BD. Es el guardarraíl que convierte "la ficha está desfasada"
 * en un CI rojo. Nace del incidente del 20/07: la ficha del RD 176/2022 anunciaba
 * "9 mislinks EN VIVO" cuando ya estaban arreglados → una sesión perdió el tiempo.
 */
export function findBacklogDrift(mdTasks: MarkdownTask[], dbTasks: BacklogTask[]): BacklogDrift {
  const md = new Map(mdTasks.map(t => [t.id, t]))
  const db = new Map(dbTasks.map(t => [t.id, t]))
  const drift: BacklogDrift = {
    soloEnMarkdown: [], soloEnBd: [], cerradaPeroAbiertaEnMarkdown: [], vivaPeroCerradaEnMarkdown: [],
  }
  for (const [id] of md) if (!db.has(id)) drift.soloEnMarkdown.push(id)
  for (const [id] of db) if (!md.has(id)) drift.soloEnBd.push(id)
  for (const [id, m] of md) {
    const d = db.get(id)
    if (!d) continue
    const cerradaEnBd = CLOSED_STATUSES.includes(d.status)
    if (cerradaEnBd && m.inOpenSection) drift.cerradaPeroAbiertaEnMarkdown.push(id)
    if (!cerradaEnBd && !m.inOpenSection) drift.vivaPeroCerradaEnMarkdown.push(id)
  }
  return drift
}

/** Tareas `in_progress` con el lease caducado hace mucho: sesión zombi o cierre olvidado. */
export function findZombieClaims(tasks: BacklogTask[], now: Date = new Date(), horas = 24): BacklogTask[] {
  return tasks.filter(t =>
    t.status === 'in_progress' && t.lease_until != null &&
    new Date(t.lease_until).getTime() < now.getTime() - horas * 3600_000)
}
