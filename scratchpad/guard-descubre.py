import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/guardrails/escritoresExplicacionConsultanDetector.test.ts')
s = p.read_text()

VIEJO = "const ESCRITORES = ['scripts/aplicar-explicacion.ts', 'scripts/backfill-explanation-data.ts']"

NUEVO = """// ── LOS ESCRITORES SE BUSCAN, NO SE LISTAN (T-722, 08/08/2026) ──────────────────────────────
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
    if (/node_modules|\\.next|dist/.test(rel)) continue
    if (e.isDirectory()) ficherosDeCodigo(rel, out)
    else if (/\\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

/**
 * Escribir `explanation_data` es lo que te convierte en escritor, te llames como te llames.
 * Se reconoce por el patrón de ESCRITURA real, no por mencionarlo (leerlo no cuenta).
 */
function esEscritor(src: string): boolean {
  if (!/explanation_data|explanationData/.test(src)) return false
  return /UPDATE\\s+questions[\\s\\S]{0,400}?explanation_data\\s*=/i.test(src) ||
         /\\.set\\(\\{[\\s\\S]{0,300}?explanationData\\s*:/.test(src)
}

const ESCRITORES = RAICES.flatMap((r) => ficherosDeCodigo(r))
  .filter((f) => esEscritor(readFileSync(path.join(process.cwd(), f), 'utf8')))"""

assert VIEJO in s, 'lista no encontrada'
s = s.replace(VIEJO, NUEVO, 1)

# importes que hacen falta
s = s.replace("import { readFileSync } from 'fs'", "import { readFileSync, readdirSync, existsSync } from 'fs'", 1)

# y el test que impide que el descubrimiento se quede ciego
ANCLA = "describe('los escritores de explicación estructurada consultan el detector de opciones cruzadas', () => {"
NUEVO_D = ANCLA + """
  it('encuentra escritores (un descubrimiento vacío pasaría TODO en verde)', () => {
    // La forma más silenciosa de perder un guardarraíl: que deje de encontrar a quién vigilar.
    expect(ESCRITORES.length).toBeGreaterThanOrEqual(3)
    expect(ESCRITORES).toContain('scripts/aplicar-explicacion.ts')
    expect(ESCRITORES).toContain('scripts/reparar-narrativa-letra-clavada.ts')
  })
"""
assert ANCLA in s
s = s.replace(ANCLA, NUEVO_D, 1)

p.write_text(s)
print('guardarraíl convertido a descubrimiento')
