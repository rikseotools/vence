/**
 * `leerTransformarEscribir` — control de concurrencia OPTIMISTA para el único escritor del
 * markdown del backlog. [T-387]
 *
 * La ficha lo pide explícito: «relectura antes de escribir — el fichero cambia bajo los pies,
 * pasó dos veces el 31/07». No hace falta un lock de verdad para esto: basta con comprobar, justo
 * antes de escribir, que nadie escribió en el hueco entre la lectura y la escritura.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { leerTransformarEscribir } = require('@/lib/backlog/escrituraSegura.cjs')

let dir: string
let file: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escritura-segura-'))
  file = path.join(dir, 'tareas.md')
  fs.writeFileSync(file, 'contenido original')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('camino feliz', () => {
  it('escribe el resultado cuando el fichero no cambió entre leer y escribir', () => {
    const r = leerTransformarEscribir(file, (md: string) => ({ ok: true, md: md + ' + añadido' }))
    expect(r.ok).toBe(true)
    expect(r.escrito).toBe(true)
    expect(fs.readFileSync(file, 'utf8')).toBe('contenido original + añadido')
  })

  it('si la transformación falla (ok:false), no escribe nada y devuelve el motivo tal cual', () => {
    const r = leerTransformarEscribir(file, () => ({ ok: false, motivo: 'algo_no_encaja', detalle: 'x' }))
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('algo_no_encaja')
    expect(fs.readFileSync(file, 'utf8')).toBe('contenido original') // intacto
  })
})

describe('la carrera real: el fichero cambia ENTRE la lectura y la escritura', () => {
  it('detecta el cambio y NO escribe (evita pisar lo que escribió otra sesión)', () => {
    const r = leerTransformarEscribir(file, (md: string) => {
      // Simula OTRA sesión escribiendo justo en el hueco: el propio callback de
      // transformación es el único punto donde podemos inyectar la carrera en un test
      // síncrono, y es fiel al caso real (algo externo escribe entre el read() inicial
      // de esta función y su segundo read() previo a la escritura).
      fs.writeFileSync(file, 'contenido escrito por OTRA sesión mientras tanto')
      return { ok: true, md: md + ' + lo que esta sesión creía que iba a escribir' }
    })
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('cambio_bajo_los_pies')
    // Lo de la otra sesión sigue ahí — no se ha pisado.
    expect(fs.readFileSync(file, 'utf8')).toBe('contenido escrito por OTRA sesión mientras tanto')
  })
})
