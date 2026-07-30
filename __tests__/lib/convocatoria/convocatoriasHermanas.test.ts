// Avisar de que la misma oposición tiene otra convocatoria viva con temario distinto.
//
// ## Por qué (30/07/2026)
//
// Auxiliar Administrativo de la Comunidad de Madrid tiene dos convocatorias abiertas a la vez
// con programas distintos (examen octubre 2026 → Windows 10; junio 2027 → Windows 11). Se
// sirven como dos oposiciones separadas y en el SELECTOR se distinguen bien, pero una vez
// dentro nada te decía que existía la otra.
//
// Una usuaria estudió el temario que no le tocaba y lo descubrió de casualidad, escribiendo a
// soporte por otra cosa: «me he metido en la convocatoria equivocada». Teníamos el dato y no
// se lo dijimos.
import {
  decidirAvisoHermanas,
  textoAvisoHermanas,
  etiquetaExamen,
} from '@/lib/convocatoria/convocatoriasHermanas'

const MADRID = [
  { slug: 'auxiliar-administrativo-madrid', nombre: 'Aux. Madrid (examen octubre 2026)', examDate: '2026-10-15', actual: true },
  { slug: 'auxiliar-administrativo-madrid-2027', nombre: 'Aux. Madrid (examen junio 2027)', examDate: '2027-06-01' },
]

describe('decidir si se avisa', () => {
  it('el caso real: dos convocatorias vivas → se avisa, y se ofrece la OTRA', () => {
    const a = decidirAvisoHermanas(MADRID)
    expect(a.mostrar).toBe(true)
    expect(a.otras.map((o) => o.slug)).toEqual(['auxiliar-administrativo-madrid-2027'])
  })

  it('una oposición sin hermanas no enseña nada (es el 99% del catálogo)', () => {
    expect(decidirAvisoHermanas([]).mostrar).toBe(false)
    expect(decidirAvisoHermanas(null).motivo).toBe('sin_grupo')
    expect(decidirAvisoHermanas([{ slug: 'sola', nombre: 'Sola', actual: true }]).motivo).toBe('sin_hermanas')
  })

  it('si no se sabe cuál tiene seleccionada, se calla', () => {
    // Un aviso que dice «la otra» sin saber cuál es la suya confunde a quien ya está
    // estudiando: peor que no decir nada.
    const a = decidirAvisoHermanas(MADRID.map((m) => ({ ...m, actual: false })))
    expect(a.mostrar).toBe(false)
    expect(a.motivo).toBe('sin_actual')
  })

  it('funciona igual si la seleccionada es la otra', () => {
    const invertido = [
      { ...MADRID[0], actual: false },
      { ...MADRID[1], actual: true },
    ]
    const a = decidirAvisoHermanas(invertido)
    expect(a.otras.map((o) => o.slug)).toEqual(['auxiliar-administrativo-madrid'])
  })

  it('aguanta tres convocatorias (no está pensado solo para dos)', () => {
    const tres = [...MADRID, { slug: 'aux-madrid-2028', nombre: 'Aux. Madrid 2028', examDate: '2028-05-01' }]
    const a = decidirAvisoHermanas(tres)
    expect(a.otras).toHaveLength(2)
    expect(textoAvisoHermanas(a)).toContain('3 convocatorias')
  })
})

describe('el texto que ve la persona', () => {
  it('nombra el riesgo y qué tiene que hacer, sin adornos', () => {
    const t = textoAvisoHermanas(decidirAvisoHermanas(MADRID))
    expect(t).toContain('temario distinto')
    expect(t).toContain('Asegúrate de que tienes seleccionada la convocatoria a la que te presentas')
  })

  it('sin aviso no hay texto', () => {
    expect(textoAvisoHermanas(decidirAvisoHermanas([]))).toBeNull()
  })
})

describe('etiqueta de la fecha de examen', () => {
  it('es lo que de verdad distingue una convocatoria de otra', () => {
    expect(etiquetaExamen('2026-10-15')).toBe('octubre de 2026')
    expect(etiquetaExamen(new Date('2027-06-01T00:00:00Z'))).toBe('junio de 2027')
  })

  it('sin fecha o con fecha inválida no inventa nada', () => {
    expect(etiquetaExamen(null)).toBeNull()
    expect(etiquetaExamen('vete a saber')).toBeNull()
  })
})
