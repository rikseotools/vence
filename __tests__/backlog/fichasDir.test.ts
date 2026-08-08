// __tests__/backlog/fichasDir.test.ts — [T-532]
//
// Ejercita fichasDir.cjs contra un directorio TEMPORAL (nunca contra docs/roadmap/tareas real):
// escribir/leer/generar índice tiene que comportarse igual en cualquier árbol, y probar contra el
// real acoplaría el test al contenido vivo del backlog, que cambia cada día.

import fs from 'fs'
import os from 'os'
import path from 'path'

describe('fichasDir — contra un árbol temporal aislado', () => {
  let dir: string
  let FD: typeof import('../../lib/backlog/fichasDir.cjs')

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fichasDir-test-'))
    jest.resetModules()
    // Reapunta el módulo a un REPO de pruebas: fichasDir.cjs calcula sus rutas desde
    // `path.join(__dirname, '..', '..')`, así que la única costura limpia es simular esa
    // estructura dentro del tmpdir (docs/roadmap/…) y cargar el módulo con ese cwd.
    fs.mkdirSync(path.join(dir, 'docs', 'roadmap'), { recursive: true })
    jest.doMock('path', () => {
      const real = jest.requireActual('path')
      return real
    })
    process.chdir(dir)
    // fichasDir.cjs resuelve rutas relativas a SU PROPIO __dirname (lib/backlog/), no al cwd —
    // así que en vez de mockear módulos, se copia el fichero al árbol temporal con la misma
    // estructura relativa y se requiere DESDE ahí.
    const repoReal = path.join(__dirname, '..', '..')
    fs.mkdirSync(path.join(dir, 'lib', 'backlog'), { recursive: true })
    for (const f of ['fichasDir.cjs', 'dividirFichas.cjs']) {
      fs.copyFileSync(path.join(repoReal, 'lib', 'backlog', f), path.join(dir, 'lib', 'backlog', f))
    }
    FD = require(path.join(dir, 'lib', 'backlog', 'fichasDir.cjs'))
  })

  afterEach(() => {
    process.chdir(path.join(__dirname, '..', '..'))
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('escribirFicha + leerFicha: idempotente', () => {
    FD.escribirFicha('T-001', '### [T-001] 🟠 Uno\n\ncuerpo\n')
    expect(FD.leerFicha('T-001')).toBe('### [T-001] 🟠 Uno\n\ncuerpo\n')
  })

  it('leerFicha de un id que no existe da null, no lanza', () => {
    expect(FD.leerFicha('T-999')).toBeNull()
  })

  it('listarIds refleja lo que hay en disco, ordenado', () => {
    FD.escribirFicha('T-010', '### [T-010] Diez\n')
    FD.escribirFicha('T-002', '### [T-002] Dos\n')
    expect(FD.listarIds()).toEqual(['T-002', 'T-010'])
  })

  it('rutaFicha rechaza un id con forma inválida (defensa contra path traversal)', () => {
    expect(() => FD.rutaFicha('../../etc/passwd')).toThrow(/inválido/)
    expect(() => FD.rutaFicha('T-1; rm -rf')).toThrow(/inválido/)
  })

  it('estaCerrada mira SOLO la primera línea (mismo criterio que parseMarkdown, T-382)', () => {
    expect(FD.estaCerrada('### [T-001] ✅ Hecha\ncuerpo con ✅ en otra parte\n')).toBe(true)
    expect(FD.estaCerrada('### [T-001] Abierta\ncuerpo que menciona ✅ de pasada\n')).toBe(false)
  })

  it('generarIndice: abiertas en «## Abiertas», cerradas en «## Hechas», nunca mezcladas', () => {
    FD.escribirPreambulo('PREÁMBULO\n')
    FD.escribirFicha('T-001', '### [T-001] 🟠 Abierta\ncuerpo A\n')
    FD.escribirFicha('T-002', '### [T-002] ✅ Cerrada\ncuerpo B\n')
    const indice = FD.generarIndice()
    const iAbiertas = indice.indexOf('## Abiertas')
    const iHechas = indice.indexOf('## Hechas')
    const iT001 = indice.indexOf('### [T-001]')
    const iT002 = indice.indexOf('### [T-002]')
    expect(iT001).toBeGreaterThan(iAbiertas)
    expect(iT001).toBeLessThan(iHechas)
    expect(iT002).toBeGreaterThan(iHechas)
  })

  it('generarIndice ordena por id DESCENDENTE dentro de cada sección', () => {
    FD.escribirFicha('T-001', '### [T-001] 🟠 Uno\n')
    FD.escribirFicha('T-050', '### [T-050] 🟠 Cincuenta\n')
    FD.escribirFicha('T-010', '### [T-010] 🟠 Diez\n')
    const indice = FD.generarIndice()
    const pos = (id: string) => indice.indexOf(`[${id}]`)
    expect(pos('T-050')).toBeLessThan(pos('T-010'))
    expect(pos('T-010')).toBeLessThan(pos('T-001'))
  })

  it('indiceEstaAlDia: true justo tras regenerar, false si se edita el índice a mano', () => {
    FD.escribirFicha('T-001', '### [T-001] 🟠 Uno\n')
    FD.regenerarIndice()
    expect(FD.indiceEstaAlDia()).toBe(true)
    fs.appendFileSync(FD.FICHERO_INDICE, '\nedición a mano que no pasó por escribirFicha\n')
    expect(FD.indiceEstaAlDia()).toBe(false)
  })

  it('indiceEstaAlDia: false si se añade una ficha nueva sin regenerar', () => {
    FD.regenerarIndice()
    expect(FD.indiceEstaAlDia()).toBe(true)
    FD.escribirFicha('T-777', '### [T-777] 🟢 Nueva, sin regenerar\n')
    expect(FD.indiceEstaAlDia()).toBe(false)
  })

  it('sueltos: se preservan y aparecen en el índice bajo su propia cabecera de cuarentena', () => {
    FD.escribirSueltos('## Un bloque huérfano\ntexto real sin id\n')
    const indice = FD.generarIndice()
    expect(indice).toContain('Contenido sin ficha')
    expect(indice).toContain('Un bloque huérfano')
  })

  it('borrarFicha quita el fichero; no lanza si ya no existía', () => {
    FD.escribirFicha('T-001', '### [T-001] Uno\n')
    FD.borrarFicha('T-001')
    expect(FD.leerFicha('T-001')).toBeNull()
    expect(() => FD.borrarFicha('T-001')).not.toThrow()
  })
})
