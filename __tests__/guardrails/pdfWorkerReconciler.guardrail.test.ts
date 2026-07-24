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
