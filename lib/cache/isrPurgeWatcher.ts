// lib/cache/isrPurgeWatcher.ts
//
// Daemon por instancia que aplica LOCALMENTE las purgas de ISR que otras
// instancias registraron en el KV compartido (lib/cache/isrPurgeLog).
//
// Con esto, `POST /api/purge-cache` deja de ser per-instancia: la instancia que
// atiende purga en el acto y deja constancia; el resto lo ven en ≤ un intervalo de
// sondeo y se purgan solas. Ya no hace falta repetir el POST 15-20 veces
// confiando en el reparto del ALB.
//
// DÓNDE VIVE: lo arranca `instrumentation.ts` en `register()`, igual que el
// sampler de event-loop lag — el frontend corre como contenedor Fargate de larga
// vida, así que `register()` se ejecuta una vez por instancia y el `setInterval`
// persiste como daemon. Solo en el runtime Node (el Edge no tiene este ciclo de
// vida) y nunca durante `next build`.
//
// POR QUÉ VÍA HTTP A SÍ MISMO: `revalidatePath()` necesita el contexto de request
// de Next; desde el callback de un timer no hay tal contexto. El observador hace un
// POST a `127.0.0.1:$PORT/api/internal/isr-apply` — su propio proceso — y es ese
// route handler quien purga. La llamada no sale del contenedor.
//
// SEGURIDAD DE BUCLE: el endpoint interno purga y NO registra. Si registrase, la
// purga de una instancia provocaría la de las demás, y así indefinidamente.
//
// FORMA DEL MÓDULO: el observador es una FACTORÍA con su propio snapshot, no un
// singleton con estado de módulo. Así la simulación puede levantar N observadores
// independientes sobre un mismo KV — que es justo el escenario que falla en
// producción — en vez de comprobar uno solo y suponer el resto.

import { diffIsrPurgeLog, readIsrPurgeLog, type IsrPurgeSnapshot } from '@/lib/cache/isrPurgeLog'
import { emitFireAndForget } from '@/lib/observability/emit'

/** Sondeo por defecto. Un HGETALL de unos cientos de campos cada 10 s por instancia es ruido. */
const DEFAULT_POLL_MS = 10_000

/** Tope de rutas aplicadas por ciclo: un pico de purgas no debe volverse un pico de recomputación. */
export const MAX_PATHS_POR_CICLO = 50

export interface IsrPurgeObserverDeps {
  /** Lee el registro compartido. `null` = no se pudo leer (≠ leído y vacío). */
  read?: () => Promise<IsrPurgeSnapshot | null>
  /** Aplica las rutas en ESTA instancia. Devuelve cuántas revalidó. */
  apply?: (paths: string[]) => Promise<number>
}

export interface IsrPurgeObserver {
  /** Un ciclo completo: leer → diff → aplicar aquí. */
  cycle: () => Promise<{ aplicadas: number; pendientes: string[] }>
  /** Snapshot visto por esta instancia (introspección en tests/simulación). */
  snapshot: () => IsrPurgeSnapshot | null
}

/** Pide a ESTA instancia que revalide las rutas, vía loopback. */
async function aplicarPorLoopback(paths: string[]): Promise<number> {
  const secret = process.env.CRON_SECRET
  if (!secret) return 0
  const port = process.env.PORT || '3000'
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/internal/isr-apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: JSON.stringify({ paths }),
    })
    if (!res.ok) return 0
    const json = (await res.json()) as { revalidated?: string[] }
    return json?.revalidated?.length ?? 0
  } catch {
    return 0
  }
}

/**
 * Crea un observador con su propio snapshot. Cada instancia (proceso) tiene el
 * suyo; comparten únicamente el registro del KV.
 */
export function createIsrPurgeObserver(deps: IsrPurgeObserverDeps = {}): IsrPurgeObserver {
  const read = deps.read ?? readIsrPurgeLog
  const apply = deps.apply ?? aplicarPorLoopback
  let visto: IsrPurgeSnapshot | null = null

  return {
    snapshot: () => visto,
    async cycle() {
      const actual = await read()
      // No se pudo leer (KV caído/apagado): NO tocar el snapshot. Si lo pisáramos
      // con null, la siguiente lectura buena se tomaría por baseline y perderíamos
      // las purgas ocurridas durante el apagón.
      if (actual === null) return { aplicadas: 0, pendientes: [] }

      const pendientes = diffIsrPurgeLog(visto, actual)
      // El snapshot avanza SIEMPRE que se pudo leer, aunque aplicar falle:
      // reintentar en bucle una ruta que el endpoint rechaza dejaría el daemon
      // atascado. Una purga perdida se recupera con la siguiente de esa ruta.
      visto = actual
      if (!pendientes.length) return { aplicadas: 0, pendientes: [] }

      const lote = pendientes.slice(0, MAX_PATHS_POR_CICLO)
      const aplicadas = await apply(lote)
      if (aplicadas > 0) {
        console.log(`♻️ [isr-purge] ${aplicadas} ruta(s) revalidadas en esta instancia: ${lote.join(', ')}`)
      }

      // OBSERVABILIDAD: con esto se puede comprobar en `observable_events` que una
      // purga llegó a TODAS las tasks (una fila por instancia) en vez de suponerlo
      // — y ver enseguida cuál se quedó fuera. Un daemon que dejara de aplicar en
      // silencio devolvería el sistema al fallo per-instancia sin señal ninguna.
      // Solo se emite cuando hay trabajo: los ciclos vacíos (el 99%) no escriben.
      void emitFireAndForget({
        source: 'vercel',
        severity: aplicadas > 0 ? 'info' : 'warn',
        eventType: 'isr_purge_applied',
        endpoint: '/api/internal/isr-apply',
        errorMessage: aplicadas > 0 ? undefined : `esta instancia no pudo aplicar ${lote.length} ruta(s)`,
        metadata: {
          instance: `${process.env.HOSTNAME || 'local'}#${process.pid}`,
          aplicadas,
          paths: lote.slice(0, 10),
          pendientesTotales: pendientes.length,
        },
      })
      return { aplicadas, pendientes: lote }
    },
  }
}

let timer: ReturnType<typeof setInterval> | null = null
let observador: IsrPurgeObserver | null = null

function habilitado(): boolean {
  // Rollback instantáneo por env, misma semántica que REDIS_CACHE_ENABLED=false.
  return process.env.ISR_PURGE_WATCHER_ENABLED !== 'false'
}

function intervaloMs(): number {
  const raw = Number(process.env.ISR_PURGE_WATCHER_POLL_MS)
  return Number.isFinite(raw) && raw >= 1_000 ? raw : DEFAULT_POLL_MS
}

/** Un ciclo del observador del proceso (lo usa el daemon; expuesto para el canary). */
export async function runIsrPurgeCycle(): Promise<{ aplicadas: number; pendientes: string[] }> {
  if (!observador) observador = createIsrPurgeObserver()
  return observador.cycle()
}

/** Arranca el daemon (idempotente por proceso). No-op si está deshabilitado por env. */
export function startIsrPurgeWatcher(): void {
  if (!habilitado() || timer) return
  timer = setInterval(() => {
    void runIsrPurgeCycle().catch(() => {
      // Un ciclo fallido nunca tumba el daemon ni el proceso.
    })
  }, intervaloMs())
  // No retener el event loop por este timer (permite un apagado limpio del contenedor).
  timer.unref?.()
}

/** Solo para tests: para el daemon y olvida el observador del proceso. */
export function _resetIsrPurgeWatcherForTests(): void {
  if (timer) clearInterval(timer)
  timer = null
  observador = null
}
