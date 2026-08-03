// lib/sim/oraculo.ts — ¿esta página está BIEN? El juicio del barrido de rutas. PURO.
// (T-487, 02/08/2026)
//
// ── LO QUE FALTABA NO ERA PLAYWRIGHT ─────────────────────────────────────────────────────────
// Un recorredor sin criterio de fallo visita 168 rutas y dice que todo va bien. El navegador es
// la parte fácil y ya estaba (`scripts/sim/run.ts`); lo que no existía es **qué cuenta como
// roto** cuando nadie ha escrito un escenario para esa página concreta.
//
// Un journey de Vence Sim afirma cosas de DOMINIO («ninguna pregunta fuera del temario»). Eso no
// se puede escribir 168 veces. El oráculo del barrido afirma lo que vale para CUALQUIER página, y
// es justo lo que un usuario llamaría «está roto»:
//
//   · el servidor devuelve 5xx;
//   · sale la pantalla de error de la app (su texto real: «Algo no ha ido bien» / «Algo salió mal»);
//   · la página responde 200 y **no pinta nada**;
//   · la consola del navegador escupe errores;
//   · React se queja de hidratación (lo que el usuario ve como contenido que baila o botones sordos).
//
// ── Y LA META-PREGUNTA, QUE ES LA QUE MÁS VALE ──────────────────────────────────────────────
// Si el barrido ve un fallo y **la observabilidad no registró nada**, eso es un PUNTO CIEGO: hoy
// nos habríamos enterado por un usuario. Ese juicio ya existe (`failureWasObserved` en
// `invariants.ts`) y se REUTILIZA: dos criterios para el mismo hecho no protegen el doble, se
// contradicen (la lección de [T-130]).
//
// Sin red ni navegador: recibe lo observado y devuelve el veredicto, para poder calibrarlo con
// tests en vez de a ojo contra producción.

import { failureWasObserved } from './invariants'
import type { InvariantResult } from './types'

/** Lo que el navegador vio en una visita. Lo rellena el runner; aquí no se mira nada más. */
export interface Observacion {
  url: string
  /** status de la respuesta principal. `null` = ni siquiera hubo respuesta (DNS, timeout…). */
  status: number | null
  /** texto visible del body (innerText). Lo que de verdad lee una persona. */
  textoVisible: string
  /** mensajes de `console.error` y errores de página no capturados. */
  erroresConsola?: string[]
  /** subpeticiones que fallaron con 5xx (el HTML puede llegar bien y el contenido no). */
  peticionesFallidas?: Array<{ url: string; status: number }>
  /** eventos de `observable_events` atribuibles a ESTA visita. Para la meta-pregunta. */
  eventos?: Array<{ event_type: string; severity: string }>
  /**
   * ¿La visita va sin sesión? Cambia el veredicto, y por eso no se puede omitir.
   *
   * Medido el 02/08 en la primera pasada real: **12 de 12 rutas salieron «sospechosas» por lo
   * mismo**, un 401 de `/api/auth/token`. No es un fallo: es la app preguntando «¿quién eres?» y
   * recibiendo «nadie». Un detector que marca todo lo que mira se ignora en una semana.
   *
   * Se condiciona a la identidad en vez de silenciarlo en bloque **porque ese mismo 401 CON
   * sesión sí es un defecto** (la sesión no se está enviando o no vale), y ese caso hay que
   * conservarlo.
   */
  anonimo?: boolean
}

export type Veredicto = 'ok' | 'sospechosa' | 'rota'

export interface JuicioDeRuta {
  url: string
  veredicto: Veredicto
  /** por qué, en lenguaje accionable. Un veredicto sin motivo no se puede triar. */
  motivos: string[]
  /** el fallo era visible y la observabilidad no lo registró. */
  puntoCiego: boolean
  invariantes: InvariantResult[]
}

/**
 * Textos de las pantallas de error REALES de la app (`app/error.tsx`, `app/global-error.tsx`).
 * Se comprueban literales a propósito: buscar la palabra «error» daría positivo en media web
 * («Notificar un error», «errores frecuentes»), y un detector que grita en falso se ignora.
 */
export const TEXTOS_PANTALLA_ERROR = [
  'Algo no ha ido bien',
  'Algo salió mal',
  // Avisos que una PÁGINA concreta pinta cuando sus datos no cargan. No son la pantalla de error
  // global, y por eso se escapaban: la página responde 200, tiene cabecera y pie (así que pasa de
  // sobra el mínimo de texto visible) y ninguna petición falla — sencillamente no hay contenido.
  // Añadido tras el 03/08/2026: `/administrativo-estado/test` sirvió «Error cargando temas» ~17 h
  // horneada en el HTML estático y el barrido la habría dado por buena (feedback `ddaa31dd`).
  // Que ya no se puedan escribir es cosa de `lib/calidad/erroresHorneados.cjs`; esto caza las que
  // queden vivas, que es lo que el usuario tiene delante.
  'Error cargando temas',
]

/**
 * Debajo de esto, una página que responde 200 no está enseñando nada.
 *
 * Calibrado sobre la página más escueta que es legítima (un aviso legal corto ronda los 600).
 * Se mide sobre el TEXTO VISIBLE y no sobre el HTML: un esqueleto de React sin datos pesa
 * decenas de kilobytes de marcado y cero letras para el usuario — exactamente el fallo que un
 * `content-length` no puede ver, y el mismo que deja ciego al cron de seguimiento con las SPA.
 */
export const MINIMO_TEXTO_VISIBLE = 120

/** Errores de consola que NO son nuestros ni son señal (extensiones, terceros, ruido conocido). */
const CONSOLA_IGNORABLE = [
  /ResizeObserver loop/i,
  /Failed to load resource.*favicon/i,
  /chrome-extension:/i,
  /Download the React DevTools/i,
]

/**
 * Lo que un visitante SIN sesión provoca por diseño: pedir el token de acceso y que le digan que
 * no hay nadie. Solo se descarta cuando la visita es anónima (ver `Observacion.anonimo`).
 */
const AUTENTICACION_SIN_SESION = [
  // Nuestro endpoint de token: 401 porque no hay sesión que convertir en token.
  /Failed to load resource.*\b40[13]\b.*\/api\/auth\/(token|session)/,
  // Google Identity Services al comprobar si hay cuenta iniciada. Sale en CASI TODAS las páginas
  // (medido: 13 de 20 en la segunda pasada real), así que sin esto el barrido marca el sitio
  // entero y deja de significar nada.
  /Not signed in with the identity provider/i,
  // Mismo origen, otra forma: el propio widget de Google avisando de que no consigue token
  // porque no hay cuenta iniciada. Salió en la tercera pasada real, ya con las otras dos calladas.
  /\[GSI_LOGGER\].*FedCM.*(reject|NetworkError)/i,
  // Tercera cara de lo mismo, vista en la pasada del 03/08 ya con las otras dos calladas: el
  // proveedor de identidad contestando que no hay ninguna cuenta iniciada. Son tres formas
  // distintas de decir «no has iniciado sesión», y las tres solo aparecen yendo anónimo.
  /Provider's accounts list is empty/i,
]

const esRuido = (m: string, anonimo: boolean) =>
  CONSOLA_IGNORABLE.some((re) => re.test(m)) ||
  (anonimo && AUTENTICACION_SIN_SESION.some((re) => re.test(m)))

/** Marcas con las que React delata un desajuste de hidratación. */
const HIDRATACION = /hydrat|did not match|Text content does not match/i

export function juzgarVisita(obs: Observacion): JuicioDeRuta {
  const motivos: string[] = []
  // En un objeto y no en una variable suelta: TypeScript no ve que `peor()` la muta desde una
  // clausura, la estrecha a 'ok' y luego declara imposible la comparación de más abajo.
  const estado: { v: Veredicto } = { v: 'ok' }
  const ORDEN: Veredicto[] = ['ok', 'sospechosa', 'rota']
  const peor = (v: Veredicto) => { if (ORDEN.indexOf(v) > ORDEN.indexOf(estado.v)) estado.v = v }

  if (obs.status === null) {
    motivos.push('sin respuesta del servidor')
    peor('rota')
  } else if (obs.status >= 500) {
    motivos.push(`HTTP ${obs.status}`)
    peor('rota')
  } else if (obs.status === 404) {
    // La ruta existe como página en el repositorio: un 404 significa que la página decidió
    // `notFound()` por falta de datos. Puede ser legítimo (algo despublicado), así que se marca
    // para mirar y NO se declara roto — declararlo llenaría el panel de falsos rojos.
    motivos.push('404 en una ruta que existe en el código (¿datos que faltan?)')
    peor('sospechosa')
  } else if (obs.status >= 400) {
    motivos.push(`HTTP ${obs.status}`)
    peor('sospechosa')
  }

  const texto = String(obs.textoVisible || '')
  if (TEXTOS_PANTALLA_ERROR.some((t) => texto.includes(t))) {
    motivos.push('se está pintando la pantalla de error de la app')
    peor('rota')
  } else if (obs.status !== null && obs.status < 400 && texto.trim().length < MINIMO_TEXTO_VISIBLE) {
    motivos.push(`responde ${obs.status} pero solo pinta ${texto.trim().length} caracteres visibles`)
    peor('rota')
  }

  const consola = (obs.erroresConsola || []).filter((m) => !esRuido(m, obs.anonimo !== false))
  const hidratacion = consola.filter((m) => HIDRATACION.test(m))
  if (hidratacion.length) {
    motivos.push(`desajuste de hidratación: ${hidratacion[0].slice(0, 160)}`)
    peor('sospechosa')
  }
  const otros = consola.filter((m) => !HIDRATACION.test(m))
  if (otros.length) {
    motivos.push(`${otros.length} error(es) de consola: ${otros[0].slice(0, 160)}`)
    peor('sospechosa')
  }

  const fallidas = obs.peticionesFallidas || []
  if (fallidas.length) {
    motivos.push(`${fallidas.length} subpetición(es) con 5xx: ${fallidas[0].url} (${fallidas[0].status})`)
    peor('rota')
  }

  // La meta-pregunta. Solo se hace cuando hay fallo visible: preguntarla siempre convertiría cada
  // página sana en un «no se observó nada», que es cierto y no significa nada.
  const visible = estado.v === 'rota'
  const inv = failureWasObserved({
    userVisibleFailure: visible,
    observedEventCount: (obs.eventos || []).filter((e) => e.severity === 'error' || e.severity === 'warn').length,
  })
  const puntoCiego = !inv.ok
  if (puntoCiego) motivos.push('PUNTO CIEGO: fallo visible sin una sola señal en observabilidad')

  return { url: obs.url, veredicto: estado.v, motivos, puntoCiego, invariantes: [inv] }
}

/** Severidad con la que entra en el bus. Un `sospechosa` en `error` haría que se dejara de leer. */
export function severidadDe(j: JuicioDeRuta): 'info' | 'warn' | 'error' {
  if (j.veredicto === 'rota') return 'error'
  if (j.veredicto === 'sospechosa') return 'warn'
  return 'info'
}

/** Resumen de una pasada, para el CLI y para decidir el exit code. */
export function resumen(juicios: JuicioDeRuta[]) {
  const rotas = juicios.filter((j) => j.veredicto === 'rota')
  const sospechosas = juicios.filter((j) => j.veredicto === 'sospechosa')
  const ciegas = juicios.filter((j) => j.puntoCiego)
  return {
    total: juicios.length,
    ok: juicios.length - rotas.length - sospechosas.length,
    rotas: rotas.length,
    sospechosas: sospechosas.length,
    puntosCiegos: ciegas.length,
    detalle: [...rotas, ...sospechosas],
  }
}
