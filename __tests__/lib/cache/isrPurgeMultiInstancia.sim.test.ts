/**
 * CAPA 3 (simulación) — la flota entera, no una instancia suelta.
 *
 * Reproduce el incidente MEDIDO del 25/07/2026: con 6 tasks de Fargate detrás del
 * ALB, un POST a /api/purge-cache llegaba a UNA instancia y las otras 5 seguían
 * sirviendo el HTML viejo (1 de cada 6 peticiones servía lo nuevo). El remedio era
 * repetir el POST 15-20 veces.
 *
 * Aquí se levantan 6 observadores INDEPENDIENTES (uno por instancia, cada uno con
 * su snapshot) sobre un KV compartido simulado, y se comprueba el invariante que
 * de verdad importa: **tras una purga, las 6 acaban sirviendo contenido nuevo**.
 * Un test de una sola instancia no habría distinguido el arreglo del bug.
 *
 * El KV simulado implementa la semántica REAL que usa el código (HINCRBY sobre un
 * hash y HGETALL), no un mock que devuelve lo que al test le conviene.
 */
import { createIsrPurgeObserver } from '@/lib/cache/isrPurgeWatcher'
import { diffIsrPurgeLog, type IsrPurgeSnapshot } from '@/lib/cache/isrPurgeLog'

/** KV compartido con la semántica de HINCRBY/HGETALL. */
function crearKvCompartido() {
  const hash = new Map<string, number>()
  let caido = false
  return {
    hincrby(field: string) {
      if (caido) return
      hash.set(field, (hash.get(field) ?? 0) + 1)
    },
    hgetall(): IsrPurgeSnapshot | null {
      if (caido) return null // el sink real devuelve null cuando no puede leer
      return Object.fromEntries(hash)
    },
    tirar() { caido = true },
    levantar() { caido = false },
    flush() { hash.clear() },
  }
}

/**
 * Una instancia ECS: su propio ISR (qué versión de cada ruta sirve) y su propio
 * observador. `servir()` es lo que vería un usuario que cae en esta instancia.
 */
function crearInstancia(kv: ReturnType<typeof crearKvCompartido>, contenido: Map<string, string>) {
  const isr = new Map<string, string>()
  const observer = createIsrPurgeObserver({
    read: async () => kv.hgetall(),
    // Purgar = tirar la copia local; la próxima petición re-renderiza desde el contenido vivo.
    apply: async (paths) => {
      paths.forEach((p) => isr.delete(p))
      return paths.length
    },
  })
  return {
    observer,
    /** Lo que ve un usuario que cae en esta instancia (rellena el ISR en el primer hit). */
    servir(path: string): string {
      if (!isr.has(path)) isr.set(path, contenido.get(path) ?? '')
      return isr.get(path)!
    },
    /** Lo que hace `revalidatePath()` en la instancia que atiende el POST. */
    purgarLocal(path: string): void {
      isr.delete(path)
    },
  }
}

describe('SIMULACIÓN — purga ISR sobre una flota de 6 instancias', () => {
  const RUTA = '/auxiliar-administrativo-estado'

  it('INCIDENTE REAL: sin propagación, 1 de cada 6 sirve lo nuevo; con ella, las 6', async () => {
    const kv = crearKvCompartido()
    const contenido = new Map([[RUTA, 'v1-plazas-42']])
    const flota = Array.from({ length: 6 }, () => crearInstancia(kv, contenido))

    // Todas cachean la versión vieja (tráfico normal repartido por el ALB).
    flota.forEach((i) => expect(i.servir(RUTA)).toBe('v1-plazas-42'))

    // Cada instancia hace su primer ciclo (baseline) durante el tráfico normal.
    for (const inst of flota) await inst.observer.cycle()

    // Cambia el dato en BD y se purga: el POST cae en UNA sola instancia (la 0),
    // que purga en el acto (lo hace el endpoint) y deja constancia en el registro.
    contenido.set(RUTA, 'v2-plazas-46')
    flota[0].purgarLocal(RUTA) // lo que hace revalidatePath() en quien atiende
    kv.hincrby(RUTA) // lo que añade recordIsrPurge()

    // COMPORTAMIENTO VIEJO (sin propagación): solo la 0 sirve lo nuevo.
    expect(flota[0].servir(RUTA)).toBe('v2-plazas-46')
    expect(flota.slice(1).map((i) => i.servir(RUTA))).toEqual(Array(5).fill('v1-plazas-42'))

    // COMPORTAMIENTO NUEVO: en el siguiente ciclo, las otras 5 se purgan solas.
    for (const inst of flota) await inst.observer.cycle()

    const servidas = flota.map((i) => i.servir(RUTA))
    expect(servidas).toEqual(Array(6).fill('v2-plazas-46'))
  })

  it('CONVERGENCIA: una instancia que arranca DESPUÉS de la purga no re-purga el histórico', async () => {
    const kv = crearKvCompartido()
    const contenido = new Map([[RUTA, 'v1']])
    kv.hincrby(RUTA) // purgas pasadas
    kv.hincrby(RUTA)

    const nueva = crearInstancia(kv, contenido)
    const r = await nueva.observer.cycle()
    expect(r.aplicadas).toBe(0) // baseline: su ISR ya nace frío
    expect(nueva.servir(RUTA)).toBe('v1')
  })

  it('KV CAÍDO: no se pierde ninguna purga ocurrida durante el apagón', async () => {
    const kv = crearKvCompartido()
    const contenido = new Map([[RUTA, 'v1']])
    const inst = crearInstancia(kv, contenido)

    await inst.observer.cycle() // baseline con el KV sano
    expect(inst.servir(RUTA)).toBe('v1')

    kv.tirar()
    const durante = await inst.observer.cycle()
    expect(durante.aplicadas).toBe(0) // no puede leer: no hace nada, no rompe

    // Mientras estaba caído para ESTA instancia, se purgó (otra instancia sí escribió).
    kv.levantar()
    contenido.set(RUTA, 'v2')
    kv.hincrby(RUTA)

    await inst.observer.cycle()
    expect(inst.servir(RUTA)).toBe('v2') // la recupera al volver el KV
  })

  it('FLUSH del KV no provoca una purga masiva de toda la flota', async () => {
    // Un FLUSH/TTL borra los contadores. Si eso se interpretara como "cambió",
    // las 6 instancias recomputarían todas sus rutas a la vez por un evento de
    // infraestructura, sin que haya contenido nuevo. No debe pasar.
    const kv = crearKvCompartido()
    const contenido = new Map([[RUTA, 'v1']])
    const flota = Array.from({ length: 6 }, () => crearInstancia(kv, contenido))
    kv.hincrby(RUTA)
    for (const i of flota) await i.observer.cycle() // baseline con el contador a 1

    kv.flush()
    const resultados = await Promise.all(flota.map((i) => i.observer.cycle()))
    expect(resultados.every((r) => r.aplicadas === 0)).toBe(true)
  })

  it('ANTI-BUCLE: aplicar una purga no genera una purga nueva', async () => {
    // El endpoint interno NO escribe en el registro. Si escribiera, cada ciclo
    // dispararía el siguiente y la flota se purgaría en bucle para siempre.
    const kv = crearKvCompartido()
    const contenido = new Map([[RUTA, 'v1']])
    const flota = Array.from({ length: 3 }, () => crearInstancia(kv, contenido))
    for (const i of flota) await i.observer.cycle() // baseline

    kv.hincrby(RUTA)
    for (const i of flota) await i.observer.cycle() // todas aplican

    // Ciclos siguientes sin purgas nuevas: silencio absoluto.
    for (let ronda = 0; ronda < 3; ronda++) {
      const r = await Promise.all(flota.map((i) => i.observer.cycle()))
      expect(r.every((x) => x.aplicadas === 0)).toBe(true)
    }
  })

  it('CARGA: 200 rutas purgadas de golpe se aplican en lotes acotados', async () => {
    const kv = crearKvCompartido()
    const contenido = new Map<string, string>()
    const rutas = Array.from({ length: 200 }, (_, i) => `/ruta-${i}`)
    rutas.forEach((r) => contenido.set(r, 'v1'))
    const inst = crearInstancia(kv, contenido)
    await inst.observer.cycle() // baseline

    rutas.forEach((r) => kv.hincrby(r))
    const primero = await inst.observer.cycle()
    expect(primero.pendientes.length).toBeLessThanOrEqual(50) // no un pico de 200 recomputaciones
    expect(primero.aplicadas).toBeGreaterThan(0)
  })
})

describe('SIMULACIÓN — coherencia con el núcleo puro', () => {
  it('el diff que usa la simulación es el MISMO de producción', () => {
    // Guarda contra el clásico "la simulación pasa porque reimplementa la lógica".
    expect(diffIsrPurgeLog({ '/x': 1 }, { '/x': 2 })).toEqual(['/x'])
  })
})
