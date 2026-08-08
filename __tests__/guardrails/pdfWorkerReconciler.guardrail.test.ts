// Guardarraíl del RECONCILIADOR de PDFs del temario (auto-curado ante bump de plantilla).
// Sin BD: lee el código y afirma los dos invariantes de los que depende el auto-curado. Si alguien
// los rompe (quita la versión de la firma, o desconecta el reconcile del drain), los PDFs grandes
// volverían a quedar colgados tras un cambio de formato (bug real Nila, 24/07).
import fs from 'fs'
import path from 'path'

const worker = fs.readFileSync(path.join(process.cwd(), 'scripts/pdf-worker.ts'), 'utf8')

describe('pdf-worker — reconciliador auto-curable', () => {
  it('la firma de encolado INCLUYE PDF_TEMPLATE_VERSION (un bump de plantilla re-encola → regenera)', () => {
    expect(worker).toMatch(/import\s*\{[^}]*PDF_TEMPLATE_VERSION[^}]*\}\s*from\s*'@\/lib\/temario\/pdf\/pdfCache'/)
    // la firma usa la versión, no solo el tamaño
    expect(worker).toMatch(/sweep:\$\{PDF_TEMPLATE_VERSION\}:/)
  })

  it('el encolado es IDEMPOTENTE por firma exacta en CUALQUIER estado (evita churn del worker)', () => {
    // comprueba existencia antes de encolar (el índice _alive_uq solo cubre vivos → un done no frena)
    expect(worker).toMatch(/content_hash\s*=\s*\$\{sig\}/)
  })

  it('el comando `drain` RECONCILIA antes de drenar (auto-curado cada ciclo del worker programado)', () => {
    // en la rama de 'drain' se llama a cmdEnqueueBig antes de cmdDrain
    const drainBranch = worker.slice(worker.indexOf("cmd === 'drain'"))
    const enqIdx = drainBranch.indexOf('cmdEnqueueBig')
    const drainIdx = drainBranch.indexOf('cmdDrain')
    expect(enqIdx).toBeGreaterThan(-1)
    expect(drainIdx).toBeGreaterThan(-1)
    expect(enqIdx).toBeLessThan(drainIdx) // reconcile ANTES de drenar
  })
})

// El backfill de población (T-159 pieza (c), 06/08/2026): sembrar el catálogo SOLO donde hay
// alumnos, un comando MANUAL de una vez, no un reconciliador. Mismo defecto que se quiere evitar
// que el de arriba: si alguien lo cablea sin querer en el ciclo de 30 min, cada tick pagaría el
// barrido de cientos de temas de las oposiciones más pobladas para nada — la firma lo haría
// idempotente (no re-renderizaría), pero la CONSULTA de población/temas no es gratis.
describe('pdf-worker — seed-poblacion es un backfill MANUAL, no un reconciliador', () => {
  it('la firma de siembra también incluye PDF_TEMPLATE_VERSION (auto-cura ante bump de plantilla)', () => {
    expect(worker).toMatch(/seed:\$\{PDF_TEMPLATE_VERSION\}/)
  })

  it('filtra por PT_TO_SLUG — no encola una oposición sin slug conocido', () => {
    const fnBody = worker.slice(worker.indexOf('async function cmdSeedPoblacion'), worker.indexOf('async function cmdEnqueueBig'))
    expect(fnBody).toMatch(/PT_TO_SLUG\[pt\]/)
  })

  it('`seed-poblacion` es un comando CLI explícito y distinto de `drain`/`enqueue-big`', () => {
    expect(worker).toMatch(/cmd === 'seed-poblacion'/)
    expect(worker).toMatch(/uso:.*seed-poblacion/)
  })

  it('NO se llama desde la rama de `drain` — es manual, no un reconciliador de cada ciclo', () => {
    const drainBranch = worker.slice(worker.indexOf("cmd === 'drain'"), worker.indexOf("cmd === 'stats'"))
    expect(drainBranch).not.toMatch(/cmdSeedPoblacion/)
  })

  it('está definido ANTES de `cmdEnqueueBig` y usa el mismo patrón de idempotencia (existing.n)', () => {
    const fnBody = worker.slice(worker.indexOf('async function cmdSeedPoblacion'), worker.indexOf('async function cmdEnqueueBig'))
    expect(fnBody).toMatch(/content_hash = \$\{sig\}/)
    expect(fnBody).toMatch(/existing\[0\]\?\.n/)
  })
})
