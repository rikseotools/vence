/**
 * Detector de explicaciones cortadas a mitad de frase (T-250).
 *
 * Todos los casos de este fichero salen del banco VIVO, no están inventados: los positivos son
 * cortes reales que el detector encuentra hoy y los negativos son los falsos positivos concretos
 * que hundían la heurística anterior («no acaba en signo de cierre» daba 8.938 aciertos inservibles
 * sobre 136.304 explicaciones).
 *
 * Lo que defiende: que el criterio siga siendo GRAMATICAL —la última palabra pide continuación— y
 * no ortográfico. Si alguien lo relaja a «no termina en punto», estos negativos se ponen rojos.
 */

const { clasificaTruncada } = require('../../lib/health/explicacionTruncada.cjs')

const marca = (explanation: string) => clasificaTruncada({ explanation })

describe('cortes REALES del banco', () => {
  it.each([
    // Terminan en preposición o determinante: falta el complemento.
    ['…los miembros del Cuerpo Nacional de', 'palabra_funcional'],
    ['…podrá optar por la vecindad civil del otro', 'palabra_funcional'],
    ['Delitos dolosos castigados con pena con límite máximo de, al menos, tres años de', 'palabra_funcional'],
    ['Ver "Responsabilidad de los jueces" en', 'palabra_funcional'],
    ['seleccionar "Elegir una aplicación" y seleccionar la', 'palabra_funcional'],
    // Terminan en conjunción o relativo: falta el segundo término.
    ['están obligados a observar estrictamente las formalidades legales e', 'palabra_funcional'],
    ['Pierden la nacionalidad española los emancipados que', 'palabra_funcional'],
    ['hayan sido ordenadas previamente contra el responsable o', 'palabra_funcional'],
    ['pena privativa de libertad igual o inferior a tres años, o de dos años si', 'palabra_funcional'],
    // Terminan en coma: la enumeración o la subordinada se quedaron a medias.
    ['obtuviere de un funcionario público o autoridad,', 'coma_final'],
    ['la observancia de los derechos reconocidos en este Pacto,', 'coma_final'],
    ['los Delegados del Gobierno en las comunidades autónomas y en las Ciudades de Ceuta y Melilla,', 'coma_final'],
    ['porque se evita la duplicación de tareas,', 'coma_final'],
  ])('marca %j como %s', (texto, motivo) => {
    const r = marca(texto)
    expect(r.truncada).toBe(true)
    expect(r.motivo).toBe(motivo)
  })
})

describe('NO son cortes: los falsos positivos que hundían la heurística ortográfica', () => {
  it.each([
    // Frase entera, solo mal puntuada. Es el grueso de las 8.938 y no es un defecto de contenido.
    'no discriminación y accesibilidad universal de las personas con discapacidad',
    'sellos electrónicos durante el tiempo exigido por la legislación vigente',
    // Cierre con la referencia de la fuente, convención de la casa.
    'ha de ser ley orgánica, no ley ordinaria.\n\n*Constitución Española, Art. 147',
    'Fuente: Arts. 62, 63 y 116 de la Constitución Española de 1978',
    // Enlaces: el último carácter pertenece a la URL, no a la gramática. La «y» de `isAllowed=y`
    // engañaba al detector por ser también conjunción.
    'Más información en https://rebiun.org/informe_REBIUN.pdf?sequence=4&isAllowed=y',
    'https://support.microsoft.com/es-es/help/12445/windows-keyboard-shortcuts',
    // Locución que cierra legítimamente una enumeración abierta.
    'guantes, sondas, antibióticos, material quirúrgico, entre otros',
    // El falso positivo de la muestra: tabla de coordenadas donde la «O» final es Oeste.
    '0° a 90° N E 0° a 90° 0° a -180° N O 0° a -90° 0° a 180° S E 0° a -90° 0° a -180º S O',
    // Cierres normales, con y sin markdown.
    'La respuesta correcta se apoya en el artículo 137.',
    'El plazo es de **diez días**.',
    'Se enumeran los siguientes supuestos:',
  ])('no marca %j', (texto) => {
    expect(marca(texto).truncada).toBe(false)
  })

  it('el markdown de cierre no puede tapar un corte real', () => {
    // El `**` final se limpia ANTES de mirar la última palabra: si no, «…dependan,**» pasaría por
    // texto acabado en asterisco y el corte quedaría invisible.
    expect(marca('el Juez o Tribunal **del que dependan,**').truncada).toBe(true)
    expect(marca('el Juez o Tribunal **del que dependan,**').motivo).toBe('coma_final')
  })

  it('una explicación vacía o nula no es un corte', () => {
    expect(marca('').truncada).toBe(false)
    expect(clasificaTruncada({}).truncada).toBe(false)
    expect(clasificaTruncada({ explanation: null }).truncada).toBe(false)
  })
})
