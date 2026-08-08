// __tests__/backlog/dividirFichas.test.ts — [T-532]
//
// La garantía de `dividirFichas.cjs` es una sola: reconstruir(dividirEnBloques(md)) === md, SIEMPRE.
// Estos tests la fijan con casos sintéticos pequeños (rápidos, deterministas) y luego, aparte, contra
// el fichero real completo — que es donde salió el gotcha del grep codicioso y los seis "sueltos".

const { dividirEnBloques, reconstruir, idsFicha } = require('../../lib/backlog/dividirFichas.cjs')
import fs from 'fs'
import path from 'path'

describe('dividirEnBloques — casos sintéticos', () => {
  it('reconstruye byte a byte un fichero mínimo con preámbulo + una ficha', () => {
    const md = 'Preámbulo\ncon dos líneas.\n\n### [T-001] 🟠 Título de ejemplo\n\n- cuerpo\n- más cuerpo\n'
    const bloques = dividirEnBloques(md)
    expect(reconstruir(bloques)).toBe(md)
  })

  it('clasifica preámbulo, ficha, marcador de sección y suelto por separado', () => {
    const md = [
      'Preámbulo.',
      '## Abiertas',
      '### [T-001] 🟠 Uno',
      'cuerpo 1',
      '## Un encabezado suelto sin id',
      'texto suelto',
      '## Hechas',
      '### [T-002] ✅ Dos',
      'cuerpo 2',
      '',
    ].join('\n')
    const bloques = dividirEnBloques(md)
    expect(bloques.map((b) => b.tipo)).toEqual([
      'preambulo', 'marcador_seccion', 'ficha', 'suelto', 'marcador_seccion', 'ficha',
    ])
    expect(bloques.filter((b) => b.tipo === 'ficha').map((b) => b.id)).toEqual(['T-001', 'T-002'])
    expect(reconstruir(bloques)).toBe(md)
  })

  it('el gotcha del título que cita OTRA tarea: coge el PRIMER id, no el último', () => {
    // Mismo caso real que atrapó a insertarFicha.cjs con un regex codicioso.
    const md = '### [T-532] Una ficha = un fichero: quitar la causa que [T-400] dejó visible\ncuerpo\n'
    const bloques = dividirEnBloques(md)
    expect(bloques[0].id).toBe('T-532')
  })

  it('un id duplicado hace FALLAR la división, no elegir uno en silencio', () => {
    const md = '### [T-001] Uno\ncuerpo\n### [T-001] Uno otra vez\ncuerpo\n'
    expect(() => idsFicha(dividirEnBloques(md))).toThrow(/duplicado/)
  })

  it('un fichero sin ninguna cabecera es preámbulo entero, sin reventar', () => {
    const md = 'todo esto es prosa suelta\nsin cabeceras\n'
    const bloques = dividirEnBloques(md)
    expect(bloques).toEqual([{ tipo: 'preambulo', texto: md }])
  })

  it('un fichero vacío reconstruye vacío (sin reventar)', () => {
    expect(reconstruir(dividirEnBloques(''))).toBe('')
  })

  it('#### (nivel 4) NO es un límite de bloque — se queda dentro del cuerpo de la ficha', () => {
    const md = '### [T-001] Uno\nintro\n#### Sub-apartado\nmás cuerpo\n'
    const bloques = dividirEnBloques(md)
    expect(bloques).toHaveLength(1)
    expect(bloques[0].texto).toBe(md)
  })
})

describe('dividirEnBloques — contra el fichero REAL completo', () => {
  const RUTA = path.join(process.cwd(), 'docs', 'roadmap', 'tareas-pendientes.md')
  const md = fs.readFileSync(RUTA, 'utf8')
  const bloques = dividirEnBloques(md)

  it('reconstruye el fichero real byte a byte', () => {
    expect(reconstruir(bloques)).toBe(md)
  })

  it('todos los ids de ficha son ÚNICOS (con la regex PEREZOSA correcta)', () => {
    // Si esto lanza, es un hallazgo real del fichero — no un fallo del test.
    expect(() => idsFicha(bloques)).not.toThrow()
  })

  it('no se pierde ni un carácter: la suma de longitudes de los bloques es la longitud del fichero', () => {
    const total = bloques.reduce((n, b) => n + b.texto.length, 0)
    expect(total).toBe(md.length)
  })
})
