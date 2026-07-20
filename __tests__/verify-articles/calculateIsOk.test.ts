// Badge de «Monitoreo» — qué enciende el aviso de discrepancia de una ley.
//
// El riesgo de este código no es que falle: es que se vuelva PERMISIVO. Si se le añaden
// exoneraciones a la ligera, el badge se apaga y deja de avisar de contenido que no coincide
// con el boletín oficial. El caso real del 13/07 (5 leyes con boe_count=0 que parecían falsos
// positivos y escondían 4 discrepancias reales + un boe_url apuntando a otra ley) es la razón
// por la que estas garantías están fijadas en tests.
import { calculateIsOk } from '@/lib/api/verify-articles/ai-helpers'

const OK = { boe_count: 10, db_count: 10, matching: 10, title_mismatch: 0, content_mismatch: 0, missing_in_db: 0, extra_in_db: 0 }

describe('calculateIsOk — lo que NUNCA se puede exonerar', () => {
  it('boe_count=0 siempre enciende el badge, aunque venga marcado como quirk conocido', () => {
    // Un 0 suele ser un fallo transitorio de descarga que ENMASCARA discrepancias reales.
    expect(calculateIsOk({ ...OK, boe_count: 0 })).toBe(false)
    expect(calculateIsOk({ ...OK, boe_count: 0, known_quirk: true })).toBe(false)
    expect(calculateIsOk({ ...OK, boe_count: 0, deliberate_subset: true, subset_note: 'lo que sea' })).toBe(false)
  })

  it('una discrepancia de CONTENIDO no se apaga con ningún flag', () => {
    // Que un artículo que SÍ tenemos diga algo distinto del boletín es siempre un defecto.
    for (const flags of [{}, { known_quirk: true }, { deliberate_subset: true, subset_note: 'x' }]) {
      expect(calculateIsOk({ ...OK, content_mismatch: 1, ...flags })).toBe(false)
      expect(calculateIsOk({ ...OK, title_mismatch: 1, ...flags })).toBe(false)
    }
  })

  it('"No se encontraron artículos" enciende el badge', () => {
    expect(calculateIsOk({ ...OK, message: 'No se encontraron artículos' })).toBe(false)
  })

  it('sin resumen, se considera NO ok (no se asume lo mejor)', () => {
    expect(calculateIsOk(null)).toBe(false)
  })
})

describe('calculateIsOk — import parcial deliberado', () => {
  // Motivo: hay leyes importadas a propósito en parte (del TRLPI solo los 30 artículos que
  // examina auxiliar_biblioteca_estado, de 212). Sin poder declararlo encendían el badge para
  // siempre, y un badge siempre encendido no avisa de nada.

  it('artículos que faltan SIN declarar → enciende el badge', () => {
    expect(calculateIsOk({ ...OK, missing_in_db: 5 })).toBe(false)
  })

  it('declarado con justificación escrita → no enciende', () => {
    expect(calculateIsOk({
      ...OK, missing_in_db: 182,
      deliberate_subset: true,
      subset_note: 'auxiliar_biblioteca_estado T10 escopa 30 arts explícitos de 212.',
    })).toBe(true)
  })

  it('el flag SIN justificación NO vale (no es un interruptor de apagar badges)', () => {
    expect(calculateIsOk({ ...OK, missing_in_db: 5, deliberate_subset: true })).toBe(false)
    expect(calculateIsOk({ ...OK, missing_in_db: 5, deliberate_subset: true, subset_note: '   ' })).toBe(false)
  })

  it('la justificación SIN el flag tampoco vale (debe ser una decisión explícita)', () => {
    expect(calculateIsOk({ ...OK, missing_in_db: 5, subset_note: 'es a propósito' })).toBe(false)
  })

  it('declarar subset NO tapa una discrepancia de contenido que venga con él', () => {
    // El caso peligroso: "es parcial a propósito" usado para colar contenido divergente.
    expect(calculateIsOk({
      ...OK, missing_in_db: 100, content_mismatch: 3,
      deliberate_subset: true, subset_note: 'parcial a propósito',
    })).toBe(false)
  })
})

describe('calculateIsOk — casos que sí están bien', () => {
  it('una ley que coincide del todo', () => {
    expect(calculateIsOk(OK)).toBe(true)
  })

  it('sin texto consolidado (no hay con qué comparar)', () => {
    expect(calculateIsOk({ no_consolidated_text: true })).toBe(true)
  })

  it('known_quirk sigue cubriendo el residual de extra_in_db', () => {
    // Artefacto del extractor: cuenta la nota de supresión de un apartado como artículo extra.
    expect(calculateIsOk({ ...OK, extra_in_db: 1 })).toBe(false)
    expect(calculateIsOk({ ...OK, extra_in_db: 1, known_quirk: true })).toBe(true)
  })

  it('los artículos de estructura (art. 0) no cuentan como sobrantes', () => {
    expect(calculateIsOk({ ...OK, extra_in_db: 1, structure_articles: 1 })).toBe(true)
  })
})
