/**
 * El despeje de citas del articulado por letra tiene que cumplir DOS cosas a la vez, y las dos se
 * pueden romper por separado:
 *
 *   1. que el resultado ya NO dispare `explanationReferencesLetters` — si no, la pregunta sigue
 *      fuera del barajado y el despeje no ha servido de nada;
 *   2. que NO toque lo que sí es una referencia a una opción de la pantalla («la opción B») ni el
 *      texto que no menciona ninguna letra. Un despeje demasiado ávido borraría la señal real.
 *
 * Los casos vienen todos de la campaña de T-291 (30 razones reescritas sobre 400 preguntas).
 */
import { explanationReferencesLetters } from '@/lib/shuffle/classifyShuffleMode'

const { despejarArticuladoPorLetra, despejarEstructurada } = require(
  `${process.cwd()}/scripts/revision/despejarArticuladoPorLetra.cjs`
)

describe('despejarArticuladoPorLetra — casos reales de la campaña', () => {
  const CASOS: Array<[string, string]> = [
    ['letra + artículo', 'Coincide con la letra e) del artículo 7: los documentos que deban someterse a información pública.'],
    ['letra entre paréntesis', 'El artículo solo menciona los anteproyectos de ley y los proyectos de decretos legislativos (letra b); no los decretos-ley.'],
    ['letra sin paréntesis de cierre', 'Es un requisito general de validez (letra c del apartado segundo), no una causa de exención.'],
    ['letra + apartado numerado', 'Lo previsto en la letra c) del apartado 4 exige nivel de Subdirector general.'],
    ['ordinal + frase del precepto', 'Cambia el sujeto de la segunda frase: el artículo habla de los poderes públicos.'],
  ]

  test.each(CASOS)('%s: deja de disparar el detector', (_nombre, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(true)          // el problema existía
    const limpio = despejarArticuladoPorLetra(texto)
    expect(explanationReferencesLetters(limpio)).toBe(false)        // y se ha ido
    expect(limpio).not.toBe(texto)
  })

  test('conserva el contenido: no borra el artículo ni el argumento', () => {
    const limpio = despejarArticuladoPorLetra(
      'Coincide con la letra e) del artículo 7: los documentos que deban someterse a información pública.',
    )
    expect(limpio).toContain('artículo 7')
    expect(limpio).toContain('información pública')
  })

  test('NO toca una referencia real a una opción de la pantalla', () => {
    // Esto es lo que el detector debe seguir marcando: si el despeje lo limpiara, escondería el
    // defecto que el gate existe para encontrar.
    const real = 'Como se ve en la opción B, el plazo es de diez días.'
    expect(despejarArticuladoPorLetra(real)).toBe(real)
    expect(explanationReferencesLetters(despejarArticuladoPorLetra(real))).toBe(true)
  })

  test('NO toca un texto sin letras de por medio', () => {
    const sano = 'El precepto atribuye la competencia al Consejo de Ministros, no a su Presidente.'
    expect(despejarArticuladoPorLetra(sano)).toBe(sano)
  })

  test('es idempotente: aplicarlo dos veces da lo mismo', () => {
    const t = 'Coincide con la letra e) del artículo 7 y con ese apartado.'
    const una = despejarArticuladoPorLetra(t)
    expect(despejarArticuladoPorLetra(una)).toBe(una)
  })

  test('no deja un determinante huérfano delante ("su ese apartado")', () => {
    // Regresión de la campaña: la sustitución genérica dejaba «su ese apartado», que se lee fatal.
    // Lo cazó un agente revisando su propio fichero, no el gate — el gate solo mira las letras.
    const limpio = despejarArticuladoPorLetra(
      'El artículo 2 no restringe la accesibilidad: su letra a) habla de accesibilidad universal.',
    )
    expect(limpio).not.toMatch(/\b(su|sus|el|la|los|las|un|una)\s+ese\s+apartado/i)
    expect(limpio).toContain('ese apartado')
    expect(explanationReferencesLetters(limpio)).toBe(false)
  })

  test('tolera entradas vacías', () => {
    expect(despejarArticuladoPorLetra('')).toBe('')
    expect(despejarArticuladoPorLetra(null)).toBeNull()
    expect(despejarArticuladoPorLetra(undefined)).toBeUndefined()
  })
})

describe('despejarEstructurada', () => {
  test('despeja razones y narrativa, y NO muta la entrada', () => {
    const original = {
      v: 1,
      intro: 'La letra a) del artículo 1 define la forma política.',
      options: {
        '0': 'Coincide con la letra e) del artículo 7.',
        '1': 'El precepto no lo contempla.',
      },
      outro: '**Clave:** la letra e) del artículo 7.',
    }
    const copia = JSON.parse(JSON.stringify(original))
    const { data, cambios } = despejarEstructurada(original)

    expect(original).toEqual(copia)                                  // sin mutación
    expect(cambios.map((c: any) => c.campo).sort()).toEqual(['intro', 'options.0', 'outro'])
    expect(explanationReferencesLetters(data.options['0'])).toBe(false)
    expect(explanationReferencesLetters(data.intro)).toBe(false)
    expect(explanationReferencesLetters(data.outro)).toBe(false)
    expect(data.options['1']).toBe(original.options['1'])            // lo sano se queda igual
  })

  test('sin nada que despejar, no reporta cambios', () => {
    const { cambios } = despejarEstructurada({ v: 1, options: { '0': 'Texto limpio.' } })
    expect(cambios).toHaveLength(0)
  })
})
