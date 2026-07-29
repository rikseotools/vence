// Tests del núcleo puro de detección de COSECHA (lib/security/harvestSignals.js).
//
// El caso que motiva el detector es real y está medido: el usuario anferbar987
// tuvo el contador de respondidas en 2 mientras se le servían 5.495 preguntas el
// 16/05/2026. El detector anterior (curl_scraping) miraba respondidas, así que
// veía "2" y no disparaba — de hecho no ha disparado nunca.

const { classifyHarvest, DEFAULTS } = require('../../lib/security/harvestSignals')

describe('classifyHarvest', () => {
  describe('el caso real que estaba invisible', () => {
    it('anferbar987 (5.495 servidas / 2 respondidas) se marca como crítico', () => {
      const r = classifyHarvest({ served: 5495, answered: 2, pageViews: 0, hasDevice: false })
      expect(r).not.toBeNull()
      expect(r.severity).toBe('critical')
      expect(r.kind).toBe('curl_scraping')
      expect(r.ratio).toBeLessThan(0.01)
    })

    it('el mismo perfil CON navegador se marca igual, pero como cosecha', () => {
      // Automatización sobre navegador real (Playwright) o extensión: hay huella
      // y page_views, así que no es "curl", pero el patrón sigue siendo cosecha.
      const r = classifyHarvest({ served: 5495, answered: 2, pageViews: 2035, hasDevice: true })
      expect(r.kind).toBe('harvest_no_answer')
      expect(r.severity).toBe('critical') // por volumen egregio
    })
  })

  describe('opositores reales: NO deben generar señal', () => {
    it('un usuario intenso que responde lo que se le sirve', () => {
      // Perfil medido en prod: ~100-200 preguntas/día respondiendo casi todo.
      expect(classifyHarvest({ served: 3000, answered: 2900, pageViews: 800, hasDevice: true })).toBeNull()
    })

    it('un usuario que abandona la mitad de los tests sigue estando lejos del umbral', () => {
      expect(classifyHarvest({ served: 1000, answered: 500, pageViews: 200, hasDevice: true })).toBeNull()
    })

    it('poco volumen no opina aunque el ratio sea 0 (evita el falso positivo del novato)', () => {
      // Alguien que carga un test de 20 preguntas y se va: ratio 0, pero no hay
      // materia para acusar a nadie.
      expect(classifyHarvest({ served: 20, answered: 0, pageViews: 0, hasDevice: false })).toBeNull()
    })

    it('justo por debajo del mínimo de volumen no dispara', () => {
      expect(classifyHarvest({ served: DEFAULTS.minServed - 1, answered: 0 })).toBeNull()
    })
  })

  // REGRESIÓN ESTRUCTURAL (27/07/2026). El denominador salía de
  // `daily_question_usage`, que solo se incrementa en el camino del LÍMITE DIARIO
  // — y los premium lo esquivan. Medido: 77 usuarios premium respondieron 5.598
  // preguntas ese día con el contador a 0. Resultado: TODO premium activo que
  // pasara de 300 servidas salía como cosechador. Caso real: violeta.adm11@ con
  // 309 servidas, contador 0 y 3.269 respuestas REALES.
  //
  // El detector no cambió: cambió DE DÓNDE se lee `answered` (ahora de
  // `test_questions`). Este test fija las dos caras de esa decisión.
  describe('el denominador tiene que ser el de las respuestas REALES', () => {
    it('con el conteo real, la premium activa NO genera señal', () => {
      expect(classifyHarvest({ served: 309, answered: 3269, pageViews: 900, hasDevice: true })).toBeNull()
    })

    it('con el contador roto (0) la habría marcado — por eso no se usa esa fuente', () => {
      const r = classifyHarvest({ served: 309, answered: 0, pageViews: 900, hasDevice: true })
      expect(r).not.toBeNull()
      expect(r.kind).toBe('harvest_no_answer')
    })
  })

  // REGRESIÓN ESTRUCTURAL #2 (28/07/2026), destapada triando las 2 PRIMERAS señales
  // reales del detector: ninguna cosechaba. Ambas eran altas nuevas que armaron
  // tests de ~100 preguntas y toparon el límite free de 25/día. Con ese tope, el
  // ratio es <= 0,25 POR CONSTRUCCIÓN — pegado al umbral de 0,2. El ratio bajo lo
  // causamos nosotros, así que cuando el usuario topa no se opina.
  describe('si el límite diario le capó las respuestas, no se opina', () => {
    it('mpareja19@ (300 servidas / 27 respondidas, contador a 25) NO genera señal', () => {
      expect(classifyHarvest({ served: 300, answered: 27, pageViews: 6, hasDevice: true, answerCapped: true })).toBeNull()
    })

    it('felixmurod@ (304 / 34, contador a 25) NO genera señal', () => {
      expect(classifyHarvest({ served: 304, answered: 34, pageViews: 43, hasDevice: true, answerCapped: true })).toBeNull()
    })

    it('el MISMO perfil sin haber topado SÍ genera señal (no se desactiva el detector)', () => {
      const r = classifyHarvest({ served: 300, answered: 27, pageViews: 6, hasDevice: true, answerCapped: false })
      expect(r).not.toBeNull()
      expect(r.kind).toBe('harvest_no_answer')
    })

    it('sin saber si topó, se opina como antes (no se asume exención)', () => {
      expect(classifyHarvest({ served: 300, answered: 27 })).not.toBeNull()
    })
  })

  describe('frontera del ratio', () => {
    it('justo en el umbral de ratio NO dispara (frontera cerrada por abajo)', () => {
      const served = 1000
      const r = classifyHarvest({ served, answered: served * DEFAULTS.maxAnswerRatio })
      expect(r).toBeNull()
    })

    it('justo por debajo del umbral SÍ dispara', () => {
      const served = 1000
      const r = classifyHarvest({ served, answered: served * DEFAULTS.maxAnswerRatio - 1 })
      expect(r).not.toBeNull()
      expect(r.kind).toBe('harvest_no_answer')
    })
  })

  // REGRESIÓN (27/07/2026). Hubo una señal `harvest_volume` que disparaba por
  // volumen suelto a partir de 5.000 servidas. Los datos reales la tumbaron: el
  // usuario más intenso de la plataforma respondió 4.897 preguntas en 30 días, a
  // un 2% de ese umbral, y las servidas siempre superan a las respondidas → habría
  // marcado como sospechosos a los opositores de pago más activos.
  describe('el volumen NO es señal por sí solo', () => {
    it('el usuario más intenso real (≈4.900 respondidas/30d) no genera señal', () => {
      // Servidas por encima de respondidas, como pasa siempre en la realidad.
      expect(classifyHarvest({ served: 6200, answered: 4897, pageViews: 1500, hasDevice: true })).toBeNull()
    })

    it('ni siquiera un volumen enorme con ratio sano genera señal', () => {
      expect(classifyHarvest({ served: 50000, answered: 48000, pageViews: 9000, hasDevice: true })).toBeNull()
    })

    it('pero el volumen SÍ agrava una cosecha ya detectada por ratio', () => {
      const pequeña = classifyHarvest({ served: 1000, answered: 0, pageViews: 50, hasDevice: true })
      const enorme = classifyHarvest({ served: 9000, answered: 0, pageViews: 50, hasDevice: true })
      expect(pequeña.severity).toBe('high')
      expect(enorme.severity).toBe('critical')
    })
  })

  describe('umbrales configurables (calibrables sin tocar código)', () => {
    it('subir minServed silencia un caso que con el default dispararía', () => {
      const caso = { served: 400, answered: 0, pageViews: 0, hasDevice: false }
      expect(classifyHarvest(caso)).not.toBeNull()
      expect(classifyHarvest(caso, { minServed: 1000 })).toBeNull()
    })
  })

  // ── Amplitud temporal (T-179, calibrado 29/07/2026) ────────────────────
  //
  // El detector produjo 4 señales en toda su vida y las 4 fueron falsos positivos.
  // Las 2 primeras (28/07) por el tope del plan free → `answerCapped`. Las 2 de
  // 29/07 NO las cubría esa exención: no topaban nada, respondieron 0 y 1. Eran
  // altas nuevas que probaron y se fueron.
  //
  // La distribución de 30 días lo confirmó: 29 usuarios bajo el ratio, 26 de ellos
  // con 1,1 días de actividad, 19 registrados hacía menos de una semana — y los 3
  // de más volumen eran nuestra propia cuenta de smoke tests y dos altas de 1-2
  // días. Ninguno cosechaba. Un día no es un patrón.
  describe('amplitud temporal: cosechar exige VOLVER', () => {
    it('leofabra50@ (real): 300 servidas y 0 respondidas en UN día → no se opina', () => {
      expect(
        classifyHarvest({ served: 300, answered: 0, pageViews: 13, hasDevice: false, activeDays: 1 }),
      ).toBeNull()
    })

    it('yolandamoyaparis@ (real): 300/1 en dos días → no se opina', () => {
      expect(
        classifyHarvest({ served: 300, answered: 1, pageViews: 16, hasDevice: true, activeDays: 2 }),
      ).toBeNull()
    })

    it('smoke@vence.es (real): nuestros propios canarios, 2.600/137 en 2 días → no se opina', () => {
      expect(
        classifyHarvest({ served: 2600, answered: 137, pageViews: 0, hasDevice: false, activeDays: 2 }),
      ).toBeNull()
    })

    it('el MISMO volumen sostenido en el tiempo SÍ es señal', () => {
      const r = classifyHarvest({ served: 600, answered: 4, pageViews: 5, hasDevice: true, activeDays: 12 })
      expect(r).not.toBeNull()
      expect(r.kind).toBe('harvest_no_answer')
    })

    it('el volumen egregio NO se libra por concentrarse en un día (anferbar987)', () => {
      // Si la amplitud eximiera siempre, bastaría con cosechar rápido para ser invisible.
      const r = classifyHarvest({ served: 5495, answered: 2, pageViews: 0, hasDevice: false, activeDays: 1 })
      expect(r).not.toBeNull()
      expect(r.severity).toBe('critical')
    })

    it('frontera exacta: 3 días opina, 2 no', () => {
      const base = { served: 600, answered: 4, pageViews: 5, hasDevice: true }
      expect(classifyHarvest({ ...base, activeDays: 3 })).not.toBeNull()
      expect(classifyHarvest({ ...base, activeDays: 2 })).toBeNull()
    })

    it('sin saber los días no penaliza (no inventa evidencia, igual que pageViews)', () => {
      expect(classifyHarvest({ served: 600, answered: 4, pageViews: 5, hasDevice: true })).not.toBeNull()
    })

    it('el umbral de días se puede ajustar por opts', () => {
      const caso = { served: 600, answered: 4, pageViews: 5, hasDevice: true, activeDays: 2 }
      expect(classifyHarvest(caso)).toBeNull()
      expect(classifyHarvest(caso, { minActiveDays: 2 })).not.toBeNull()
    })
  })

  describe('robustez: corre en un cron nocturno, no puede petar por un dato sucio', () => {
    it.each([
      [null],
      [undefined],
      [{}],
      [{ served: NaN, answered: NaN }],
      [{ served: -100, answered: -5 }],
      [{ served: 'muchas', answered: 'pocas' }],
    ])('no lanza con %p', (input) => {
      expect(() => classifyHarvest(input)).not.toThrow()
    })

    it('sin saber pageViews/hasDevice no penaliza (no inventa evidencia)', () => {
      const r = classifyHarvest({ served: 1000, answered: 0 })
      expect(r.kind).toBe('harvest_no_answer') // no lo llama curl sin pruebas
      expect(r.reasons).not.toContain('sin_dispositivo_ni_navegador')
    })
  })
})
