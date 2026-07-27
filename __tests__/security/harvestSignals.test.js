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
