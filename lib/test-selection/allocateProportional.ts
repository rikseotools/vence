// lib/test-selection/allocateProportional.ts
//
// Asignador proporcional ÚNICO para la selección de preguntas de un test
// repartidas entre grupos (temas / leyes). Fuente de verdad compartida entre
// la capa API (`selectProportionally` en filtered-questions) y la capa fetcher
// (`buildAdaptiveCatalog` en testFetchers).
//
// CONTEXTO (bug 16/06/2026 — caso Laura): existían DOS implementaciones del
// mismo reparto. La de la API tenía relleno de déficit; la del catálogo
// adaptativo NO → al repartir 75 preguntas entre 16 temas, los temas que no
// llegaban a su cupo dejaban huecos que nadie compensaba → el test salía con
// 57 en vez de 75. Unificar en una función pura testeada elimina esa clase de
// bug por construcción (no puede volver a desincronizarse).
//
// INVARIANTE (contrato): devuelve SIEMPRE `min(target, nº de items agrupables)`.
// Nunca menos por artefactos del reparto. Si devuelve menos que `target`, es
// porque el pool realmente no tenía suficientes → `exhausted = true`.
//
// Función PURA: sin acceso a BD ni efectos. Acepta un `rng` inyectable para
// tests deterministas.

export interface AllocateOptions<T> {
  /** Clave de grupo (p.ej. número de tema, o "topic:5"). null/undefined → item ignorado. */
  groupKey: (item: T) => string | number | null | undefined
  /** Items "prioritarios" (p.ej. nunca-vistas): se eligen antes dentro de cada grupo y en el relleno. */
  isPriority?: (item: T) => boolean
  /** Generador aleatorio inyectable (para tests). Default: Math.random. */
  rng?: () => number
}

export interface AllocateResult<T> {
  selected: T[]
  /** true si se devolvieron menos de `target` por agotamiento real del pool. */
  exhausted: boolean
}

/**
 * Reparte `target` items entre `groups` de forma proporcional, priorizando los
 * items marcados por `isPriority`, y RELLENANDO cualquier déficit desde el
 * resto de items (de cualquier grupo) hasta alcanzar `target` o agotar el pool.
 *
 * @param items   Pool de candidatos (se asumen DISTINTOS; deduplicar antes si hace falta).
 * @param groups  Lista canónica de grupos entre los que repartir.
 * @param target  Nº de items deseado.
 */
export function allocateProportional<T>(
  items: T[],
  groups: Array<string | number>,
  target: number,
  opts: AllocateOptions<T>,
): AllocateResult<T> {
  const rng = opts.rng ?? Math.random

  const shuffle = <X>(arr: X[]): X[] => {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  // Orden dentro de un bucket: prioritarios (barajados) primero, luego el resto (barajado).
  const ordered = (arr: T[]): T[] => {
    if (!opts.isPriority) return shuffle(arr)
    const pri: T[] = []
    const rest: T[] = []
    for (const x of arr) (opts.isPriority(x) ? pri : rest).push(x)
    return shuffle(pri).concat(shuffle(rest))
  }

  if (target <= 0 || items.length === 0) {
    return { selected: [], exhausted: target > 0 && items.length === 0 }
  }

  // Camino rápido: 0/1 grupo → barajar (prioritarios primero) y cortar.
  if (groups.length <= 1) {
    const selected = ordered(items).slice(0, target)
    return { selected, exhausted: selected.length < target }
  }

  // Agrupar
  const byGroup = new Map<string | number, T[]>()
  for (const g of groups) byGroup.set(g, [])
  for (const it of items) {
    const k = opts.groupKey(it)
    if (k != null && byGroup.has(k)) byGroup.get(k)!.push(it)
  }
  // Ordenar cada grupo (prioritarios primero)
  for (const g of groups) byGroup.set(g, ordered(byGroup.get(g)!))

  const base = Math.floor(target / groups.length)
  let remainder = target % groups.length

  // Asignación base: min(base, disponibles del grupo)
  const alloc = new Map<string | number, number>()
  for (const g of groups) alloc.set(g, Math.min(base, byGroup.get(g)!.length))

  // Repartir el remainder a grupos que tengan excedente sobre su asignación
  for (const g of groups) {
    if (remainder <= 0) break
    if (byGroup.get(g)!.length > alloc.get(g)!) {
      alloc.set(g, alloc.get(g)! + 1)
      remainder--
    }
  }

  // Seleccionar de cada grupo
  const selected: T[] = []
  const usedPerGroup = new Map<string | number, number>()
  for (const g of groups) {
    const take = alloc.get(g)!
    selected.push(...byGroup.get(g)!.slice(0, take))
    usedPerGroup.set(g, take)
  }

  // RELLENO DE DÉFICIT (el paso que faltaba en el catálogo adaptativo):
  // si faltan items para llegar a target, completar desde los sobrantes de
  // CUALQUIER grupo, prioritarios primero. Garantiza el invariante.
  if (selected.length < target) {
    const leftovers: T[] = []
    for (const g of groups) {
      leftovers.push(...byGroup.get(g)!.slice(usedPerGroup.get(g)!))
    }
    selected.push(...ordered(leftovers).slice(0, target - selected.length))
  }

  return { selected: shuffle(selected), exhausted: selected.length < target }
}
