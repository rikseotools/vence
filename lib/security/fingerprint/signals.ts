// lib/security/fingerprint/signals.ts
//
// Recolección de señales de hardware para la huella de dispositivo (v2).
//
// ── QUÉ PROBLEMA RESUELVE ───────────────────────────────────────────────────
// El límite diario por dispositivo existe y está cableado desde el 17/04/2026… y en 30 días no ha
// bloqueado ni una vez, mientras 3-11 dispositivos al día se pasan del tope. La causa no es el
// enforcement: es que se ancla al `device_id` de `localStorage`, que el usuario borra en dos clics
// (o esquiva con una ventana de incógnito). Medido: el mismo trío de cuentas aparece bajo TRES
// `device_id` distintos, rotando de cuenta cada 15 minutos.
//
// La huella v1 (`lib/deviceFingerprint.ts`) sí sobrevive a eso, pero colisiona a lo bestia —hay
// huellas con 83 cuentas distintas— por dos defectos concretos:
//   1. el canvas se recortaba a `toDataURL().slice(-50)`: el FINAL de un PNG es su cierre, casi
//      idéntico entre equipos, así que la señal más discriminante de todas quedaba anulada;
//   2. el hash era casero de 32 bits (`hash |= 0`), con colisiones garantizadas a esta escala.
//
// ── EL CRITERIO DE DISEÑO QUE MANDA: ESTABILIDAD ────────────────────────────
// Una huella que cambia entre visitas es PEOR que no tener huella: el contador se reinicia solo y
// el enforcement vuelve a ser mudo, pero además creyéndose que funciona. Por eso aquí:
//   · la orientación se NORMALIZA (`min×max`): girar el móvil no puede cambiar la identidad;
//   · NO entra nada que dependa de la ventana (`innerWidth`, viewport, zoom) ni de la sesión;
//   · una señal que falla NO se omite: aporta un marcador fijo `na`. Omitirla desplazaría el resto
//     y produciría dos huellas distintas para el mismo equipo según el humor de una API.
//
// Señales elegidas, y por qué (estado del arte 2026: canvas, WebGL, audio y hardware son las
// dominantes; ver el runbook de fraudes):
//   · canvas COMPLETO — >99% de unicidad: refleja GPU, SO y motor de fuentes.
//   · WebGL vendor+renderer — identifica la GPU real y delata VMs/headless.
//   · AudioContext — procesamiento de audio propio de cada equipo.
//   · deviceMemory + hardwareConcurrency — RAM y núcleos; además se validan entre sí (16 núcleos
//     con 2 GB es incoherente y huele a falsificación).
//   · pantalla normalizada, zona horaria, idioma, plataforma, táctil.
//
// Este módulo SOLO recoge. El hash vive en `hash.ts` y la decisión en el servidor: así se puede
// testear la recolección sin criptografía y el hash sin un DOM.

/** Marcador de señal no disponible. Fijo a propósito: ver "estabilidad" arriba. */
export const NA = 'na'

export interface RawSignals {
  /** `min×max` de la pantalla: invariante a la orientación del dispositivo. */
  screen: string
  colorDepth: string
  pixelRatio: string
  timezone: string
  language: string
  /** Núcleos lógicos de CPU (`navigator.hardwareConcurrency`). */
  cores: string
  /** RAM en GB, redondeada por el navegador a potencia de 2 (`navigator.deviceMemory`). */
  memory: string
  touch: string
  platform: string
  /** Hash del canvas 2D renderizado (dataURL COMPLETO, no un recorte). */
  canvas: string
  /** `vendor~renderer` de WebGL, sin enmascarar cuando el navegador lo permite. */
  webgl: string
  /** Firma del pipeline de audio (suma de la señal procesada, redondeada). */
  audio: string
}

type Nav = Navigator & { deviceMemory?: number; hardwareConcurrency?: number }

/**
 * Pantalla normalizada por orientación.
 *
 * Un móvil girado reporta 800x360 en vez de 360x800. Sin normalizar, la misma persona tendría dos
 * identidades según cómo sujete el teléfono — y con ello, dos cupos diarios.
 */
export function normalizeScreen(w: unknown, h: unknown): string {
  const a = Number(w)
  const b = Number(h)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return NA
  return `${Math.min(a, b)}x${Math.max(a, b)}`
}

/**
 * ¿Son coherentes entre sí los recursos declarados?
 *
 * CPU y RAM correlacionan en equipos reales. Una combinación imposible (muchos núcleos con muy poca
 * memoria) no prueba fraude por sí sola, pero es señal de que alguien está manipulando el entorno,
 * y se registra para poder mirarlo. NO se usa para bloquear.
 */
export function hardwareLooksConsistent(cores: unknown, memoryGb: unknown): boolean {
  const c = Number(cores)
  const m = Number(memoryGb)
  if (!Number.isFinite(c) || !Number.isFinite(m) || c <= 0 || m <= 0) return true // sin datos, no se opina
  if (c >= 8 && m <= 2) return false
  if (c <= 2 && m >= 16) return false
  return true
}

function canvasSignal(): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 280
    canvas.height = 60
    const ctx = canvas.getContext('2d')
    if (!ctx) return NA
    // Mezcla de formas, transparencias y texto: es justo donde se notan las diferencias de GPU,
    // antialiasing y motor de fuentes entre equipos.
    ctx.textBaseline = 'top'
    ctx.font = '14px "Arial"'
    ctx.fillStyle = '#f60'
    ctx.fillRect(50, 0, 100, 30)
    ctx.fillStyle = '#069'
    ctx.fillText('Vence.es \u{1F393} fp2', 2, 15)
    ctx.fillStyle = 'rgba(102,204,0,0.7)'
    ctx.fillText('Vence.es \u{1F393} fp2', 4, 17)
    ctx.globalCompositeOperation = 'multiply'
    ctx.beginPath()
    ctx.arc(60, 30, 20, 0, Math.PI * 2, true)
    ctx.fill()
    // dataURL COMPLETO — recortarlo fue el defecto de v1.
    return canvas.toDataURL()
  } catch {
    return NA
  }
}

function webglSignal(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return NA
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    const v = typeof vendor === 'string' ? vendor : ''
    const r = typeof renderer === 'string' ? renderer : ''
    return v || r ? `${v}~${r}` : NA
  } catch {
    return NA
  }
}

/**
 * Firma del pipeline de audio, con `OfflineAudioContext` (no suena nada, no pide permisos).
 *
 * Se REDONDEA a propósito: el resultado en coma flotante tiene ruido en el último dígito entre
 * ejecuciones del mismo equipo, y sin redondear la huella sería inestable — el fallo que este
 * módulo entero existe para evitar.
 */
async function audioSignal(): Promise<string> {
  try {
    const Ctx =
      (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .webkitOfflineAudioContext
    if (!Ctx) return NA
    const ctx = new Ctx(1, 5000, 44100)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 10000
    const comp = ctx.createDynamicsCompressor()
    osc.connect(comp)
    comp.connect(ctx.destination)
    osc.start(0)
    const buffer = await ctx.startRendering()
    const data = buffer.getChannelData(0)
    let sum = 0
    for (let i = 2000; i < 4000; i++) sum += Math.abs(data[i])
    return sum > 0 ? sum.toFixed(3) : NA
  } catch {
    return NA
  }
}

/** Recoge todas las señales. Nunca lanza: una huella degradada es mejor que una pantalla rota. */
export async function collectSignals(): Promise<RawSignals> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      screen: NA, colorDepth: NA, pixelRatio: NA, timezone: NA, language: NA,
      cores: NA, memory: NA, touch: NA, platform: NA, canvas: NA, webgl: NA, audio: NA,
    }
  }
  const nav = navigator as Nav
  let timezone = NA
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || NA
  } catch { /* Intl puede faltar en entornos exóticos */ }

  return {
    screen: normalizeScreen(screen?.width, screen?.height),
    colorDepth: String(screen?.colorDepth ?? NA),
    pixelRatio: String(window.devicePixelRatio ?? NA),
    timezone,
    language: nav.language || NA,
    cores: String(nav.hardwareConcurrency ?? NA),
    memory: String(nav.deviceMemory ?? NA),
    touch: String(nav.maxTouchPoints ?? NA),
    platform: nav.platform || NA,
    canvas: canvasSignal(),
    webgl: webglSignal(),
    audio: await audioSignal(),
  }
}

/**
 * Serializa en un orden FIJO y con claves explícitas.
 *
 * Con claves (`k=v`) y no solo valores: si algún día se añade o quita una señal, el cambio es
 * evidente en el material del hash en vez de desplazar silenciosamente todo lo demás.
 */
export function serializeSignals(s: RawSignals): string {
  const orden: (keyof RawSignals)[] = [
    'screen', 'colorDepth', 'pixelRatio', 'timezone', 'language',
    'cores', 'memory', 'touch', 'platform', 'canvas', 'webgl', 'audio',
  ]
  return orden.map((k) => `${k}=${s[k] ?? NA}`).join('|')
}

/** Cuántas señales fuertes se han podido leer. Es la medida de CALIDAD de la huella. */
export function strongSignalCount(s: RawSignals): number {
  return [s.canvas, s.webgl, s.audio].filter((v) => v && v !== NA).length
}
