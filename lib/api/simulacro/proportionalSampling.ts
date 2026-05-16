// lib/api/simulacro/proportionalSampling.ts
//
// Algoritmo de reparto proporcional de "slots" del simulacro entre topics
// (o subtypes psicotécnicos) según su frecuencia histórica en exámenes
// oficiales.
//
// Usamos el método Hamilton / Largest Remainder Method para que la suma de
// asignaciones sea EXACTAMENTE el total de slots pedido (no redondeos
// independientes que puedan fallar la suma).
//
// Sin dependencias de BD ni Drizzle — fácil de testear con unit tests.

/**
 * Reparte `totalSlots` entre claves según sus pesos (counts históricos).
 *
 * Hamilton's method:
 *   1. Para cada clave, asignar floor(weight * totalSlots / totalWeight)
 *   2. Quedan N restos (totalSlots - suma_floors)
 *   3. Repartir esos N restos a las claves con MAYOR parte fraccional
 *
 * Garantiza suma exacta. Claves con peso 0 reciben 0 slots.
 *
 * @example
 *   distributeSlots(new Map([['a', 50], ['b', 30], ['c', 20]]), 10)
 *   // → Map { 'a' => 5, 'b' => 3, 'c' => 2 }  (suma 10)
 */
export function distributeSlots(
  weights: Map<string, number>,
  totalSlots: number,
): Map<string, number> {
  const result = new Map<string, number>()

  if (totalSlots <= 0) {
    for (const k of weights.keys()) result.set(k, 0)
    return result
  }

  // Suma total de pesos
  let totalWeight = 0
  for (const w of weights.values()) totalWeight += w

  if (totalWeight <= 0) {
    // Sin datos de pesos: reparto uniforme entre todas las claves
    const keys = [...weights.keys()]
    const base = Math.floor(totalSlots / keys.length)
    const extra = totalSlots - base * keys.length
    keys.forEach((k, i) => result.set(k, base + (i < extra ? 1 : 0)))
    return result
  }

  // Asignación fraccional + floor
  type Frac = { key: string; floor: number; remainder: number }
  const fractional: Frac[] = []

  for (const [key, weight] of weights.entries()) {
    if (weight <= 0) {
      result.set(key, 0)
      continue
    }
    const exact = (weight / totalWeight) * totalSlots
    const floor = Math.floor(exact)
    fractional.push({ key, floor, remainder: exact - floor })
    result.set(key, floor)
  }

  // Repartir el déficit a los de mayor parte fraccional
  let assigned = 0
  for (const v of result.values()) assigned += v
  let remaining = totalSlots - assigned

  // Tie-break determinista: por remainder DESC, luego por nombre alfabético ASC
  fractional.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder
    return a.key.localeCompare(b.key)
  })

  for (let i = 0; i < fractional.length && remaining > 0; i++) {
    const f = fractional[i]
    result.set(f.key, (result.get(f.key) ?? 0) + 1)
    remaining--
  }

  return result
}

/**
 * Tras una primera asignación, algunos topics pueden NO tener suficientes
 * preguntas en BD para llenar sus slots. Redistribuye los déficits a los
 * demás topics que SÍ tengan stock disponible, proporcionalmente a sus
 * pesos originales.
 *
 * @param initial   Asignación inicial (Hamilton)
 * @param available Cuántas preguntas hay realmente disponibles por clave
 * @param weights   Pesos originales (para repartir déficit proporcional)
 * @returns Asignación final con suma <= totalSlots; igual cuando hay stock
 *          suficiente, menor si el catálogo total no llega.
 */
export function redistributeShortfall(
  initial: Map<string, number>,
  available: Map<string, number>,
  weights: Map<string, number>,
): Map<string, number> {
  const result = new Map(initial)
  let deficit = 0

  // Primera pasada: capar a lo disponible y acumular déficit
  for (const [key, slots] of result.entries()) {
    const stock = available.get(key) ?? 0
    if (slots > stock) {
      deficit += slots - stock
      result.set(key, stock)
    }
  }

  if (deficit === 0) return result

  // Segunda pasada: redistribuir déficit. Repetir hasta agotar o sin candidatos.
  while (deficit > 0) {
    // Candidatos: claves con weight > 0 y todavía con stock libre
    const candidates: Array<{ key: string; weight: number; free: number }> = []
    for (const [key, weight] of weights.entries()) {
      if (weight <= 0) continue
      const stock = available.get(key) ?? 0
      const assigned = result.get(key) ?? 0
      const free = stock - assigned
      if (free > 0) candidates.push({ key, weight, free })
    }
    if (candidates.length === 0) break // sin más stock global

    // Repartir entre candidatos proporcional a su peso original
    const totalCandidateWeight = candidates.reduce((s, c) => s + c.weight, 0)
    const subWeights = new Map(candidates.map(c => [c.key, c.weight]))
    const distrib = distributeSlots(subWeights, deficit)

    // Aplicar capeando a `free`
    let actuallyAssigned = 0
    for (const c of candidates) {
      const want = distrib.get(c.key) ?? 0
      const give = Math.min(want, c.free)
      if (give > 0) {
        result.set(c.key, (result.get(c.key) ?? 0) + give)
        actuallyAssigned += give
      }
    }

    if (actuallyAssigned === 0) break // no se pudo asignar nada más
    deficit -= actuallyAssigned
  }

  return result
}
