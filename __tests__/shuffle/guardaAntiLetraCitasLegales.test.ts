/**
 * La guarda anti-letra de `aplicar-explicacion.ts` no puede confundir las letras de la LEY con las
 * de las OPCIONES.
 *
 * Qué defiende: en Derecho los apartados se citan por letra («la letra e) del artículo 9.1», «el
 * apartado b) del 4.1»). Eso nombra la norma, no la pantalla, así que al barajar sigue siendo
 * cierto. La guarda lo tomaba por una referencia a la opción E o a la B y rechazaba explicaciones
 * impecables, obligando a redactar peor para esquivarla: pasó el 28/07 al reescribir la explicación
 * del art. 9.1 LPRL, cuyas funciones de la Inspección de Trabajo se enumeran precisamente por
 * letras, y hubo que rodearlo con perífrasis.
 *
 * El equilibrio: la excepción NO puede abrir la mano a lo que la guarda existe para cazar, que es
 * la razón anclada a la letra o a la posición de la opción. Por eso los dos grupos van juntos.
 */

// Se replican los dos patrones del script (que es un CLI con top-level await y no se puede
// importar desde Jest). Si allí cambian, este test deja de proteger nada: van comentados en
// `scripts/aplicar-explicacion.ts` §2 con esta misma referencia.
const CITA_DE_LA_NORMA = /\b(letra|apartado|p[áa]rrafo|inciso|ep[íi]grafe|regla)\s+[a-e]\)?\s*(?:de[l]?\s+)?(?:art|ap|n[úu]m|\d)/i
const REFERENCIA_A_OPCION =
  /\b(la|opci[óo]n|respuesta|letra)\s+[A-E]\b|\b(primera|segunda|tercera|cuarta|[úu]ltima|anterior|siguiente)\s+(opci[óo]n|respuesta)\b|\b(opci[óo]n|respuesta|alternativa)\s+(anterior|previa|siguiente)\b/i

const rechazada = (razon: string): boolean =>
  REFERENCIA_A_OPCION.test(razon.replace(new RegExp(CITA_DE_LA_NORMA.source, 'gi'), ' '))

describe('citar la ley por letra NO es citar una opción', () => {
  it.each([
    'Reproduce la letra e) del artículo 9.1: comprobar y favorecer el cumplimiento de las obligaciones.',
    'La letra c) del artículo 9.1 limita esos informes a los que soliciten los Juzgados de lo Social.',
    'El apartado b) del artículo 4.1 lo reserva a universidades de especiales características.',
    'El párrafo a) del artículo 20 exige la publicidad de la convocatoria.',
  ])('se acepta: %s', (razon) => {
    expect(rechazada(razon)).toBe(false)
  })
})

describe('lo que la guarda sí tiene que seguir cazando', () => {
  it.each([
    'La respuesta B es correcta porque reproduce el artículo.',
    'La opción C invierte el orden de las franjas.',
    'Como se vio en la primera opción, el plazo es de diez días.',
    'Coincide con la respuesta anterior.',
  ])('se rechaza: %s', (razon) => {
    expect(rechazada(razon)).toBe(true)
  })
})

describe('texto legal corriente, sin letras de apartado', () => {
  it('no se rechaza por mencionar secciones o capítulos', () => {
    expect(rechazada('El artículo 33 está en la Sección 2ª del Capítulo II del Título I.')).toBe(false)
  })
})
