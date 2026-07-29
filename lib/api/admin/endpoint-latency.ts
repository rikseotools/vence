// lib/api/admin/endpoint-latency.ts
// Clasificación de LATENCIA por endpoint y por ventana corta.
//
// MOTIVACIÓN — T-254, incidente del 28/07/2026:
//   Entre las 09:30 y las 09:45 UTC `/api/v2/answer-and-save` —el endpoint que guarda la
//   respuesta de cada test— estuvo con **p95 de 25.035 ms**, y el cliente corta a los 15 s:
//   34 timeouts en un minuto sobre 11 usuarios distintos. El panel de salud no se enteró.
//
//   Y no se enteró por poco: NO PODÍA, por construcción. Medido después sobre los mismos datos:
//
//   | Lo que miraba el indicador `request_latency`            | p95    | veredicto |
//   |---------------------------------------------------------|--------|-----------|
//   | 24 h del 28/07 (la ventana por defecto del panel)        |  94 ms | 🟢 verde  |
//   | la hora del incidente (09:00-10:00)                      |  89 ms | 🟢 verde  |
//   | **los 15 minutos exactos del incidente**                 | 166 ms | 🟢 verde  |
//   | `/api/v2/answer-and-save` en esos mismos 15 minutos      | 25.035 ms | 🔴 rojo |
//
//   Son DOS diluciones distintas, y hacen falta las dos correcciones:
//
//   1. **Por endpoint.** `answer-and-save` son ~1.800 peticiones de 55.919 al día (3%). Un p95
//      global es la mediana-alta de TODO el tráfico: un endpoint que es el 3% del volumen no
//      puede moverlo aunque se caiga entero. Agregar endpoints con perfiles distintos y esperar
//      ver uno concreto es un error de medida, no un umbral mal puesto.
//
//   2. **Por ventana CORTA.** Esto es lo que la ficha de T-254 no contemplaba y por lo que el
//      arreglo habría nacido ciego igual: el p95 POR ENDPOINT en la ventana de 24 h también sale
//      🟢 verde (362 ms), porque 13 minutos de incidente son el 0,9% del día. Un percentil sobre
//      un día entero no puede ver un incendio de trece minutos. Por eso aquí se clasifica el
//      **PEOR CUBO** de N minutos, no el agregado del periodo.
//
// FILOSOFÍA — la misma que `endpoint-classification.ts`, del que reutiliza `classifyEndpoint`:
//   whitelist admin explícita, y todo lo demás user-facing con el umbral estricto. Un endpoint
//   nuevo sin clasificar se vigila de más, nunca de menos.
//
// Aquí solo vive la DECISIÓN, pura y testeable. Quien llama pone los datos (la consulta que
// agrupa por endpoint y cubo) y el formato.

import { classifyEndpoint, type EndpointCategory } from './endpoint-classification'

export type LatencyStatus = 'green' | 'amber' | 'red' | 'unknown'

/**
 * Umbrales de p95 por categoría, en milisegundos.
 *
 * Cómo se eligieron (datos reales de 7 días, no intuición):
 *   - `user_facing`: la línea base de `answer-and-save` es ~360 ms de p95 diario y 25 ms de
 *     mediana. 2.000 ms es inequívocamente anormal pero todavía no es dolor visible; 5.000 ms ya
 *     es un tercio del corte del cliente (15 s) y significa respuestas que se están perdiendo.
 *   - `admin`: el panel interno vive tranquilo en p95 de ~1.300 ms (pending-counts, unread-sales)
 *     porque son consultas de agregación que nadie espera instantáneas. Con el umbral estricto
 *     estarían en ámbar permanente — y una alarma siempre encendida no es una alarma.
 *
 * Si cambian, sincronizar `docs/runbooks/health-check.md` §latencia.
 */
export const LATENCY_P95_THRESHOLDS = {
  user_facing: { amber: 2_000, red: 5_000 },
  admin: { amber: 5_000, red: 15_000 },
} as const

/**
 * Tamaño del cubo temporal. Cinco minutos es el compromiso medido: el incidente del 28/07 duró
 * ~13 minutos, así que cae entero en 2-3 cubos y ninguno lo diluye; y es lo bastante ancho para
 * que un endpoint de tráfico modesto junte muestras suficientes.
 */
export const LATENCY_BUCKET_MINUTES = 5

/**
 * Muestras mínimas por cubo para que el veredicto cuente.
 *
 * Sin esto, el detector se convierte en un generador de falsos positivos: un endpoint con 2
 * peticiones en cinco minutos, una de ellas lenta, da un p95 altísimo que no describe nada. Y un
 * detector que grita por ruido acaba ignorado — el mismo final que ya tuvieron otros avisos de
 * este repo (T-033/T-039/T-046). En el incidente real había 80 peticiones en 15 minutos, o sea
 * ~27 por cubo: muy por encima de este suelo.
 */
export const LATENCY_MIN_SAMPLES = 10

/**
 * Por debajo de este número de muestras, `percentile_disc(0.95)` devuelve **literalmente el
 * máximo** del cubo (con n=19, `ceil(0.95·19)=19` → el mayor de 19). O sea: entre 10 y 19 muestras
 * esto NO es un percentil, es un detector de la peor petición del cubo.
 *
 * **No se sube el suelo a 20 a propósito, y conviene entender por qué.** Los eventos
 * `request_completed` de 2xx/3xx se emiten **muestreados al 10%** en el escritor
 * (`SUCCESS_TIMING_SAMPLE_RATE` en `lib/api/withErrorLogging.ts`; los 4xx/5xx van al 100%). Así que
 * UNA petición lenta observada implica ~10 lentas reales: es daño de verdad, no ruido, y taparlo
 * exigiendo 20 muestras dejaría ciegos a todos los endpoints que no hacen 200 peticiones reales
 * cada cinco minutos — que son casi todos.
 *
 * Lo que NO se puede hacer es llamarlo «p95» sin decir esto: medido sobre 7 días, **50 de 59 cubos
 * degradados (85%) caen en la banda 10-19**, así que el número que se enseña es, la mayoría de las
 * veces, el peor caso del cubo. Por eso se marca (`smallSample`) y el panel lo señala.
 *
 * La protección contra el falso positivo no está aquí, está en la firma de la ALERTA: exige
 * degradación en ≥2 cubos consecutivos, que un outlier suelto no produce. Medido: 0,9 alertas/día.
 */
export const LATENCY_SMALL_SAMPLE_UNDER = 20

/** Una medición: un endpoint durante un cubo de tiempo. */
export interface EndpointLatencyBucket {
  endpoint: string
  /** Inicio del cubo, en ISO. Solo se usa para poder señalar CUÁNDO pasó. */
  bucketStart: string
  /** Peticiones observadas en ese cubo. */
  samples: number
  /** p95 de `duration_ms` dentro del cubo. */
  p95Ms: number
}

export interface EndpointLatencyVerdict extends EndpointLatencyBucket {
  category: EndpointCategory
  status: LatencyStatus
  thresholds: { amber: number; red: number }
  /**
   * `true` cuando el cubo tiene menos de `LATENCY_SMALL_SAMPLE_UNDER` muestras y por tanto el
   * `p95Ms` es de hecho el MÁXIMO del cubo, no un percentil. Se marca en vez de esconderse: la
   * señal es válida (el escritor muestrea 2xx/3xx al 10%, así que una lenta observada son ~10
   * reales) pero quien la lee tiene que saber qué está mirando.
   */
  smallSample: boolean
}

/**
 * Clasifica UNA medición. `unknown` cuando no hay muestras suficientes para opinar — que no es lo
 * mismo que verde, y por eso no se devuelve verde: decir «bien» sin datos es exactamente el
 * verde-falso que el resto del panel se cuida de no dar (ver `exam_integrity.cron_failing`).
 */
export function classifyEndpointLatency(bucket: EndpointLatencyBucket): EndpointLatencyVerdict {
  const category = classifyEndpoint(bucket.endpoint)
  const thresholds = LATENCY_P95_THRESHOLDS[category]

  let status: LatencyStatus
  if (!Number.isFinite(bucket.samples) || bucket.samples < LATENCY_MIN_SAMPLES) {
    status = 'unknown'
  } else if (!Number.isFinite(bucket.p95Ms)) {
    status = 'unknown'
  } else if (bucket.p95Ms >= thresholds.red) {
    status = 'red'
  } else if (bucket.p95Ms >= thresholds.amber) {
    status = 'amber'
  } else {
    status = 'green'
  }

  return {
    ...bucket, category, status, thresholds,
    smallSample: Number.isFinite(bucket.samples) && bucket.samples < LATENCY_SMALL_SAMPLE_UNDER,
  }
}

const PEOR: Record<LatencyStatus, number> = { red: 3, amber: 2, unknown: 1, green: 0 }

/**
 * De todos los cubos observados, se queda con el PEOR de cada endpoint.
 *
 * Es la operación que hace que el detector vea incendios cortos: si un endpoint estuvo bien 280
 * minutos y en llamas 13, lo que describe la salud del usuario que estudiaba en esos 13 minutos
 * es el peor cubo, no el promedio del día. Empata por p95 para que el peor sea reproducible.
 */
export function worstBucketPerEndpoint(
  buckets: readonly EndpointLatencyBucket[],
): EndpointLatencyVerdict[] {
  const porEndpoint = new Map<string, EndpointLatencyVerdict>()
  for (const b of buckets ?? []) {
    const v = classifyEndpointLatency(b)
    const previo = porEndpoint.get(v.endpoint)
    if (!previo) { porEndpoint.set(v.endpoint, v); continue }
    const mejorQueElPrevio =
      PEOR[v.status] > PEOR[previo.status] ||
      (PEOR[v.status] === PEOR[previo.status] && v.p95Ms > previo.p95Ms)
    if (mejorQueElPrevio) porEndpoint.set(v.endpoint, v)
  }
  return [...porEndpoint.values()].sort(
    (a, b) => PEOR[b.status] - PEOR[a.status] || b.p95Ms - a.p95Ms,
  )
}

/**
 * Estado global del indicador: el peor endpoint manda.
 *
 * Deliberadamente NO se promedia. Que 40 endpoints vayan bien no compensa que el que guarda la
 * respuesta del test esté a 25 segundos — promediar aquí reproduciría, un nivel más arriba, la
 * misma dilución que hizo invisible el incidente del 28/07.
 *
 * `unknown` solo si NO hay ni una medición con muestras suficientes; un `unknown` suelto conviviendo
 * con verdes no degrada nada (es un endpoint de poco tráfico, no una avería).
 */
export function overallEndpointLatencyStatus(
  verdicts: readonly EndpointLatencyVerdict[],
): LatencyStatus {
  if (!verdicts?.length) return 'unknown'
  const conDatos = verdicts.filter(v => v.status !== 'unknown')
  if (!conDatos.length) return 'unknown'
  if (conDatos.some(v => v.status === 'red')) return 'red'
  if (conDatos.some(v => v.status === 'amber')) return 'amber'
  return 'green'
}

/** Los que hay que mirar: ámbar o rojo, ya ordenados por gravedad. */
export function degradedEndpoints(
  verdicts: readonly EndpointLatencyVerdict[],
): EndpointLatencyVerdict[] {
  return (verdicts ?? []).filter(v => v.status === 'amber' || v.status === 'red')
}

/** Una degradación sostenida: varios cubos seguidos malos en el mismo endpoint. */
export interface SustainedDegradation {
  endpoint: string
  /** Primer cubo de la racha, ISO. */
  desde: string
  /** Cuántos cubos consecutivos duró. */
  buckets: number
  /** Minutos de degradación (buckets × tamaño del cubo). */
  minutos: number
  /** El peor p95 de la racha. */
  peorP95Ms: number
}

/**
 * Detecta degradación SOSTENIDA en endpoints de usuario: ≥2 cubos consecutivos en ámbar-o-peor
 * con al menos uno en rojo.
 *
 * Es la señal para ALERTAR, distinta de la del panel a propósito. El panel puede permitirse un
 * ámbar suelto —lo ves cuando entras—; un correo, no: una alerta que llega a diario deja de
 * leerse. Aquí solo entra lo que duró.
 *
 * **Por qué esta firma y no otra, medido sobre el incidente real del 28/07** (los cubos fueron
 * 09:30 rojo 25.145 ms, 09:35 ámbar 4.732, 09:40 ámbar 3.272, 09:45 severo con 6 muestras):
 *   - «≥2 endpoints en rojo a la vez» (firma de recurso compartido) → **lo pierde**: los otros dos
 *     endpoints tocados no llegaban al suelo de muestras, así que el único rojo era éste.
 *   - «≥2 cubos ROJOS seguidos» → **lo pierde también**: solo un cubo pasó de 5.000 ms.
 *   - Ésta → lo caza, y con ella salen los tres incidentes que describe T-254 (24, 27 y 28/07).
 *
 * Volumen medido sobre 7 días de producción: **0,9/día**. Un detector que no caza su propio caso de
 * origen no vale; uno que se enciende cada hora, tampoco.
 *
 * Solo `user_facing`: una agregación lenta del panel admin no despierta a nadie.
 */
export function sustainedDegradations(
  buckets: readonly EndpointLatencyBucket[],
  bucketMinutes: number = LATENCY_BUCKET_MINUTES,
): SustainedDegradation[] {
  const porEndpoint = new Map<string, EndpointLatencyVerdict[]>()
  for (const b of buckets ?? []) {
    const v = classifyEndpointLatency(b)
    if (v.category !== 'user_facing') continue
    if (v.status !== 'red' && v.status !== 'amber') continue
    if (!porEndpoint.has(v.endpoint)) porEndpoint.set(v.endpoint, [])
    porEndpoint.get(v.endpoint)!.push(v)
  }

  const paso = bucketMinutes * 60_000
  const out: SustainedDegradation[] = []
  for (const [endpoint, lista] of porEndpoint) {
    const orden = lista.sort(
      (a, b) => new Date(a.bucketStart).getTime() - new Date(b.bucketStart).getTime())
    let racha: EndpointLatencyVerdict[] = []
    const cerrar = () => {
      if (racha.length >= 2 && racha.some(v => v.status === 'red')) {
        out.push({
          endpoint,
          desde: racha[0].bucketStart,
          buckets: racha.length,
          minutos: racha.length * bucketMinutes,
          peorP95Ms: Math.max(...racha.map(v => v.p95Ms)),
        })
      }
      racha = []
    }
    for (const v of orden) {
      const anterior = racha[racha.length - 1]
      const consecutivo = anterior &&
        new Date(v.bucketStart).getTime() - new Date(anterior.bucketStart).getTime() === paso
      if (!consecutivo) cerrar()
      racha.push(v)
    }
    cerrar()
  }
  return out.sort((a, b) => b.peorP95Ms - a.peorP95Ms)
}
