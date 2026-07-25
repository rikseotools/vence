/**
 * CAPA 5 (guardarraíl de contrato) — el cableado de la purga ISR cross-instancia.
 *
 * Los tests de las capas 1 y 3 verifican la LÓGICA, pero pasarían igual de verdes
 * con el daemon desconectado de `instrumentation.ts` o con el endpoint público sin
 * registrar: el mecanismo quedaría inerte en producción y nadie se enteraría hasta
 * el siguiente "purgué y sigue saliendo lo viejo". Esto lo lee del código fuente,
 * sin red ni BD, y corre en CI.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8')

describe('GUARDARRAÍL — el daemon de purga ISR está enchufado', () => {
  it('instrumentation.ts LLAMA al watcher (no solo lo importa) en el runtime Node', () => {
    const src = leer('instrumentation.ts')
    expect(src).toContain('@/lib/cache/isrPurgeWatcher')

    // Validado por mutación (26/07): la primera versión de este test hacía
    // `toContain('startIsrPurgeWatcher')` y pasaba en VERDE con la llamada
    // COMENTADA — el daemon habría quedado muerto en producción sin que nadie se
    // enterase. Hay que exigir una llamada VIVA, no la mera aparición del nombre.
    const lineaViva = src
      .split('\n')
      .find((l) => /(^|[^/])\bstartIsrPurgeWatcher\s*\(\s*\)/.test(l) && !l.trim().startsWith('//'))
    expect(lineaViva).toBeDefined()

    // Y dentro de la guarda de runtime: en Edge no hay daemon que valga.
    const idxGuarda = src.indexOf("NEXT_RUNTIME === 'nodejs'")
    expect(idxGuarda).toBeGreaterThan(-1)
    expect(src.indexOf(lineaViva!)).toBeGreaterThan(idxGuarda)
  })

  it('el endpoint PÚBLICO de purga deja constancia para las demás instancias', () => {
    const src = leer('app/api/purge-cache/route.ts')
    expect(src).toContain('recordIsrPurge')
    expect(src).toContain('revalidatePath') // sigue purgando la instancia que atiende
  })

  it('ANTI-BUCLE: el endpoint INTERNO purga pero NO registra', () => {
    // Si el endpoint interno registrase, cada purga aplicada dispararía otra ronda
    // en toda la flota, indefinidamente. Es la invariante más peligrosa del diseño.
    const src = leer('app/api/internal/isr-apply/route.ts')
    expect(src).toContain('revalidatePath')
    expect(src).not.toContain('recordIsrPurge')
  })

  it('el endpoint interno exige el secreto de operaciones', () => {
    const src = leer('app/api/internal/isr-apply/route.ts')
    expect(src).toContain('x-cron-secret')
    expect(src).toContain('CRON_SECRET')
  })

  it('el registro y el observador usan la MISMA clave del KV', () => {
    // Un cambio de nombre en un lado dejaría a los escritores hablando solos.
    const log = leer('lib/cache/isrPurgeLog.ts')
    expect(log).toContain("ISR_PURGE_LOG_KEY = 'isr_purge_log'")
    const watcher = leer('lib/cache/isrPurgeWatcher.ts')
    expect(watcher).toContain("from '@/lib/cache/isrPurgeLog'")
  })

  it('el watcher tiene apagado por env (rollback instantáneo sin redeploy)', () => {
    const src = leer('lib/cache/isrPurgeWatcher.ts')
    expect(src).toContain('ISR_PURGE_WATCHER_ENABLED')
  })

  it('OBSERVABILIDAD: ambos planos emiten a observable_events', () => {
    // El fallo a vigilar es SILENCIOSO: la purga responde 200 y degrada a
    // per-instancia. Sin estos eventos no hay forma de saber que pasó salvo que
    // lo reporte un usuario — justo lo que la observabilidad debe evitar.
    const publico = leer('app/api/purge-cache/route.ts')
    expect(publico).toContain('isr_purge_broadcast')
    expect(publico).toContain("severity: broadcast.length ? 'info' : 'warn'")

    const watcher = leer('lib/cache/isrPurgeWatcher.ts')
    expect(watcher).toContain('isr_purge_applied')
    expect(watcher).toContain('instance') // sin el id de instancia no se sabe QUIÉN falló
  })
})
