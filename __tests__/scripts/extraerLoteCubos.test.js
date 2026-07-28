const fs = require('fs')
const path = require('path')

// ── Guardarraíl del extractor de lotes de calidad ────────────────────────────
//
// `scripts/apelotonadas/extraer-lote.cjs` saca las preguntas de un cubo de calidad CON su
// artículo, para que el pipeline (reescribir estructurada → registrar traza → re-verificar)
// pueda trabajar. El 28/07/2026 se le añadió el cubo `nota-auditoria` y se arreglaron dos cosas
// que habían mordido ese mismo día; este fichero fija las tres.
//
// Por qué un test de FUENTE y no de comportamiento: el script abre una conexión a la RDS de
// producción en cuanto arranca. Lo que hay que impedir aquí no es un cálculo mal hecho, es un
// DRIFT — que alguien copie el criterio en vez de consumirlo —, y eso se ve en el fuente.
const SCRIPT = fs.readFileSync(
  path.join(__dirname, '../../scripts/apelotonadas/extraer-lote.cjs'),
  'utf8',
)

describe('extraer-lote — el cubo `nota-auditoria` CONSUME el detector, no lo copia', () => {
  // Este detector ya se quedó «en verde mintiendo» DOS veces en dos días (28 y 28/07) por
  // criterios duplicados que divergen. Si el extractor se trajera su propia lista de patrones,
  // la cola de remediación (T-249) dejaría de coincidir con lo que el badge señala, y nadie se
  // enteraría hasta que un usuario lo reportase. Ver lib/health/auditNoteExplanation.cjs.
  it('importa el núcleo compartido', () => {
    expect(SCRIPT).toContain("'lib', 'health', 'auditNoteExplanation.cjs'")
  })

  it('usa las DOS vías del detector (los literales Y el patrón del acto)', () => {
    expect(SCRIPT).toMatch(/AUDIT_NOTE_PATS/)
    expect(SCRIPT).toMatch(/AUDIT_NOTE_META_RE_SRC/)
  })

  it('no lleva una copia propia de los patrones', () => {
    expect(SCRIPT).not.toMatch(/const AUDIT_NOTE_PATS\s*=\s*\[/)
    expect(SCRIPT).not.toContain('La explicación debería')
  })

  it('el núcleo exporta lo que el extractor le pide', () => {
    const core = require('../../lib/health/auditNoteExplanation.cjs')
    expect(Array.isArray(core.AUDIT_NOTE_PATS)).toBe(true)
    expect(typeof core.AUDIT_NOTE_META_RE_SRC).toBe('string')
  })
})

describe('extraer-lote — `--ids` significa esos ids, y punto', () => {
  // Hasta el 28/07 los ids se filtraban DENTRO del cubo: pedir 35 devolvía 8 y los otros 27
  // desaparecían en silencio. Se usa justo para reprocesar listas que salen de otra consulta
  // (p.ej. los ids de un kind del barrido), así que ese filtro silencioso lo hacía inservible
  // y, peor, mentiroso: parecía que la cola era más corta de lo que era.
  it('con --ids no se aplica el predicado del cubo', () => {
    expect(SCRIPT).toMatch(/\$\{ids \? sql`true` : PREDICADOS\[cubo\]\}/)
  })

  it('avisa de los ids pedidos que NO salieron', () => {
    expect(SCRIPT).toMatch(/ids NO salieron/)
  })
})

describe('extraer-lote — el predicado es un parámetro, con los cubos declarados', () => {
  it('declara los dos cubos conocidos', () => {
    const m = SCRIPT.match(/const PREDICADOS = \{([\s\S]*?)\n  \};/)
    expect(m).toBeTruthy()
    expect(m[1]).toContain('apelotonada:')
    expect(m[1]).toContain("'nota-auditoria':")
  })

  it('un --cubo desconocido se rechaza en vez de devolver el cubo por defecto en silencio', () => {
    expect(SCRIPT).toMatch(/--cubo desconocido/)
  })

  it('el cubo por defecto sigue siendo el de explicaciones apelotonadas', () => {
    expect(SCRIPT).toMatch(/arg\('cubo', 'apelotonada'\)/)
  })

  it('el predicado de apelotonada no ha cambiado (>400 chars, sin salto, sin estructura)', () => {
    const m = SCRIPT.match(/apelotonada: sql`([\s\S]*?)`,/)
    expect(m).toBeTruthy()
    expect(m[1]).toContain('length(explanation) > 400')
    expect(m[1]).toContain("chr(10)")
    expect(m[1]).toContain('explanation_data IS NULL')
  })
})
