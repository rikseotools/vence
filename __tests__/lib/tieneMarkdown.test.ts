/**
 * @jest-environment node
 */
// Núcleo puro que decide con qué render se pinta un artículo en el modal [T-461].
//
// Los casos POSITIVOS son texto real de artículos del banco; los NEGATIVOS son texto legal corriente
// que NO debe cambiar de render — ahí el resaltado sigue siendo lo mejor y tocarlo sería una
// regresión para la inmensa mayoría del banco.
import { tieneMarkdown } from '../../lib/teoria/tieneMarkdown'

describe('tieneMarkdown — cuándo hay que pintar con ReactMarkdown', () => {
  describe('SÍ: markdown que el resaltado sirve en crudo', () => {
    it('negrita — el caso que lo destapó', () => {
      // Texto literal del Art. 0 de la Ley 12/2007 tal y como lo vio Manuel en pantalla.
      expect(tieneMarkdown('**Rango:** Ley autonómica de Andalucía.')).toBe(true)
    })

    it('encabezado', () => {
      expect(tieneMarkdown('Intro\n\n## Herramientas corporativas\n\ntexto')).toBe(true)
    })

    it('tabla', () => {
      expect(tieneMarkdown('| Atajo | Acción |\n|---|---|\n| Ctrl+A | Seleccionar todo |')).toBe(true)
    })

    it('lista de varios elementos', () => {
      expect(tieneMarkdown('Qué regula cada Título:\n- Título I — Políticas\n- Título II — Medidas')).toBe(true)
    })
  })

  describe('NO: texto legal corriente, que no debe cambiar de render', () => {
    it('un artículo normal', () => {
      const art =
        'Los poderes públicos de Andalucía incorporarán la evaluación del impacto de género en el ' +
        'desarrollo de sus competencias, para garantizar la integración del principio de igualdad.'
      expect(tieneMarkdown(art)).toBe(false)
    })

    it('un guion suelto NO es una lista: los artículos legales los usan como inciso', () => {
      expect(tieneMarkdown('El plazo será de tres meses - salvo prórroga - desde la solicitud.')).toBe(false)
    })

    it('un asterisco suelto no basta', () => {
      expect(tieneMarkdown('La nota (*) se refiere al apartado anterior.')).toBe(false)
    })

    it('una raya al principio de UNA sola línea tampoco', () => {
      // Hace falta que haya al menos dos elementos seguidos para que sea una lista de verdad.
      expect(tieneMarkdown('Artículo 5.\n- Único inciso del precepto.')).toBe(false)
    })

    it('vacío o nulo', () => {
      expect(tieneMarkdown('')).toBe(false)
      expect(tieneMarkdown(null)).toBe(false)
      expect(tieneMarkdown(undefined)).toBe(false)
    })
  })
})

describe('limpiarMarkdown — para la vista previa recortada', () => {
  const { limpiarMarkdown } = jest.requireActual('../../lib/teoria/tieneMarkdown')

  it('quita la negrita dejando el texto: era lo que se veía en crudo bajo la pregunta', () => {
    expect(limpiarMarkdown('**Rango:** Ley autonómica de Andalucía.')).toBe('Rango: Ley autonómica de Andalucía.')
  })

  it('quita encabezados y viñetas', () => {
    expect(limpiarMarkdown('## Estructura\n- Título I — Políticas\n- Título II — Medidas'))
      .toBe('Estructura\nTítulo I — Políticas\nTítulo II — Medidas')
  })

  it('no deja ningún asterisco de marcado suelto', () => {
    const salida = limpiarMarkdown('**Rango:** *importante* y `código` y | a | b |')
    expect(salida).not.toMatch(/\*\*/)
  })

  it('el texto plano sale intacto', () => {
    const t = 'Los poderes públicos incorporarán la evaluación del impacto de género.'
    expect(limpiarMarkdown(t)).toBe(t)
  })

  it('vacío o nulo devuelve cadena vacía, nunca revienta', () => {
    expect(limpiarMarkdown(null)).toBe('')
    expect(limpiarMarkdown(undefined)).toBe('')
  })
})
