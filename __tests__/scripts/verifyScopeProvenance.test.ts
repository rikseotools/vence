/**
 * `conFuenteDeclarada()`/`esFuenteConcreta()` — provenance del veredicto del Paso 2 (T-334,
 * 07/08/2026).
 *
 * La asimetría real: para marcar un epígrafe LITERAL (Paso 1) hace falta `source_documento_id`
 * — un documento clonado en el hub. Para marcar un `topic_scope` como `verified_correct`
 * (Paso 2), `record_topic_verification` acepta CUALQUIER `findings` y lo da por bueno. Caso
 * real que lo destapó: `auxiliar_administrativo_sms` T15/T16 se sellaron `verified_correct`
 * con una nota nunca contrastada contra el BOE, y resultó falsa (T-332) — nada distinguía
 * «lo comprobé» de «me lo creí» porque las dos notas tenían la misma forma.
 *
 * LÍMITE HONESTO: esto es autocertificación. `conFuenteDeclarada` no puede demostrar que se
 * consultó el BOE de verdad — solo garantiza que la AUSENCIA de fuente quede escrita y sea
 * contable (`fuente: 'razonado'`) en vez de indistinguible de un veredicto con respaldo real.
 */
const path = require('path')
const { conFuenteDeclarada, esFuenteConcreta, FUENTE_POR_DEFECTO } = require(path.join(process.cwd(), 'scripts/verify-topic-scope.cjs'))

describe('conFuenteDeclarada()', () => {
  it('sin fuente declarada, añade el valor honesto "razonado" — nunca la deja en blanco', () => {
    expect(conFuenteDeclarada({ note: 'texto' })).toEqual({ note: 'texto', fuente: FUENTE_POR_DEFECTO })
  })

  it('NO pisa una fuente que el llamante SÍ declaró', () => {
    expect(conFuenteDeclarada({ fuente: 'BOE-A-2017-12902', note: 'x' }))
      .toEqual({ fuente: 'BOE-A-2017-12902', note: 'x' })
  })

  it('acepta un valor por defecto propio (caso pipeline apply, T-334)', () => {
    expect(conFuenteDeclarada({ note: 'x' }, 'pipeline_verify_scope_apply'))
      .toEqual({ note: 'x', fuente: 'pipeline_verify_scope_apply' })
  })

  it('findings null/undefined no revienta: se trata como objeto vacío', () => {
    expect(conFuenteDeclarada(null)).toEqual({ fuente: FUENTE_POR_DEFECTO })
    expect(conFuenteDeclarada(undefined)).toEqual({ fuente: FUENTE_POR_DEFECTO })
  })

  it('una fuente vacía o solo espacios cuenta como NO declarada', () => {
    expect(conFuenteDeclarada({ fuente: '' })).toEqual({ fuente: FUENTE_POR_DEFECTO })
    expect(conFuenteDeclarada({ fuente: '   ' })).toEqual({ fuente: FUENTE_POR_DEFECTO })
  })

  it('no muta el objeto original (devuelve uno nuevo)', () => {
    const original = { note: 'x' }
    const resultado = conFuenteDeclarada(original)
    expect(original).toEqual({ note: 'x' })
    expect(resultado).not.toBe(original)
  })
})

describe('esFuenteConcreta()', () => {
  it('"razonado" (el valor por defecto) NO es una fuente concreta', () => {
    expect(esFuenteConcreta(FUENTE_POR_DEFECTO)).toBe(false)
  })

  it('un id de BOE, un documento del hub, o el nombre del pipeline SÍ lo son', () => {
    expect(esFuenteConcreta('BOE-A-2017-12902')).toBe(true)
    expect(esFuenteConcreta('pipeline_verify_scope_apply')).toBe(true)
  })

  it('vacío, null o undefined no son fuente concreta', () => {
    expect(esFuenteConcreta('')).toBe(false)
    expect(esFuenteConcreta('   ')).toBe(false)
    expect(esFuenteConcreta(null)).toBe(false)
    expect(esFuenteConcreta(undefined)).toBe(false)
  })
})
