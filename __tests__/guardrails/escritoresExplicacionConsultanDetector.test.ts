/**
 * TRINQUETE (T-204, cabo 2): quien escribe una explicación estructurada NO puede marcar la pregunta
 * `safe` a ciegas.
 *
 * El defecto que fija: la explicación estructurada arregla la EXPLICACIÓN (las razones viajan con
 * su opción), pero no arregla unas OPCIONES que se citan entre sí —«La respuesta b) es correcta y
 * además…»—; esa pregunta sigue sin poder barajarse. Los dos escritores llamaban a
 * `record_shuffle_safety(…, 'safe', …)` incondicionalmente y era `sweep-shuffle-safety-drift` quien
 * lo descubría DESPUÉS. Medido el 27/07 con `d3419597` (art. 53.2 CE): nació `safe` en las tres
 * aplicaciones y hubo que devolverla a `unsafe` a mano. Con ~47k pendientes de backfill, el sweep
 * iría eternamente detrás recogiendo lo que el escritor acaba de romper.
 *
 * Se comprueba sobre el FUENTE, no sobre la BD, porque el fallo es de omisión: no hay nada que
 * observar en runtime hasta que ya se ha escrito mal. Un test de comportamiento exigiría RDS y no
 * correría en CI, que es justo donde tiene que sonar la alarma.
 */
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'

// ── LOS ESCRITORES SE BUSCAN, NO SE LISTAN (T-722, 08/08/2026) ──────────────────────────────
// Esta lista tenía DOS ficheros escritos a mano y ya se había quedado corta: el tercero,
// `scripts/reparar-narrativa-letra-clavada.ts`, escribe `explanation_data` y marcaba las preguntas
// `safe` SIN consultar el detector — y `record_shuffle_safety` solo valida la cadena del estado,
// no el contenido. Medido al encontrarlo: **79 preguntas activas con explicación estructurada
// tienen opciones que se citan entre sí**, así que el agujero era vivo, no teórico.
//
// Es la cuarta vez que esta casa paga contar a ojo los sitios que tocan un recurso compartido
// (T-130 seguimiento_url, T-339 target_oposicion, T-689 review_requested_at, T-624 la credencial).
// La lista no estaba mal el día que se escribió: se quedó vieja sola. Así que se BUSCAN.
const RAICES = ['scripts', 'lib', 'app', 'backend/src']

function ficherosDeCodigo(dir: string, out: string[] = []): string[] {
  const abs = path.join(process.cwd(), dir)
  if (!existsSync(abs)) return out
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (/node_modules|\.next|dist/.test(rel)) continue
    if (e.isDirectory()) ficherosDeCodigo(rel, out)
    else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

/**
 * Escribir `explanation_data` es lo que te convierte en escritor, te llames como te llames.
 * Se reconoce por el patrón de ESCRITURA real, no por mencionarlo (leerlo no cuenta).
 */
function esEscritor(src: string): boolean {
  if (!/explanation_data|explanationData/.test(src)) return false
  return /UPDATE\s+questions[\s\S]{0,400}?explanation_data\s*=/i.test(src) ||
         /\.set\(\{[\s\S]{0,300}?explanationData\s*:/.test(src)
}

const ESCRITORES = RAICES.flatMap((r) => ficherosDeCodigo(r))
  .filter((f) => esEscritor(readFileSync(path.join(process.cwd(), f), 'utf8')))

describe('los escritores de explicación estructurada consultan el detector de opciones cruzadas', () => {
  it('encuentra escritores (un descubrimiento vacío pasaría TODO en verde)', () => {
    // La forma más silenciosa de perder un guardarraíl: que deje de encontrar a quién vigilar.
    expect(ESCRITORES.length).toBeGreaterThanOrEqual(3)
    expect(ESCRITORES).toContain('scripts/aplicar-explicacion.ts')
    expect(ESCRITORES).toContain('scripts/reparar-narrativa-letra-clavada.ts')
  })

  test.each(ESCRITORES)('%s importa optionsReferenceOtherOptions y lo usa', (fichero) => {
    const src = readFileSync(path.join(process.cwd(), fichero), 'utf8')
    // La lista de símbolos importados puede crecer (el 30/07 se le añadió `neutralizaCitasLegales`,
    // T-324): lo que este trinquete protege es que el detector venga del módulo COMPARTIDO, no que
    // sea el único import. Exigir la línea literal hacía fallar el guardarraíl por añadir al lado
    // otra pieza del mismo módulo — un guardarraíl que salta por eso se acaba desactivando.
    expect(src).toMatch(
      /import \{[^}]*\boptionsReferenceOtherOptions\b[^}]*\} from '@\/lib\/shuffle\/classifyShuffleMode'/
    )
    expect(src).toMatch(/optionsReferenceOtherOptions\(/)
  })

  test.each(ESCRITORES)('%s no marca `safe` como literal incondicional', (fichero) => {
    const src = readFileSync(path.join(process.cwd(), fichero), 'utf8')
    // Lo prohibido es la PAREJA literal de la forma vieja —veredicto y motivo fijos, sin haber
    // preguntado a nadie—. Un `'safe'` suelto es legítimo: hoy aparece como rama del ternario
    // `cruzadas ? 'unsafe' : 'safe'`, que es precisamente el arreglo. Buscar solo `'safe'` haría
    // que este trinquete se disparase con la propia solución (pasó al escribirlo).
    const formaVieja = src.match(/'safe',\s*'structured_explanation'/g) ?? []
    expect(formaVieja).toEqual([])
  })
})
