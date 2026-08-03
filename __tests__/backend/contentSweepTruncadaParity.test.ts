/**
 * PARIDAD entre el núcleo puro `lib/health/explicacionTruncada.cjs` (que usa el CLI y el sweep de
 * Node) y su ESPEJO dentro de `content-health-sweep.service.ts` (que es el que escribe el snapshot
 * nocturno desde Fargate).
 *
 * El espejo existe por una restricción real: la imagen Docker del backend solo copia `backend/src`,
 * así que no puede importar `lib/`. Pero una regla duplicada es una regla que diverge — y cuando
 * diverge, el CLI dice una cosa y el badge otra, que es la peor forma de tener un detector.
 *
 * Este test extrae la función del espejo del propio fichero fuente y la ejerce contra los MISMOS
 * casos que el núcleo, incluidos los tres falsos positivos que sostienen la precisión. Si alguien
 * ajusta una lista de palabras en un lado y no en el otro, esto se pone rojo.
 */

import fs from 'fs'
import path from 'path'

const { clasificaTruncada } = require('../../lib/health/explicacionTruncada.cjs')

const RUTA_ESPEJO = path.join(process.cwd(), 'backend/src/content-health-sweep/content-health-sweep.service.ts')

/** Reconstruye la función `truncada` del espejo evaluando su cuerpo tal cual está en el servicio. */
function cargaEspejo(): (t: string) => string | null {
  const fuente = fs.readFileSync(RUTA_ESPEJO, 'utf8')
  const desde = fuente.indexOf('const FUNCIONALES = new Set(')
  const hasta = fuente.indexOf('const trRows = (await this.db.execute')
  expect(desde).toBeGreaterThan(-1)
  expect(hasta).toBeGreaterThan(desde)
  const cuerpo = fuente
    .slice(desde, hasta)
    .replace(/:\s*string\s*\|\s*null/g, '')
    .replace(/:\s*string(?=\s*\))/g, '')
    .replace(/\?\?/g, '||')
  // eslint-disable-next-line no-new-func
  return new Function(`${cuerpo}; return truncada;`)() as (t: string) => string | null
}

describe('el espejo del backend juzga igual que el núcleo puro', () => {
  const truncadaEspejo = cargaEspejo()

  const CASOS: string[] = [
    // cortes reales
    '…los miembros del Cuerpo Nacional de',
    'podrá optar por la vecindad civil del otro',
    'están obligados a observar estrictamente las formalidades legales e',
    'Pierden la nacionalidad española los emancipados que',
    'obtuviere de un funcionario público o autoridad,',
    'porque se evita la duplicación de tareas,',
    'el Juez o Tribunal **del que dependan,**',
    // no son cortes — los tres tipos de falso positivo que se excluyen a propósito
    'accesibilidad universal de las personas con discapacidad',
    'Fuente: Arts. 62, 63 y 116 de la Constitución Española de 1978',
    'Más información en https://rebiun.org/informe.pdf?sequence=4&isAllowed=y',
    'guantes, sondas, material quirúrgico, entre otros',
    '0° a -90° 0° a 180° S E 0° a -90° 0° a -180º S O',
    'La respuesta correcta se apoya en el artículo 137.',
    'Se enumeran los siguientes supuestos:',
    '',
  ]

  it.each(CASOS)('mismo veredicto para %j', (texto) => {
    const nucleo = clasificaTruncada({ explanation: texto })
    const espejo = truncadaEspejo(texto)
    expect(espejo).toBe(nucleo.truncada ? nucleo.motivo : null)
  })

  it('el espejo emite el mismo kind que el CLI', () => {
    const fuente = fs.readFileSync(RUTA_ESPEJO, 'utf8')
    expect(fuente).toContain("'explicacion_truncada'")
    const cli = fs.readFileSync(path.join(process.cwd(), 'scripts/health-sweep.cjs'), 'utf8')
    expect(cli).toContain("'explicacion_truncada'")
  })
})
