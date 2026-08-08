// __tests__/lib/clasificarHitos.test.ts
// Unit del clasificador REAL de producción (scripts/clasificar-hitos.cjs) — no una copia:
// una copia da falso verde cuando el código real cambia.
// Cada caso sale de un hito REAL de prod (16/07/2026), y varios son las regresiones que ya mordieron.
const { clasificar, NO_TOCAR_TIPO } = require('../../scripts/clasificar-hitos.cjs')

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

  test('"Celebración de los ejercicios" es el EXAMEN, no "otro" (así lo escriben las bases sin fecha)', () => {
    expect(h('Celebración de los ejercicios (fecha por determinar)').tipo).toBe('ejercicio_1')
    expect(h('Celebración de ejercicios').tipo).toBe('ejercicio_1')
    expect(h('Celebración de las pruebas selectivas').tipo).toBe('ejercicio_1')
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

  test('T-170 (07/08): "acumulación de plazas" es modificacion_plazas, no otro — 2 hitos reales en prod', () => {
    expect(h('Decreto de acumulación de plazas (9 → 17 plazas)').tipo).toBe('modificacion_plazas')
    expect(h('Acumulación de plazas (11 plazas)').tipo).toBe('modificacion_plazas')
  })

  test('T-170 (07/08): "designación del Tribunal" (orden inverso a "tribunal designado") es tribunal_constituido', () => {
    expect(h('Designación del Tribunal de selección').tipo).toBe('tribunal_constituido')
  })

  test('T-170 (07/08): un adjetivo entre el verbo y "plazo" no rompe el match — "el NUEVO plazo"', () => {
    expect(h('Cierre del nuevo plazo de solicitudes').tipo).toBe('plazo_fin')
    expect(h('Apertura de nuevo plazo de solicitudes').tipo).toBe('plazo_inicio')
  })

  test('T-170 (07/08): "cerrado" AL FINAL del título también es plazo_fin, no solo "cierre" al principio', () => {
    expect(h('Plazo de inscripción cerrado').tipo).toBe('plazo_fin')
    expect(h('Plazo de solicitudes (19/06–16/07/2026) cerrado').tipo).toBe('plazo_fin')
  })

  test('T-170 (07/08): "relación de aprobados" es resultados, no ejercicio_1 (perdía contra "fase de oposición")', () => {
    expect(h('Relación de aprobados (fase de oposición)').tipo).toBe('resultados')
    expect(h('Relación de aprobados y apertura de autobaremo').tipo).toBe('resultados')
    // acotado a la frase completa: "aprobados" suelto sigue sin disparar resultados por sí solo
    expect(h('Aprobados fase de oposición').tipo).not.toBe('resultados')
  })

  test('REGRESIÓN T-170: el ensanche de plazo_fin/plazo_inicio no se come lo que ya acertaba', () => {
    // Estos 3 SOLO clasifican bien vía el fallback genérico de plazo_inicio (sin "apertura" ni
    // "inicio" en el título) — el fix no podía tocarlo sin romper esto.
    expect(h('Plazo de presentación de solicitudes').tipo).toBe('plazo_inicio')
    expect(h('Plazo de solicitudes').tipo).toBe('plazo_inicio')
    // Y "cerrado"/"finalizad" en otro contexto no debe disparar plazo_fin por casualidad.
    expect(h('Proceso finalizado, en fase de nombramientos').tipo).not.toBe('plazo_fin')
  })

  test('REGRESIÓN T-170 (08/08, revisión): "Nombramiento del Tribunal Calificador" es tribunal_constituido, no nombramientos', () => {
    // Encontrado en revisión: con `nombramientos` antes que `tribunal_constituido` en el array,
    // "Nombramiento del Tribunal Calificador" ganaba por orden de prioridad, no por precisión —
    // pese a que tribunal_constituido TAMBIÉN casaba (su patrón incluye "tribunal...nombrad").
    // Caso real ddb30ace: BD ya lo tenía como tribunal_constituido (tipado a mano correctamente,
    // con cita_literal "se nombra el Tribunal Calificador") y la regla vieja lo habría degradado.
    expect(h('Nombramiento del Tribunal Calificador').tipo).toBe('tribunal_constituido')
    expect(h('Nombramiento de tribunales calificadores').tipo).toBe('tribunal_constituido')
    // Y un nombramiento de PERSONAS (sin "tribunal"/"comisión" cerca) sigue siendo nombramientos.
    expect(h('Nombramiento de funcionarios en prácticas').tipo).toBe('nombramientos')
    expect(h('Toma de posesión').tipo).toBe('nombramientos')
  })
})

describe('clasificar-hitos — NO_TOCAR_TIPO (T-170, 08/08)', () => {
  test('exporta un Map, no un array — el CLI hace NO_TOCAR_TIPO.has(id) por id, no un .includes()', () => {
    expect(NO_TOCAR_TIPO).toBeInstanceOf(Map)
  })

  test('los 9 ids adjudicados a mano en la revisión están todos en la lista, con su motivo', () => {
    const ids = [
      'ddb30ace-b100-43d6-ab3f-2f9dd43e0983', // tribunal_constituido correcto (el caso que probó el bug)
      '66adf612-8ba1-4b72-a33a-7332afc38e27', // nombramientos, pérdida de precisión si se aplica
      '49c140f3-2baa-42eb-92cc-4211a216e4d5', // corrección de bases, ambiguo
      '8f72b566-d931-424b-96d0-e5d7d53ae7c3', // corrección de bases, ambiguo
      '8d17ab33-9bb8-4f70-967a-06bbc7a73c80', // corrección de bases, ambiguo
      '053db338-9087-40d7-801d-ac417869da95', // convocatoria y bases, ambiguo
      '6625a7e3-dd39-4d6a-9339-24ef3fd9996e', // convocatoria y bases, ambiguo
      'd0294f39-4292-4e66-993d-d9f88aeef9e5', // título/descripción contradictorios
      'ecf88a05-c271-4fb2-9a66-73e937734149', // tecnico-informatica, ya documentado en la ficha
    ]
    for (const id of ids) {
      expect(NO_TOCAR_TIPO.has(id)).toBe(true)
      expect(typeof NO_TOCAR_TIPO.get(id)).toBe('string')
      expect(NO_TOCAR_TIPO.get(id)!.length).toBeGreaterThan(20) // un motivo real, no un sello
    }
    expect(NO_TOCAR_TIPO.size).toBe(9)
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
