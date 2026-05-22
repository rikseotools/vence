/**
 * Helpers de concurrencia para el cron check-seguimiento.
 * Portado verbatim de `lib/api/seguimiento-convocatorias/concurrency.ts` —
 * sin cambios de lógica; solo funciones puras, sin dependencias externas.
 */

/** Agrupa items por dominio extraído de una URL. */
export function groupByDomain<T>(items: T[], getUrl: (item: T) => string): T[][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    let domain: string;
    try {
      domain = new URL(getUrl(item)).hostname;
    } catch {
      domain = 'unknown';
    }
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain)!.push(item);
  }
  return Array.from(map.values());
}

/**
 * Procesa items en paralelo con concurrency limit. No depende de p-limit.
 * Si un worker lanza, otros workers continúan (un fallo aislado no aborta
 * el batch entero).
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try {
        await worker(items[i]);
      } catch (err) {
        console.error('[runWithConcurrency] worker exception:', (err as Error).message);
      }
    }
  });
  await Promise.all(workers);
}
