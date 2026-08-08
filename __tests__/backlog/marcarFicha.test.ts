/**
 * `done`/`reopen` con «una ficha = un fichero» [T-532]. Antes de esto, cerrar una tarea acababa
 * en `console.log('AHORA mueve su entrada a "## Hechas"...')`, instrucción que dejó de tener
 * sentido en cuanto el índice pasó a ser GENERADO desde `docs/roadmap/tareas/T-nnn.md`: no hay
 * dos sitios entre los que mover nada, hay una cabecera que editar. Reproducido por la revisión
 * (T-532 devuelta): seguir la instrucción vieja o pierde el cambio en silencio (si algo regenera
 * el índice después) o lo cacha tarde en CI (el guardarraíl no vive en pre-push). Este módulo
 * cierra la CAUSA — `done`/`reopen` editan la cabecera ellos mismos — no solo el aviso.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarCabecera, cerrarCabecera, reabrirCabecera } = require('@/lib/backlog/marcarFicha.cjs')

describe('analizarCabecera', () => {
  it('separa prefijo, y descarta emoji/corchete/tick del resto', () => {
    const p = analizarCabecera('### [T-042] 🔴 [ABIERTO 19/07] Título de la tarea')
    expect(p).toEqual({ prefijo: '### [T-042] ', titulo: 'Título de la tarea' })
  })

  it('funciona sin emoji de prioridad', () => {
    const p = analizarCabecera('### [T-042] [ABIERTO 19/07] Título')
    expect(p.titulo).toBe('Título')
  })

  it('funciona sin corchete de estado', () => {
    const p = analizarCabecera('### [T-042] 🟡 Título sin corchete de fecha')
    expect(p.titulo).toBe('Título sin corchete de fecha')
  })

  it('cabecera irreconocible (sin id T-nnn) devuelve null', () => {
    expect(analizarCabecera('### Un bloque suelto sin id')).toBeNull()
  })
})

describe('cerrarCabecera', () => {
  it('el caso canónico: prioridad + [ABIERTO] → ✅ + [HECHA]', () => {
    const texto = '### [T-042] 🔴 [ABIERTO 19/07] Título de la tarea\n\n- cuerpo sin tocar'
    const out = cerrarCabecera(texto, '08/08')
    expect(out).toBe('### [T-042] ✅ [HECHA 08/08] Título de la tarea\n\n- cuerpo sin tocar')
  })

  it('no toca el cuerpo, solo la primera línea', () => {
    const texto = [
      '### [T-100] 🟢 [ABIERTO 01/08] Una tarea',
      '',
      '- **Esfuerzo: rato.**',
      '- Menciona [ABIERTO 19/07] dentro de una frase del cuerpo, que NO debe cambiar.',
    ].join('\n')
    const out = cerrarCabecera(texto, '08/08')
    const lineas = out.split('\n')
    expect(lineas[0]).toBe('### [T-100] ✅ [HECHA 08/08] Una tarea')
    expect(lineas[3]).toBe('- Menciona [ABIERTO 19/07] dentro de una frase del cuerpo, que NO debe cambiar.')
  })

  it('sin corchete de estado previo, lo añade igual', () => {
    const texto = '### [T-042] 🟡 Título sin fecha previa'
    expect(cerrarCabecera(texto, '08/08')).toBe('### [T-042] ✅ [HECHA 08/08] Título sin fecha previa')
  })

  it('cabecera irreconocible: se devuelve intacta (que lo cace el guardarraíl, no reventar)', () => {
    const texto = '### Bloque suelto sin id\n\ncuerpo'
    expect(cerrarCabecera(texto, '08/08')).toBe(texto)
  })

  it('reproduce el caso REAL de T-632 (muestreado del repo)', () => {
    const abierta = '### [T-632] 🟡 [ABIERTO 06/08] Una revisión podía aprobar trabajo que no estaba a salvo'
    expect(cerrarCabecera(abierta, '06/08')).toBe(
      '### [T-632] ✅ [HECHA 06/08] Una revisión podía aprobar trabajo que no estaba a salvo',
    )
  })
})

describe('reabrirCabecera', () => {
  it('el caso canónico: ✅ + [HECHA] → prioridad + [ABIERTO]', () => {
    const texto = '### [T-632] ✅ [HECHA 06/08] Una revisión podía aprobar trabajo que no estaba a salvo\n\n- cuerpo'
    const out = reabrirCabecera(texto, '08/08', '🟠')
    expect(out).toBe('### [T-632] 🟠 [ABIERTO 08/08] Una revisión podía aprobar trabajo que no estaba a salvo\n\n- cuerpo')
  })

  it('sin emoji (prioridad desconocida): no deja un espacio suelto', () => {
    const texto = '### [T-632] ✅ [HECHA 06/08] Título'
    expect(reabrirCabecera(texto, '08/08', null)).toBe('### [T-632] [ABIERTO 08/08] Título')
  })

  it('round-trip: cerrar y reabrir deja una cabecera parseable con el título intacto', () => {
    const original = '### [T-200] 🔴 [ABIERTO 01/08] Un caso cualquiera'
    const cerrada = cerrarCabecera(original, '05/08')
    expect(cerrada).toContain('✅')
    const reabierta = reabrirCabecera(cerrada, '08/08', '🔴')
    expect(analizarCabecera(reabierta)?.titulo).toBe('Un caso cualquiera')
    expect(reabierta).not.toContain('✅')
    expect(reabierta).toBe('### [T-200] 🔴 [ABIERTO 08/08] Un caso cualquiera')
  })
})

describe('integración con fichasDir — lo mismo que hacen `done`/`reopen` de verdad', () => {
  // Mismo patrón de árbol temporal aislado que fichasDir.test.ts: nunca contra
  // docs/roadmap/tareas real.
  let dir: string
  let FD: typeof import('../../lib/backlog/fichasDir.cjs')
  let MF2: typeof import('../../lib/backlog/marcarFicha.cjs')

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marcarFicha-test-'))
    jest.resetModules()
    fs.mkdirSync(path.join(dir, 'docs', 'roadmap'), { recursive: true })
    process.chdir(dir)
    const repoReal = path.join(__dirname, '..', '..')
    fs.mkdirSync(path.join(dir, 'lib', 'backlog'), { recursive: true })
    for (const f of ['fichasDir.cjs', 'dividirFichas.cjs', 'marcarFicha.cjs']) {
      fs.copyFileSync(path.join(repoReal, 'lib', 'backlog', f), path.join(dir, 'lib', 'backlog', f))
    }
    FD = require(path.join(dir, 'lib', 'backlog', 'fichasDir.cjs'))
    MF2 = require(path.join(dir, 'lib', 'backlog', 'marcarFicha.cjs'))
  })

  afterEach(() => {
    process.chdir(path.join(__dirname, '..', '..'))
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('cerrar: la ficha pasa de «## Abiertas» a «## Hechas» en el índice, y queda al día', () => {
    FD.escribirFicha('T-001', '### [T-001] 🟠 [ABIERTO 01/08] Una tarea\n\n- cuerpo\n')
    FD.regenerarIndice()
    expect(FD.indiceEstaAlDia()).toBe(true)

    // Esto es exactamente lo que hace `done` ahora: leer, cerrar la cabecera, escribir, regenerar.
    const texto = FD.leerFicha('T-001')!
    FD.escribirFicha('T-001', MF2.cerrarCabecera(texto, '08/08'))
    FD.regenerarIndice()

    expect(FD.estaCerrada(FD.leerFicha('T-001')!)).toBe(true)
    const indice = FD.generarIndice()
    expect(indice.indexOf('### [T-001]')).toBeGreaterThan(indice.indexOf('## Hechas'))
    expect(FD.indiceEstaAlDia()).toBe(true) // el índice en disco coincide con lo recién escrito
  })

  it('reabrir: vuelve a «## Abiertas» con la prioridad restaurada desde fuera (como la BD)', () => {
    FD.escribirFicha('T-002', '### [T-002] ✅ [HECHA 05/08] Otra tarea\n\n- cuerpo\n')
    FD.regenerarIndice()
    expect(FD.estaCerrada(FD.leerFicha('T-002')!)).toBe(true)

    // Esto es lo que hace `reopen`: la prioridad no vive en la cabecera cerrada, la trae la BD.
    const texto = FD.leerFicha('T-002')!
    FD.escribirFicha('T-002', MF2.reabrirCabecera(texto, '08/08', '🔴'))
    FD.regenerarIndice()

    expect(FD.estaCerrada(FD.leerFicha('T-002')!)).toBe(false)
    const indice = FD.generarIndice()
    expect(indice.indexOf('### [T-002]')).toBeGreaterThan(indice.indexOf('## Abiertas'))
    expect(indice.indexOf('### [T-002]')).toBeLessThan(indice.indexOf('## Hechas'))
    expect(FD.indiceEstaAlDia()).toBe(true)
  })

  it('reproduce el hallazgo exacto de la revisión: cerrar SOLO en BD (sin marcar la cabecera) deja el índice desactualizado', () => {
    // Esto es lo que hacía `done` ANTES de este fix: la BD pasa a 'done' pero nadie toca
    // docs/roadmap/tareas/T-004.md. `indiceEstaAlDia()` es el guardarraíl que lo cazaba —
    // demasiado tarde (en CI, que no vive en pre-push) y sin decir qué hacer en su lugar.
    FD.escribirFicha('T-004', '### [T-004] 🟠 [ABIERTO 01/08] Tarea\n\n- cuerpo\n')
    FD.regenerarIndice()
    expect(FD.indiceEstaAlDia()).toBe(true)

    // Nada llama a cerrarCabecera/escribirFicha/regenerarIndice — el índice comiteado sigue
    // diciendo "abierta" aunque la tarea ya esté cerrada en BD.
    const indiceViejo = fs.readFileSync(FD.FICHERO_INDICE, 'utf8')
    expect(indiceViejo).toContain('## Abiertas\n\n### [T-004]')

    // Con el fix (lo que `done` hace AHORA), el índice SÍ refleja el cierre inmediatamente.
    FD.escribirFicha('T-004', MF2.cerrarCabecera(FD.leerFicha('T-004')!, '08/08'))
    FD.regenerarIndice()
    const indiceNuevo = fs.readFileSync(FD.FICHERO_INDICE, 'utf8')
    expect(indiceNuevo).toContain('## Hechas\n\n### [T-004]')
    expect(FD.indiceEstaAlDia()).toBe(true)
  })
})
