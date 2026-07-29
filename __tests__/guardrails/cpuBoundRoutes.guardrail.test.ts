/**
 * @jest-environment node
 */
// GUARDARRAÍL — ninguna ruta SERVIDA puede renderizar CPU-bound en línea.
//
// ## El incidente que lo crea (2026-07-29, ver docs/ARCHITECTURE_ROADMAP.md)
//
// De 09:30 a 09:48 UTC, `/api/v2/answer-and-save` —el guardado de CADA respuesta de CADA test—
// estuvo a p95 25.070 ms, con el event-loop del frontend bloqueado hasta 215 s en 5 instancias a la
// vez y la CPU del servicio al 98,5%. El tráfico fue PLANO todo el rato: no fue carga de usuarios.
//
// La causa: `app/api/temario/[oposicion]/[topic]/pdf/route.ts` (premium, sin límite de tasa)
// renderiza el PDF EN LÍNEA con
// `@react-pdf/renderer` y lo sella con `pdf-lib`. Las dos son JS puro y CPU pura dentro del proceso
// que sirve el tráfico, y un tema puede tener 760 páginas. Node es monohilo: mientras eso corre,
// todo lo que sirve esa task hace cola detrás.
//
// ## Por qué un test y no una nota en el manual
//
// **El conocimiento ya estaba escrito y aun así ocurrió.** El worker de PDFs existe exactamente por
// este motivo y su Dockerfile lo dice literal: *"el render de @react-pdf es CPU-bound (hasta
// ~12min/3GB) y bloquearía el event-loop de una task de serving → fallaría health checks y la
// matarían (exit 137)"*. Se blindó el camino por LOTES y se dejó sin blindar el camino BAJO DEMANDA.
// Una advertencia en prosa no impidió la excepción; un test rojo sí.
//
// ## Qué hace exactamente
//
// Falla si un `route.ts` servido alcanza un motor de render CPU-bound —directamente o a través de
// un `lib/` propio— sin estar en `EXCEPCIONES`, que exige ficha abierta y motivo. No pretende que
// el problema esté resuelto: **impide que la clase CREZCA en silencio** y obliga a una decisión
// consciente en cada ruta nueva. Cuando T-270 se cierre, la lista queda vacía y este test lo exige.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, dirname, resolve } from 'path'

const RAIZ = process.cwd()

/**
 * Motores de render que bloquean el event-loop. No es "cualquier cosa pesada": son librerías de
 * JS puro que hacen trabajo de CPU sostenido sin ceder, que es lo que convierte una petición lenta
 * en una task entera parada.
 */
const MOTORES_CPU = ['@react-pdf/renderer', 'pdf-lib'] as const

/**
 * Rutas servidas que HOY alcanzan un motor CPU-bound. Cada una necesita ficha ABIERTA y motivo.
 * Añadir una entrada aquí es una decisión, no un trámite: significa aceptar que esa ruta puede
 * parar la task que la sirve.
 */
const EXCEPCIONES: Record<string, { ficha: string; motivo: string }> = {
  'app/api/temario/[oposicion]/[topic]/pdf/route.ts': {
    ficha: 'T-270',
    motivo:
      'Incidente 2026-07-29: renderiza el PDF en línea en el contenedor que sirve. Pendiente de ' +
      'encolar al worker (que ya existe y está aislado) y servir desde la caché S3.',
  },
  'app/api/admin/temario/pregenerate/route.ts': {
    ficha: 'T-270',
    motivo:
      'Responde 202 y hace fan-out de N renders EN BACKGROUND, pero ese background sigue siendo el ' +
      'contenedor que sirve tráfico. Es admin-only (alcance menor que la ruta pública) pero el ' +
      'mecanismo de daño es idéntico. Lo destapó el propio guardarraíl: la lista se escribió ' +
      'suponiendo UNA ruta y había dos.',
  },
}

/** Recorre `app/` y devuelve los ficheros de ruta servidos. */
function rutasServidas(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === 'node_modules' || nombre === '.next') continue
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) rutasServidas(ruta, acc)
    else if (/^route\.tsx?$/.test(nombre)) acc.push(ruta)
  }
  return acc
}

/** Los imports relativos y de alias `@/` de un fichero, resueltos a rutas del repo. */
function importsLocales(fichero: string): string[] {
  const src = readFileSync(fichero, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const esp = m[1]
    let base: string | null = null
    if (esp.startsWith('@/')) base = join(RAIZ, esp.slice(2))
    else if (esp.startsWith('.')) base = resolve(dirname(fichero), esp)
    if (!base) continue
    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      if (existsSync(base + ext)) { out.push(base + ext); break }
      if (existsSync(base) && statSync(base).isFile()) { out.push(base); break }
    }
  }
  return out
}

/**
 * ¿Esta ruta alcanza un motor CPU-bound? Sigue los imports locales en profundidad (hasta `limite`),
 * porque el caso real NO importa `pdf-lib` directamente: lo alcanza vía `lib/temario/pdf/stampChrome`.
 * Un guardarraíl que solo mirase la primera línea de imports no habría cazado su propio incidente.
 */
function alcanzaMotorCpu(fichero: string, limite = 4): string | null {
  const vistos = new Set<string>()
  const cola: Array<{ f: string; prof: number }> = [{ f: fichero, prof: 0 }]
  while (cola.length) {
    const { f, prof } = cola.shift()!
    if (vistos.has(f) || prof > limite) continue
    vistos.add(f)
    let src: string
    try { src = readFileSync(f, 'utf8') } catch { continue }
    for (const motor of MOTORES_CPU) {
      if (src.includes(`'${motor}'`) || src.includes(`"${motor}"`)) return motor
    }
    for (const dep of importsLocales(f)) cola.push({ f: dep, prof: prof + 1 })
  }
  return null
}

describe('Ninguna ruta servida renderiza CPU-bound en línea (incidente 2026-07-29)', () => {
  const rutas = rutasServidas(join(RAIZ, 'app'))

  it('encuentra rutas que auditar (si esto falla, el guardarraíl se quedó ciego)', () => {
    // Un test que no mira nada pasa siempre. Este número solo puede subir.
    expect(rutas.length).toBeGreaterThan(50)
  })

  it('ninguna ruta NUEVA alcanza un motor de render CPU-bound', () => {
    const infractoras: string[] = []
    for (const ruta of rutas) {
      const rel = relative(RAIZ, ruta)
      const motor = alcanzaMotorCpu(ruta)
      if (motor && !EXCEPCIONES[rel]) infractoras.push(`${rel} → ${motor}`)
    }
    expect(infractoras).toEqual([])
  })

  it('CAZA el caso real: la ruta del incidente sí alcanza el motor (vía lib, no directo)', () => {
    // Si esta comprobación se pusiera verde, sería que el detector dejó de seguir los imports en
    // profundidad — y entonces las dos de arriba pasarían por vacías, no por limpias.
    const ruta = join(RAIZ, 'app/api/temario/[oposicion]/[topic]/pdf/route.ts')
    expect(existsSync(ruta)).toBe(true)
    expect(alcanzaMotorCpu(ruta)).not.toBeNull()
  })

  it('cada excepción declara ficha y motivo', () => {
    for (const [ruta, meta] of Object.entries(EXCEPCIONES)) {
      expect(meta.ficha).toMatch(/^T-\d+$/)
      expect(meta.motivo.length).toBeGreaterThan(40)
      expect(existsSync(join(RAIZ, ruta))).toBe(true)
    }
  })

  it('la ficha de cada excepción sigue ABIERTA (si se cerró, hay que quitar la excepción)', () => {
    // Evita el residuo permanente: una excepción cuya ficha ya está cerrada es una excepción que
    // nadie va a revisar nunca. Es el mismo criterio que el guardarraíl del registro de backlog.
    const md = readFileSync(join(RAIZ, 'docs/roadmap/tareas-pendientes.md'), 'utf8')
    for (const [ruta, meta] of Object.entries(EXCEPCIONES)) {
      const cabecera = md.split('\n').find((l) => l.startsWith(`### [${meta.ficha}]`))
      // El mensaje va en el propio valor comparado: `expect` de Jest no acepta segundo argumento.
      expect({ ruta, ficha: meta.ficha, tieneFicha: cabecera !== undefined })
        .toEqual({ ruta, ficha: meta.ficha, tieneFicha: true })
      expect(cabecera).not.toMatch(/✅|HECHA|CERRADA/)
    }
  })
})
