/**
 * @jest-environment node
 */
// La única línea que decide qué lee el opositor al reparar §2.2-quater. Los dos casos de abajo
// los enseñó el PILOTO sobre la Ley 13/2015 antes de tocar una sola fila: la primera versión
// escribía «de Ley 13/2015» (sin artículo) y con un decreto habría escrito «de la Decreto».
import { nombrarNorma, conector } from '@/scripts/reparar-enunciado-sin-norma'

describe('nombrarNorma — inserta la norma que faltaba', () => {
  it('el caso dominante del banco', () => {
    expect(nombrarNorma('Según el artículo 71 de la ley, los empleados públicos deberán asistir:', 'Ley 13/2015, de 8 de abril, de Función Pública de Extremadura'))
      .toBe('Según el artículo 71 de la Ley 13/2015, de 8 de abril, de Función Pública de Extremadura, los empleados públicos deberán asistir:')
  })

  it('concuerda en MASCULINO cuando la norma es un decreto', () => {
    expect(nombrarNorma('Según el artículo 29 de la normativa, el registro electrónico:', 'Decreto 225/2014, de Administración Electrónica'))
      .toBe('Según el artículo 29 del Decreto 225/2014, de Administración Electrónica, el registro electrónico:')
  })

  it('conserva el apartado y el resto de la frase', () => {
    const r = nombrarNorma('El artículo 13.2, párrafo segundo, de dicha ley, fija la cuantía.', 'Ley 19/2021')
    expect(r).toContain('artículo 13.2, párrafo segundo, de la Ley 19/2021')
    expect(r).toContain('fija la cuantía.')
  })

  it('devuelve null si no hay nada que sustituir (nunca aproxima)', () => {
    expect(nombrarNorma('Según el artículo 71 de la Ley 13/2015, los empleados:', 'Ley 13/2015')).toBeNull()
    expect(nombrarNorma('¿Qué es el silencio administrativo?', 'Ley 39/2015')).toBeNull()
  })
})

describe('conector — el artículo que faltaba', () => {
  it('femenino por defecto (ley, orden, normativa)', () => {
    expect(conector('de', 'Ley 9/2017')).toBe('de la')
    expect(conector('Según', 'Ley 9/2017')).toBe('Según la')
  })

  it('masculino para decreto, reglamento, estatuto, código y texto refundido', () => {
    for (const n of ['Decreto 225/2014', 'Real Decreto 1415/2004', 'Reglamento de la Asamblea', 'Estatuto de Autonomía', 'Código Civil', 'Texto refundido de la LGSS']) {
      expect(conector('de', n)).toBe('del')
      expect(conector('según', n)).toBe('según el')
    }
  })
})
