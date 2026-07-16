/**
 * Aviso de explicación CRUZADA en validar-explicacion.cjs (manual §8.1-ter).
 *
 * Qué defiende: una explicación puede tener la clave correcta, el artículo correcto y el formato
 * §5.1 perfecto, y aun así analizar las opciones de OTRA pregunta. El check de coherencia del
 * validador solo mira la opción marcada CORRECTA, así que ese caso pasa limpio — es lo que ocurrió
 * con `def2efab` (Defensor del Pueblo, impugnación 16/07/2026): 4 verificaciones Sonnet seguidas le
 * dieron `explanation_ok=true` porque `isDidactic()` solo comprueba formato.
 *
 * Por qué es AVISO y no error (y por qué este test lo fija así): la señal léxica tiene ~20% de
 * precisión (barrido 16/07: 442 candidatas por solape ~0 → 89 cruzadas reales). Los casos de
 * "paráfrasis legítima" de abajo son reales y salen marcados: es ruido ACEPTADO a cambio de cazar
 * la clase de defecto, y por eso no puede bloquear. Si alguien convierte esto en `problems`,
 * frenará explicaciones correctas (§15.8: un verificador que tumba lo bueno es peor que inútil).
 */

const path = require('path')
const { checkCorrespondence, explanationBlocks } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

describe('checkCorrespondence — caza explicaciones cruzadas', () => {
  test('CASO REAL def2efab: explicación que rebate opciones inexistentes → avisa', () => {
    // Opciones reales de la pregunta del Defensor del Pueblo (clave B).
    const opts = {
      A: 'Podrá ser detenido en el transcurso de una investigación por delito contra las instituciones del Estado cuando se hayan acumulado los indicios suficientes a criterio de la Autoridad Judicial.',
      B: 'Corresponde la decisión sobre su inculpación, prisión, procesamiento y juicio exclusivamente a la Sala de lo Penal del Tribunal Supremo.',
      C: 'Su gestión goza de independencia no debiendo dar cuentas a nadie.',
      D: 'Será elegido por el Congreso y nombrado por el Rey.',
    }
    // La explicación que estaba en producción: analiza juzgado de instrucción / Pleno TS /
    // Audiencia Nacional — nada de eso figura en las opciones.
    const expl = [
      '**Por qué B es correcta:** El art. 6.3 atribuye en exclusiva a la Sala de lo Penal del TS.',
      '',
      '**Por qué las demás son incorrectas:**',
      '- **A)** No corresponde a cualquier juzgado de instrucción; el Defensor está aforado ante el TS.',
      '- **C)** No corresponde al Pleno del Tribunal Supremo sino específicamente a la Sala de lo Penal.',
      '- **D)** La Audiencia Nacional no es competente; la competencia es del Tribunal Supremo.',
    ].join('\n')

    expect(checkCorrespondence(expl, opts, 'B')).toHaveLength(1)
  })

  test('explicación que SÍ rebate sus opciones → no avisa', () => {
    const opts = {
      A: 'El plazo de subsanación es de diez días hábiles.',
      B: 'El plazo de subsanación es de quince días hábiles.',
      C: 'No existe trámite de subsanación en el procedimiento.',
      D: 'La subsanación corresponde siempre al órgano superior jerárquico.',
    }
    const expl = [
      '**A) INCORRECTA** — El plazo de subsanación no es de diez días hábiles.',
      '',
      '**B) CORRECTA** — El artículo fija quince días hábiles.',
      '',
      '**C) INCORRECTA** — Sí existe trámite de subsanación en el procedimiento.',
      '',
      '**D) INCORRECTA** — La subsanación no corresponde al órgano superior jerárquico.',
    ].join('\n')

    expect(checkCorrespondence(expl, opts, 'B')).toHaveLength(0)
  })

  test('un solo distractor parafraseado NO dispara el aviso (evita ruido)', () => {
    const opts = {
      A: 'Corresponde al Consejo de Ministros.',
      B: 'Corresponde al Ministro competente.',
      C: 'Corresponde a la Comisión Delegada.',
    }
    const expl = [
      '**A) INCORRECTA** — no es ese órgano colegiado, sino el titular del departamento.', // sin solape
      '',
      '**B) CORRECTA** — corresponde al Ministro competente.',
      '',
      '**C) INCORRECTA** — la Comisión Delegada no ostenta esa atribución.', // sí solapa
    ].join('\n')

    expect(checkCorrespondence(expl, opts, 'B')).toHaveLength(0)
  })

  test('el aviso NO puede bloquear: es warning, nunca problem (§15.8)', () => {
    // Contrato del módulo: checkCorrespondence devuelve avisos aparte de validateFormat/
    // validateQuotes. El CLI los imprime como "AVISO (no bloquea)" y no altera el exit code.
    const src = require('fs').readFileSync(
      path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs'), 'utf8'
    )
    expect(src).toMatch(/AVISO \(no bloquea\)/)
    // el exit 1 depende SOLO de problems
    expect(src).toMatch(/if \(problems\.length === 0\)/)
    expect(src).not.toMatch(/problems\.push\([^)]*CRUZADA/)
  })
})

describe('explanationBlocks — troceo por opción', () => {
  test('separa los bloques A/B/C/D en ambos formatos (bullet y negrita)', () => {
    const b = explanationBlocks('- **A)** uno\n- **B)** dos\n**C) INCORRECTA** tres')
    expect(Object.keys(b).sort()).toEqual(['A', 'B', 'C'])
    expect(b.A).toContain('uno')
    expect(b.C).toContain('tres')
  })
})
