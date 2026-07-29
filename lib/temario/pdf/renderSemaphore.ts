// lib/temario/pdf/renderSemaphore.ts — Fase 1 de T-270: contención del render en línea.
//
// ## Por qué (incidente 29/07/2026, 09:30-09:48 UTC)
//
// La ruta del PDF del temario renderiza con @react-pdf + pdf-lib EN EL PROCESO QUE SIRVE
// TRÁFICO. Node es monohilo: cada render bloquea el bucle de eventos entero. Medido con la
// instrumentación de la Fase 1a: **un solo PDF cuesta 7,2 s de CPU** (`renderMs: 7195`).
//
// Ese día llegaron 51 peticiones en 18 minutos (36 renders frescos). El resultado no fue «los
// PDFs tardan»: fue **5 instancias con el bucle bloqueado hasta 215 s**, `/api/v2/answer-and-save`
// a p95 de 25 s —por encima del corte de 15 s del cliente—, **59 respuestas de usuarios sin
// guardar** y 207 errores 5xx repartidos por TODA la aplicación. El tráfico era plano: no fue
// carga de usuarios, fue una ráfaga de PDFs.
//
// ## Qué hace esto, y qué NO
//
// Limita cuántos renders FRESCOS puede tener EN VUELO una task. No acelera nada: convierte
// «el sitio se degrada 18 minutos» en «algunos PDFs tardan o piden reintento». Es la Fase 1 del
// plan: la Fase 2 saca el render del camino servido (encolar + servir de S3), y entonces esto
// sobra.
//
// ## Por qué el límite por defecto es 1
//
// Porque Node es monohilo y dos renders simultáneos NO van en paralelo: se entrelazan y duplican
// la ventana en la que todos los demás usuarios esperan. Permitir 2 no da el doble de PDFs: da el
// doble de tiempo bloqueado. El valor es configurable (`PDF_MAX_CONCURRENT_RENDERS`) por si la
// Fase 2 tarda y hace falta afinar, pero subirlo es empeorar el incidente a propósito.
//
// ## Esperar antes de rechazar
//
// Rechazar a la primera convertiría cualquier segundo clic en un error. Se espera un rato
// acotado (`PDF_RENDER_WAIT_MS`, 20 s) a que la task se libere: con renders de ~7 s, una ráfaga
// moderada acaba sirviéndose entera, solo que en fila. Pasado ese tiempo se **suelta carga** —que
// es lo que no pasó el 29/07, y por eso se cayó todo lo demás.

export interface RenderSlot {
  /** Devuelve el slot. Idempotente: llamarlo dos veces no resta de más. */
  release(): void
}

export interface RenderSemaphore {
  /** Intenta coger un slot AHORA, sin esperar. null si no hay. */
  tryAcquire(): RenderSlot | null
  /** Espera hasta `timeoutMs` a que haya slot. null si se agota la espera. */
  acquire(timeoutMs: number): Promise<RenderSlot | null>
  /** Renders en vuelo ahora mismo (observabilidad). */
  inFlight(): number
  /** Techo configurado. */
  max(): number
}

export interface SemaphoreOptions {
  /** Inyectable en tests: por defecto, un sleep real. */
  sleep?: (ms: number) => Promise<void>
  /** Inyectable en tests: por defecto, Date.now. */
  now?: () => number
  /** Cada cuánto se reintenta mientras se espera. */
  pollMs?: number
}

export function createRenderSemaphore(maxConcurrent: number, opts: SemaphoreOptions = {}): RenderSemaphore {
  const max = Math.max(1, Math.floor(maxConcurrent))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  const now = opts.now ?? (() => Date.now())
  const pollMs = opts.pollMs ?? 250
  let enCurso = 0

  const nuevoSlot = (): RenderSlot => {
    let devuelto = false
    return {
      release() {
        // Idempotente a propósito: el `finally` del llamante puede coincidir con un camino de
        // error que ya lo soltó, y un contador que baja de más deja la puerta abierta para siempre.
        if (devuelto) return
        devuelto = true
        enCurso = Math.max(0, enCurso - 1)
      },
    }
  }

  return {
    tryAcquire() {
      if (enCurso >= max) return null
      enCurso++
      return nuevoSlot()
    },
    async acquire(timeoutMs: number) {
      const limite = now() + Math.max(0, timeoutMs)
      for (;;) {
        if (enCurso < max) {
          enCurso++
          return nuevoSlot()
        }
        if (now() >= limite) return null
        await sleep(pollMs)
      }
    },
    inFlight: () => enCurso,
    max: () => max,
  }
}

/** Techo de renders simultáneos por task. Ver arriba por qué el defecto es 1. */
export function maxConcurrentFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PDF_MAX_CONCURRENT_RENDERS)
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1
}

/** Cuánto se espera a que se libere un slot antes de soltar carga. */
export function waitMsFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.PDF_RENDER_WAIT_MS)
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 20_000
}

/**
 * Semáforo del proceso. Vive en el módulo a propósito: el límite es POR TASK, que es justo la
 * unidad que se bloquea (un contenedor = un bucle de eventos). Un límite global compartido entre
 * tasks necesitaría coordinación externa y no arreglaría el bloqueo local, que es el daño real.
 */
let singleton: RenderSemaphore | null = null
export function getRenderSemaphore(): RenderSemaphore {
  if (!singleton) singleton = createRenderSemaphore(maxConcurrentFromEnv())
  return singleton
}

/** Solo para tests: reinicia el semáforo del proceso. */
export function __resetRenderSemaphore(): void {
  singleton = null
}
