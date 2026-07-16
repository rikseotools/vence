// __tests__/lib/clasificarHitos.test.ts
// Unit del clasificador REAL de producción (scripts/clasificar-hitos.cjs) — no una copia:
// una copia da falso verde cuando el código real cambia.
// Cada caso sale de un hito REAL de prod (16/07/2026), y varios son las regresiones que ya mordieron.
const { clasificar } = require('../../scripts/clasificar-hitos.cjs')

const h = (titulo: string, descripcion = '', url: string | null = null) => clasificar({ titulo, descripcion, url })

describe('clasificar-hitos — tipo', () => {
  test('vocabulario básico', () => {
    expect(h('Apertura del plazo de inscripción').tipo).toBe('plazo_inicio')
    expect(h('Cierre del plazo de inscripción').tipo).toBe('plazo_fin')
    expect(h('Primer ejercicio').tipo).toBe('ejercicio_1')
    expect(h('Lista provisional de admitidos y excluidos').tipo).toBe('lista_provisional')
    expect(h('Lista definitiva de admitidos').tipo).toBe('lista_definitiva')
    expect(h('Publicación de bases').tipo).toBe('bases_publicadas')
  })

  test('las 7 grafías de "cierre del plazo" colapsan en plazo_fin', () => {
    for (const t of ['Cierre del plazo de inscripción', 'Cierre plazo de inscripción',
                     'Fin plazo de solicitudes', 'Fin plazo de inscripción',
                     'Cierre del plazo de solicitudes', 'Fin del plazo de solicitudes',
                     'Fin del plazo de inscripción']) {
      expect(h(t).tipo).toBe('plazo_fin')
    }
  })

  test('REGRESIÓN: "OEP aprobada" es oep_aprobada, NO resultados (el comodín /aprobad/ se la comía: 42 hitos mal)', () => {
    expect(h('OEP 2025 aprobada (BORM nº 292, 19/12/2025)').tipo).toBe('oep_aprobada')
    expect(h('Oferta de empleo público aprobada').tipo).toBe('oep_aprobada')
    expect(h('Aprobación OEP 2025 CAIB').tipo).toBe('oep_aprobada')
    // y resultados sigue funcionando
    expect(h('Resultados del primer ejercicio').tipo).toBe('resultados')
    expect(h('Relación de aspirantes que superan la fase de oposición').tipo).toBe('resultados')
  })

  test('REGRESIÓN: multiidioma (catalán en prod) — sin esto "Tancament" caía a otro', () => {
    expect(h("Tancament del termini d'inscripció").tipo).toBe('plazo_fin')
    expect(h('Fi termini de sol·licituds').tipo).toBe('plazo_fin')
    expect(h('Inici termini de sol·licituds').tipo).toBe('plazo_inicio')
    expect(h("Llista provisional d'admesos i exclosos").tipo).toBe('lista_provisional')
    expect(h("Llista definitiva d'admesos i exclosos").tipo).toBe('lista_definitiva')
    expect(h('Publicació de la convocatòria al DOGC').tipo).toBe('convocatoria_publicada')
  })

  test('los 4 tipos que el dato tenía y el borrador a ojo NO', () => {
    expect(h('Reconocimiento médico').tipo).toBe('reconocimiento_medico')
    expect(h('Tribunal designado').tipo).toBe('tribunal_constituido')
    expect(h('Plantilla provisional, cuestionario y plazo de alegaciones').tipo).toBe('plantilla_respuestas')
    expect(h('Ampliación plazas discapacidad (BOP 206)').tipo).toBe('modificacion_plazas')
    expect(h('Nombramientos').tipo).toBe('nombramientos')   // se cayó del CHECK y abortó el 1er backfill
  })

  test('lo que no casa cae a otro, no revienta', () => {
    expect(h('Nota informativa').tipo).toBe('otro')
    expect(h('Adaptaciones para personas con discapacidad').tipo).toBe('otro')
  })
})

describe('clasificar-hitos — origen (registro | inferencia | estimacion)', () => {
  test('por defecto, un hito es registro', () => {
    expect(h('Cierre del plazo de inscripción').origen).toBe('registro')
  })

  test('una previsión SIN documento es estimacion (legítima: hay que vender sin datos)', () => {
    expect(h('Examen (previsión)', 'Fecha sin fijar; previsión otoño 2026.').origen).toBe('estimacion')
    expect(h('Próxima convocatoria (pendiente de nueva OEP)').origen).toBe('estimacion')
  })

  test('derivar de una REGLA de las bases es inferencia, no estimación', () => {
    expect(h('Ejercicio único (previsión)',
      'El ejercicio no podrá comenzar hasta transcurridos 2 meses desde el fin del plazo de solicitudes.').origen)
      .toBe('inferencia')
    expect(h('Pruebas pendientes de fecha',
      'Los tribunales publicarán fecha de examen con un mínimo de 72h de antelación.').origen)
      .toBe('inferencia')
  })

  test('REGRESIÓN: si cita boletín con identificador es REGISTRO aunque diga "pendiente" (24 mal clasificados)', () => {
    expect(h('OEP 2025 aprobada (BORM nº 292, 19/12/2025)',
      'Oferta de Empleo Público 2025 de la CARM (Decreto 233/2025). Convocatoria pendiente.').origen)
      .toBe('registro')
    expect(h('Convocatoria 2026 publicada (BOCM · Orden 1634/2026)', 'Examen pendiente de fecha').origen)
      .toBe('registro')
  })

  test('con url, es registro aunque el texto suene a previsión', () => {
    expect(h('Examen previsto', 'pendiente de confirmar', 'https://boe.es/x').origen).toBe('registro')
  })

  test('precisión ≠ procedencia: una fecha aproximada puede ser OFICIAL (el bug de Marta)', () => {
    // "mayo de 2027" viene literal de la base 9 → registro, aunque sea aproximada.
    // La aproximación se marca en fecha_aproximada, NO en origen.
    expect(h('Primer ejercicio', 'La celebración se realizará en mayo de 2027 según la base 9.').origen)
      .toBe('registro')
  })
})
