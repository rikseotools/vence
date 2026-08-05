// __tests__/lib/db/negocioSoloLectura.test.ts
//
// T-115/T-539: varios scripts de la campaña de huérfanos (huerfanos-plan.cjs,
// verificar-articulos-vs-boe.cjs…) leían `DATABASE_URL` directamente del fichero
// `.env.local`, ignorando `process.env`. Con el rol de coordinación de la flota
// (T-539) restringido a 4 tablas, esos scripts quedaban inservibles para un
// trabajador aunque tuviera `VENCE_LECTOR_URL` exportado. Se prueba la
// PRIORIDAD de resolución, que es donde estaba el fallo — sin BD real.

/* eslint-disable @typescript-eslint/no-require-imports */
const { urlLecturaNegocio } = require('../../../lib/db/negocioSoloLectura.cjs')

describe('urlLecturaNegocio', () => {
  const claves = ['VENCE_LECTOR_URL', 'DATABASE_URL']
  const previos: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of claves) {
      previos[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of claves) {
      if (previos[k] !== undefined) process.env[k] = previos[k]
      else delete process.env[k]
    }
  })

  test('prefiere VENCE_LECTOR_URL de process.env sobre DATABASE_URL de process.env', () => {
    process.env.VENCE_LECTOR_URL = 'postgres://lector:x@h/db'
    process.env.DATABASE_URL = 'postgres://coordinacion:x@h/db'
    expect(urlLecturaNegocio()).toBe('postgres://lector:x@h/db')
  })

  test('sin ninguna variable de entorno, resuelve desde .env.local (el caso real de este repo) sin reventar', () => {
    // Este repo real trae un .env.local con VENCE_LECTOR_URL y DATABASE_URL, así
    // que sin overrides de process.env cae ahí — se prueba que no explota por
    // `undefined` y que devuelve una URL de postgres, no que coincida con un
    // valor fijo (el contenido de .env.local no es cosa de este test).
    expect(() => urlLecturaNegocio()).not.toThrow(TypeError)
    expect(urlLecturaNegocio()).toMatch(/^postgres:\/\//)
  })

  test('DATABASE_URL de process.env SOLO se usa si no hay ningún VENCE_LECTOR_URL disponible (env ni .env.local)', () => {
    // Con .env.local aportando su propio VENCE_LECTOR_URL, un DATABASE_URL puesto
    // a mano en process.env NO debe ganarle: el rol de lectura es siempre el de
    // menor privilegio disponible, no el último que alguien exportó.
    process.env.DATABASE_URL = 'postgres://coordinacion:x@h/db'
    expect(urlLecturaNegocio()).not.toBe('postgres://coordinacion:x@h/db')
  })
})
