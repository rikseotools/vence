/**
 * Una explicación puede citar OTRO artículo, y decirlo. Eso no es una cita falsa.
 *
 * Casos reales del inventario del 28/07, verificados a mano:
 *  · `5a0795d0` (109 exposiciones) — pregunta colgada del art. 65 CE (actos del Rey exceptuados de
 *    refrendo) cuya explicación cita «Art. 56.3: "La persona del Rey es inviolable…"». La cita es
 *    correcta y pertinente; el artículo vinculado es otro.
 *  · `6aa51432` — pregunta de nulidad (art. 47 Ley 39/2015) que cita «Art. 48.2 (anulabilidad por
 *    defecto de forma)» para contrastar.
 *
 * El barrido las contaba como «cita ajena». Un cubo lleno de aciertos marcados como defectos es un
 * cubo que nadie drena — y el detector que lo llena acaba desactivado. Filtrarlas bajó las
 * «ajenas» de 39 a 25.
 */
import path from 'path'
const { refDeclaradaDistinta, leyesDeclaradasParaCita } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/barrido-citas.cjs')
)

describe('refDeclaradaDistinta — ¿la cita atribuye su texto a otro artículo?', () => {
  test('CASO REAL 5a0795d0: cita el art. 56.3 en una pregunta del art. 65', () => {
    expect(refDeclaradaDistinta('> Art. 56.3: "La persona del Rey es inviolable"', '65')).toBe('56')
  })

  test('CASO REAL 6aa51432: referencia en negrita con paréntesis explicativo', () => {
    expect(refDeclaradaDistinta('> **Art. 48.2 Ley 39/2015 (anulabilidad por defecto de forma)**\n> "El defecto de forma…"', '47')).toBe('48')
  })

  test('si declara el MISMO artículo que el vinculado, no hay nada que redirigir', () => {
    expect(refDeclaradaDistinta('> Art. 65: "El Rey recibe de los Presupuestos…"', '65')).toBeNull()
  })

  test('CASO REAL fc7defa6: la atribución va DETRÁS de la cita, entre paréntesis', () => {
    // «El Centro Directivo podrá conceder […] traslados de Establecimiento por motivos educativos.»
    // (Art. 121.1 RP), en una pregunta colgada del art. 120. Así cita media doctrina, y el filtro
    // que solo miraba delante la daba por cita falsa.
    expect(refDeclaradaDistinta('> «El Centro Directivo podrá conceder traslados de Establecimiento.» (Art. 121.1 RP)', '120')).toBe('121')
  })

  test('sin referencia declarada, se verifica contra el artículo vinculado (comportamiento de siempre)', () => {
    expect(refDeclaradaDistinta('> "El Rey recibe de los Presupuestos del Estado"', '65')).toBeNull()
  })

  test('solo cuenta la referencia ANTES de la cita: un artículo nombrado DENTRO del texto citado no redirige', () => {
    // «…conforme al artículo 30» dentro de la cita no significa que la cita sea del artículo 30.
    expect(refDeclaradaDistinta('> "Cualquier ciudadano podrá recabar la tutela conforme al artículo 30"', '53')).toBeNull()
  })
})

// ── El guard de `aplicar-explicacion.ts`: apartado de un precepto ≠ opción del test ──────────────
//
// «la letra d) no pide acreditar, sino poseer» cita el ARTICULADO; «la opción D» cita el test. La
// diferencia es la mayúscula, y sin ella el guard frena explicaciones jurídicas normales: pasó el
// 28/07 con el art. 29.2 del Decreto 7/2013 CyL, cuyos cuatro requisitos van por letras y cuyos
// distractores cambian justo el verbo de cada una.
describe('guard anti-letra: distingue el apartado legal de la opción', () => {
  const REFERENCIA_A_OPCION_LETRA = /\b(?:[Ll]a|[Oo]pci[óo]n|[Rr]espuesta|[Ll]etra)\s+[A-E]\b/
  test('«la letra d) no pide acreditar» NO es referencia a una opción', () => {
    expect(REFERENCIA_A_OPCION_LETRA.test('La letra d) no pide «acreditar» los mecanismos, sino poseerlos')).toBe(false)
  })
  test('«la opción D» y «la B es correcta» SÍ lo son', () => {
    expect(REFERENCIA_A_OPCION_LETRA.test('Como se vio en la opción D, el plazo es anual')).toBe(true)
    expect(REFERENCIA_A_OPCION_LETRA.test('La B es correcta porque reproduce el precepto')).toBe(true)
  })
})

// ── La RÚBRICA entrecomillada no es la cita (28/07) ──────────────────────────────────────────────
describe('citaLiteralPretendida — de varios entrecomillados, la cita es el más largo', () => {
  const { citaAusente } = require(path.join(process.cwd(), 'scripts/impugnaciones/barrido-citas.cjs'))
  const ART_405 = 'A la autoridad o funcionario público que, en el ejercicio de su competencia y a sabiendas de su ilegalidad, propusiere, nombrare o diere posesión para el ejercicio de un determinado cargo público a cualquier persona sin que concurran los requisitos legalmente establecidos'
  test('CASO REAL b0731e5b: el primer entrecomillado es el título del CAPÍTULO, no la cita', () => {
    // Coger el primero daba por «cita inventada» un texto copiado letra por letra: el título de un
    // capítulo no aparece, por definición, dentro del articulado.
    const rubrica = 'De la prevaricación de los funcionarios públicos y otros comportamientos injustos'
    expect(citaAusente(rubrica, ART_405)).toBe(true)                       // la rúbrica NO está en el artículo
    expect(citaAusente(ART_405.slice(0, 120), ART_405)).toBe(false)        // la cita real SÍ
  })
})

// ── Varias citas atribuidas en el MISMO blockquote (T-207, 28/07/2026) ────────────────────────
//
// Las explicaciones apilan citas: «Art. 166: "…"» seguido de «Art. 87.2: "…"». Se juzgaba el
// entrecomillado MÁS LARGO (el del 87.2) con la atribución de la PRIMERA cita (el 166), así que
// una pregunta correcta salía acusada de citar algo que su artículo no dice. Las dos «ajenas» de
// más tráfico del cubo eran exactamente esto: 222 y 86 exposiciones de puro ruido.
describe('varias citas atribuidas en el mismo blockquote', () => {
  const { citasAtribuidas } = require(
    require('path').join(__dirname, '..', '..', 'scripts', 'impugnaciones', 'barrido-citas.cjs'),
  )

  // CASO REAL de858282 (CE art. 166, 222 exposiciones).
  const DOS_CITAS =
    '> **Art. 166:** "La iniciativa de reforma constitucional se ejercerá en los términos previstos en los apartados 1 y 2 del artículo 87."\n' +
    '> **Art. 87.2:** "Las Asambleas de las Comunidades Autónomas podrán solicitar del Gobierno la adopción de un proyecto de ley o remitir a la Mesa del Congreso una proposición de ley."'

  it('cada cita se queda con SU atribución, no con la de la primera', () => {
    const cs = citasAtribuidas(DOS_CITAS)
    expect(cs).toHaveLength(2)
    expect(cs[0].ref).toBe('166')
    expect(cs[1].ref).toBe('87')
  })

  it('la cita larga del 87.2 NO se juzga como si pretendiera ser del 166', () => {
    const larga = citasAtribuidas(DOS_CITAS)[1].texto
    expect(refDeclaradaDistinta(DOS_CITAS, '166', larga)).toBe('87')
  })

  it('y la cita del propio artículo sigue sin redirigir', () => {
    const corta = citasAtribuidas(DOS_CITAS)[0].texto
    expect(refDeclaradaDistinta(DOS_CITAS, '166', corta)).toBeNull()
  })

  // CASO REAL 063167fc (CE art. 60, 86 exposiciones): tres citas, dos de otros artículos.
  it('con tres citas apiladas, cada una conserva la suya', () => {
    const TRES =
      '> Art. 60.1: "Será tutor del Rey menor la persona que en su testamento hubiese nombrado el Rey difunto."\n' +
      '> Art. 57.5: "Las abdicaciones y renuncias se resolverán por una ley orgánica."\n' +
      '> Art. 81.2: "La aprobación de las leyes orgánicas exigirá mayoría absoluta del Congreso."'
    expect(citasAtribuidas(TRES).map((c: { ref: string | null }) => c.ref)).toEqual(['60', '57', '81'])
  })

  it('un artículo nombrado DENTRO del texto citado no se convierte en atribución de la cita siguiente', () => {
    // El «artículo 87» del final de la cita del 166 vive DENTRO del entrecomillado: si se colara,
    // la cita siguiente heredaría un 87 que nadie declaró — acertaría por casualidad aquí y
    // fallaría en cuanto el texto citado nombrara otro artículo.
    const cs = citasAtribuidas(
      '> **Art. 166:** "…en los términos previstos en los apartados 1 y 2 del artículo 87."\n> "Las Asambleas podrán solicitar del Gobierno la adopción de un proyecto de ley."',
    )
    expect(cs[1].ref).toBeNull()
  })

  // CASO REAL 4ddc6a7e (Ley 39/2015 art. 74): las cuatro citas llevan la referencia DETRÁS y entre
  // paréntesis. Al arreglar el reparto salieron corridas —74, 74, 71, 73 en vez de 74, 71, 73, 53—
  // porque la cola de una cita se leía como cabecera de la siguiente. El paréntesis es lo que las
  // distingue, y sin este test el desplazamiento vuelve en cuanto alguien "simplifique" el regex.
  it('la referencia entre paréntesis DETRÁS es de SU cita, no de la siguiente', () => {
    const DETRAS =
      '> «Las cuestiones incidentales no suspenderán la tramitación del mismo, salvo la recusación.» (Art. 74 Ley 39/2015)\n' +
      '> «El procedimiento se impulsará de oficio en todos sus trámites y a través de medios electrónicos.» (Art. 71.1 Ley 39/2015)\n' +
      '> «Los trámites que deban cumplimentar los interesados se realizarán en el plazo de diez días.» (Art. 73.1 Ley 39/2015)'
    expect(citasAtribuidas(DETRAS).map((c: { ref: string | null }) => c.ref)).toEqual(['74', '71', '73'])
  })

  it('mezclar los dos estilos en la misma explicación no descoloca ninguno', () => {
    const MIXTO =
      '> Art. 60.1: "Será tutor del Rey menor la persona que hubiese nombrado el Rey difunto."\n' +
      '> «Las abdicaciones y renuncias se resolverán por una ley orgánica.» (Art. 57.5 CE)'
    expect(citasAtribuidas(MIXTO).map((c: { ref: string | null }) => c.ref)).toEqual(['60', '57'])
  })
})

// CASO REAL 1336a5eb (LEC art. 816): la atribución va detrás, entre paréntesis Y en cursiva
// markdown. Sin admitir el `*` en el hueco, la cola no se consumía y la cita del art. 576 salía
// atribuida al 816 — o sea, se acusaba a una pregunta correcta de citar lo que su artículo no dice.
describe('la atribución envuelta en markdown sigue siendo atribución', () => {
  const { citasAtribuidas } = require(
    require('path').join(__dirname, '..', '..', 'scripts', 'impugnaciones', 'barrido-citas.cjs'),
  )

  it('reconoce `*(Art. N …)*` en cursiva detrás de su cita', () => {
    const CURSIVA =
      '> *«Desde que se dicte el auto despachando ejecución la deuda devengará el interés a que se refiere el artículo 576.»*\n' +
      '> *(Art. 816.2 Ley 1/2000, LEC)*\n' +
      '> *«Desde que fuere dictada en primera instancia, toda sentencia que condene al pago de una cantidad líquida devengará el interés legal incrementado en dos puntos.»*\n' +
      '> *(Art. 576.1 Ley 1/2000, LEC)*'
    expect(citasAtribuidas(CURSIVA).map((c: { ref: string | null }) => c.ref)).toEqual(['816', '576'])
  })

  it('el «artículo 576» nombrado DENTRO de la primera cita no se la queda para él', () => {
    // La cita del 816.2 menciona el 576 en su propio texto. Si eso contara como atribución, la
    // primera cita se declararía del 576 y el barrido dejaría de comprobarla contra el 816.
    const CURSIVA = '> *«…devengará el interés a que se refiere el artículo 576.»*\n> *(Art. 816.2 LEC)*'
    expect(citasAtribuidas(CURSIVA)[0].ref).toBe('816')
  })
})

// CASO REAL 1d68ed6e (CE art. 43, 357 exposiciones — la nº1 del cubo por tráfico): el blockquote
// es un ESQUEMA de la estructura del Título I y lo entrecomillado son RÚBRICAS de secciones, no
// citas del articulado. Una rúbrica es un rótulo: por definición no aparece dentro del texto de
// ningún artículo, así que juzgarla como cita acusa a una pregunta correcta. Quedarse con el
// entrecomillado más largo no bastaba — aquí TODOS son rúbricas.
describe('rúbrica de división ≠ cita del articulado', () => {
  const { citasAtribuidas, citaLiteralPretendida } = require(
    require('path').join(__dirname, '..', '..', 'scripts', 'impugnaciones', 'barrido-citas.cjs'),
  )

  const ESQUEMA =
    '> **Estructura del Título I de la Constitución Española:**\n' +
    '> - **Capítulo II — Sección 1ª "De los derechos fundamentales y de las libertades públicas" (arts. 15 a 29):** derechos con la máxima protección.\n' +
    '> - **Capítulo III — "De los principios rectores de la política social y económica" (arts. 39 a 52):** no son derechos fundamentales en sentido estricto.'

  it('marca como rúbrica lo entrecomillado tras «Capítulo»/«Sección»', () => {
    expect(citasAtribuidas(ESQUEMA).every((c: { rubrica: boolean }) => c.rubrica)).toBe(true)
  })

  it('si TODO son rúbricas, no hay cita que juzgar (la pregunta no pretende citar)', () => {
    expect(citaLiteralPretendida(ESQUEMA)).toBeNull()
  })

  it('manda la referencia MÁS PEGADA: «art. 405 (Capítulo I, "…")» es rúbrica, no cita del 405', () => {
    const MIXTO = '> CP art. 405 (Capítulo I, "De la prevaricación de los funcionarios públicos"): "A la autoridad o funcionario público que, a sabiendas de su injusticia, dictare una resolución arbitraria."'
    const cs = citasAtribuidas(MIXTO)
    expect(cs[0].rubrica).toBe(true)   // el rótulo del capítulo
    expect(cs[1].rubrica).toBe(false)  // la cita de verdad
    expect(citaLiteralPretendida(MIXTO).texto).toMatch(/A la autoridad o funcionario/)
  })

  it('una cita normal NO se confunde con una rúbrica por nombrar un capítulo dentro del texto', () => {
    const DENTRO = '> Art. 12: "Las transferencias reguladas en el Capítulo V se someterán a las condiciones previstas en el presente Reglamento y en su normativa de desarrollo."'
    expect(citasAtribuidas(DENTRO)[0].rubrica).toBe(false)
  })
})

// ── La atribución declara además una LEY DISTINTA de la del artículo vinculado ──────────────────
//
// Hasta el 06/08 `refDeclaradaDistinta` resolvía la cita de apoyo SOLO dentro de la ley del
// artículo vinculado — si la atribución nombraba una ley distinta («Art. 4.2.a RP» en una
// pregunta de LOGP), la comprobación buscaba "LOGP art. 4" (que no existe con ese contenido) en
// vez de "RP art. 4" (que sí lo tiene, literal), y una pregunta correcta se acusaba de cita ajena.
// Dos casos reales (T-207, 06/08), los dos verificados a mano contra `articles.content`:
//  · `273b6309` cita LOGP art.3 (vinculado) + RP art.4.2.a (declarado, con SIGLA sola).
//  · `b72000de` cita TREBEP art.53.5 (RDL 5/2015) para una pregunta vinculada a la Ley 5/2023 de
//    Andalucía, que solo REMITE a esos principios — aquí la atribución trae DOS candidatos (la
//    sigla común "TREBEP" y el short_name real "RDL 5/2015" entre paréntesis).
describe('leyesDeclaradasParaCita — la atribución puede nombrar una ley DISTINTA, no solo otro artículo', () => {
  it('CASO REAL 273b6309: «(Art. 4.2.a RP)» declara la ley por su sigla sola', () => {
    const EXPL = '> «Cuatro. La Administración penitenciaria velará por la vida, integridad y salud de los internos.» (Art. 3.Cuatro LOGP)\n> «a) Derecho a que la Administración penitenciaria vele por sus vidas.» (Art. 4.2.a RP)'
    const citaRP = 'a) Derecho a que la Administración penitenciaria vele por sus vidas.'
    expect(leyesDeclaradasParaCita(EXPL, citaRP)).toContain('RP')
  })

  it('CASO REAL b72000de: «TREBEP (RDL 5/2015)» da DOS candidatos — la sigla y el short_name real', () => {
    const EXPL = '> Artículo 53.5 del **TREBEP (RDL 5/2015)** – **Principios éticos**: «Se abstendrán en aquellos asuntos.»'
    const cita = 'Se abstendrán en aquellos asuntos.'
    const candidatos = leyesDeclaradasParaCita(EXPL, cita)
    expect(candidatos).toContain('TREBEP')
    expect(candidatos).toContain('RDL 5/2015')
  })

  it('sin ley declarada, no hay candidatos (comportamiento de siempre: se verifica contra la vinculada)', () => {
    expect(leyesDeclaradasParaCita('> Art. 65: "El Rey recibe de los Presupuestos del Estado…"', undefined)).toEqual([])
  })

  it('un candidato que no exista como ley en la BD simplemente no resuelve nada (fail-safe): esto solo prueba la EXTRACCIÓN, no la resolución', () => {
    // "CORRECTA" no es una sigla de ley real; la función pura la puede extraer igual — la
    // seguridad la da quien la resuelve contra `laws.short_name` (el CLI), no este extractor.
    const EXPL = '> Art. 9: "Texto cualquiera." CORRECTA por el motivo X'
    expect(Array.isArray(leyesDeclaradasParaCita(EXPL, 'Texto cualquiera.'))).toBe(true)
  })
})
