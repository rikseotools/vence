// T-256 — ¿el `origen` de un hito dice la verdad?
//
// Importa: `origen` NO es documentación, el RENDER decide con él. Un hito `registro` se MUESTRA
// al opositor como fecha oficial; uno `estimacion` se oculta. Medido: 642 de 960 `registro` sin
// ninguna fuente, y un caso verificado contra dos fuentes (Huesca) donde la fecha de examen que
// enseñamos NO existe en ningún boletín.
//
// Lo que estos tests protegen NO es la degradación: es la CONTENCIÓN. «Sin respaldo» no es
// «inventada» —muchos cierres de plazo derivan de `inscription_deadline`, que sí está
// verificado—, así que degradar en bloque cambiaría un error por otro. Solo se degrada solo lo
// que se contradice a sí mismo; el resto exige verificación humana.

const { clasificarHito, tieneRespaldo, esFechaDeExamen } = require('@/lib/convocatoria/hitoOrigen.js')

const base = {
  titulo: 'Primer ejercicio (examen)',
  origen: 'registro',
  url: null,
  cita_literal: null,
  source_documento_id: null,
}

describe('tieneRespaldo — cualquiera de las tres vale', () => {
  it('sin nada → no hay respaldo', () => {
    expect(tieneRespaldo(base)).toBe(false)
  })

  it('una url basta', () => {
    expect(tieneRespaldo({ ...base, url: 'https://www.boe.es/…' })).toBe(true)
  })

  it('una cita literal basta', () => {
    expect(tieneRespaldo({ ...base, cita_literal: 'el primer ejercicio se celebrará…' })).toBe(true)
  })

  it('un documento clonado basta', () => {
    expect(tieneRespaldo({ ...base, source_documento_id: 'uuid-doc' })).toBe(true)
  })

  it('cadenas vacías o en blanco NO son respaldo', () => {
    expect(tieneRespaldo({ ...base, url: '', cita_literal: '   ' })).toBe(false)
  })
})

describe('clasificarHito — qué se puede tocar sin ir al boletín', () => {
  it('el caso REAL de Huesca: registro, sin respaldo y sin confesar → NO se toca solo', () => {
    // Verificado contra dos fuentes que no publican fecha, pero eso lo sabe la PERSONA, no el
    // código: el módulo no puede inferirlo, así que exige verificación explícita.
    const r = clasificarHito(base)
    expect(r.accion).toBe('requiere_fuente')
    expect(r.motivo).toMatch(/verificar contra su bolet/i)
  })

  it('el que se contradice solo SÍ se degrada sin investigar', () => {
    const r = clasificarHito({ ...base, titulo: 'Examen (previsión, pendiente de fecha oficial)' })
    expect(r.accion).toBe('degradar')
    expect(r.motivo).toMatch(/se contradice/i)
  })

  it('reconoce las otras formas de confesar una previsión', () => {
    for (const t of [
      'Primer ejercicio (previsión)',
      'Examen estimado',
      'Fecha orientativa del ejercicio',
      'Resolución aproximada',
    ]) {
      expect(clasificarHito({ ...base, titulo: t }).accion).toBe('degradar')
    }
  })

  it('con respaldo NO se toca, aunque el título hable de previsión', () => {
    const r = clasificarHito({
      ...base,
      titulo: 'Examen (previsión)',
      cita_literal: 'las bases prevén su celebración en noviembre',
    })
    expect(r.accion).toBe('dejar')
    expect(r.motivo).toMatch(/CON respaldo/)
  })

  it('lo que ya es `estimacion` no se vuelve a tocar (el render ya no lo vende como oficial)', () => {
    expect(clasificarHito({ ...base, origen: 'estimacion' }).accion).toBe('dejar')
    expect(clasificarHito({ ...base, origen: 'inferencia' }).accion).toBe('dejar')
  })

  it('entradas basura no provocan una degradación', () => {
    expect(clasificarHito(null).accion).toBe('dejar')
    expect(clasificarHito({}).accion).toBe('dejar')
    expect(clasificarHito({ origen: 'inventado' }).accion).toBe('dejar')
  })

  // La contención, dicha como invariante: NADA que no se autodelate se degrada por sí solo.
  it('INVARIANTE: solo se degrada solo lo autocontradictorio', () => {
    const casos = [
      { ...base, titulo: 'Fin del plazo de inscripción' },
      { ...base, titulo: 'Publicación de las bases' },
      { ...base, titulo: 'Primer ejercicio (examen)' },
      { ...base, titulo: 'Segundo ejercicio (supuestos prácticos)' },
    ]
    for (const c of casos) expect(clasificarHito(c).accion).toBe('requiere_fuente')
  })
})

describe('esFechaDeExamen — para priorizar lo que más daño hace', () => {
  it('reconoce ejercicios, exámenes y pruebas', () => {
    expect(esFechaDeExamen({ titulo: 'Primer ejercicio (examen)' })).toBe(true)
    expect(esFechaDeExamen({ titulo: 'Prueba de ofimática' })).toBe(true)
  })

  it('un cierre de plazo no es una fecha de examen', () => {
    expect(esFechaDeExamen({ titulo: 'Fin del plazo de inscripción' })).toBe(false)
  })
})

describe('cableado: el escritor usa el núcleo puro y no decide por su cuenta', () => {
  const { readFileSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const script = readFileSync(
    join(__dirname, '..', '..', '..', 'scripts/convocatoria/degradar-origen-hito.cjs'),
    'utf8',
  )

  it('importa la clasificación del módulo compartido', () => {
    expect(script).toMatch(/require\('\.\.\/\.\.\/lib\/convocatoria\/hitoOrigen\.js'\)/)
    expect(script).toMatch(/clasificarHito\(f\)/)
  })

  it('es dry-run por defecto (solo escribe con --apply)', () => {
    expect(script).toMatch(/const APPLY = has\('--apply'\)/)
    expect(script).toMatch(/if \(!APPLY\)/)
  })

  it('escribe UN solo campo: no es una puerta genérica a la tabla', () => {
    const updates = script.match(/UPDATE convocatoria_hitos SET [^`]+/g) || []
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatch(/SET origen = 'estimacion'/)
  })

  it('RELEE tras escribir (un WHERE que no casa se leería como éxito)', () => {
    expect(script).toMatch(/SELECT origen FROM convocatoria_hitos WHERE id/)
  })

  it('deja traza del éxito Y del rechazo', () => {
    expect(script).toMatch(/hito_origen_degradado/)
    expect(script).toMatch(/rechazo: 'sin_verificacion'/)
  })
})
