/**
 * El aviso llega CUANDO hace falta, no al principio. (T-486)
 *
 * Nace medido: el 06/08 tres trabajadores verificaron un atajo de teclado contra
 * `support.microsoft.com/es-es` — la única fuente que el manual desaconseja para eso. El aviso
 * llevaba escrito desde el 04/08 17:50, dos días antes de sus turnos. Lo TENÍAN. El manual tiene
 * 2.157 líneas y el encargo dice «léelo entero primero», que nadie hace antes de cada tarea.
 */
const path = require('path')
const AV = require(path.join(process.cwd(), 'lib', 'impugnaciones', 'avisosPorMateria.cjs'))

describe('avisosPara — reconoce la materia', () => {
  it('caza el caso REAL que lo motivó, con las tres formas de escribir un atajo', () => {
    for (const t of [
      '¿Qué combinación de teclas se utiliza para crear una nueva tarea en Outlook?',
      'Señale el método abreviado de teclado para guardar',
      'El atajo Ctrl+Mayús+K sirve para…',
    ]) {
      expect(AV.avisosPara(t).map((a) => a.id)).toContain('atajos_teclado')
    }
  })

  it('caza también las opciones, no solo el enunciado', () => {
    // El enunciado puede no decir «atajo» y las opciones ser todas combinaciones de teclas.
    expect(AV.avisosPara('¿Cómo se crea una tarea nueva?', 'Ctrl + Mayús + K', 'Ctrl + T')
      .map((a) => a.id)).toContain('atajos_teclado')
  })

  it('reconoce la imagen invocada, el fuera-de-temario y el examen oficial', () => {
    expect(AV.avisosPara('observa la figura 1 y responde').map((a) => a.id)).toContain('imagen_invocada')
    expect(AV.avisosPara('esto no entra en mi temario').map((a) => a.id)).toContain('fuera_de_temario')
    expect(AV.avisosPara('salió en el examen oficial de 2024').map((a) => a.id)).toContain('examen_oficial')
  })

  // Un aviso que sale siempre deja de leerse, que es exactamente el fallo del manual de 2.157
  // líneas que esto viene a arreglar.
  it('NO dice nada cuando no toca', () => {
    expect(AV.avisosPara('¿Cuál es el plazo para interponer recurso de alzada?')).toEqual([])
    expect(AV.avisosPara('')).toEqual([])
    expect(AV.avisosPara(null, undefined)).toEqual([])
  })
})

describe('el contenido del aviso', () => {
  it('el de atajos dice qué NO hacer y qué hacer en su lugar', () => {
    const txt = AV.formatear(AV.avisosPara('atajo Ctrl+G')).join('\n')
    expect(txt).toMatch(/support\.microsoft\.com\/es-es/)
    expect(txt).toMatch(/INTERNACIONALES/)
    expect(txt).toMatch(/PRUEBA DISCRIMINANTE/)
    expect(txt).toMatch(/curl/)
  })

  it('lleva la CIFRA del caso: es lo que hace que se lea', () => {
    expect(AV.formatear(AV.avisosPara('atajo Ctrl+G')).join('\n')).toMatch(/TRES trabajadores/)
  })

  it('son CORTOS: uno de veinte líneas se salta igual que el manual', () => {
    for (const a of AV.AVISOS) expect(a.lineas.length).toBeLessThanOrEqual(16)
  })

  it('cada aviso apunta a dónde está el detalle, para no duplicar el manual', () => {
    const conDetalle = AV.AVISOS.filter((a) => a.lineas.join(' ').match(/docs\/|npm run|`[a-z_]+\.cjs`/))
    expect(conDetalle.length).toBeGreaterThanOrEqual(3)
  })
})

describe('el dossier lo imprime', () => {
  const src = require('fs').readFileSync(
    path.join(process.cwd(), 'scripts', 'impugnaciones', 'revisar-impugnacion.cjs'), 'utf8')

  it('lo llama con el enunciado, las opciones Y lo que escribió el usuario', () => {
    expect(src).toMatch(/avisosPara\(q\.question_text/)
    expect(src).toMatch(/d\.appeal_text/)
  })

  it('y ANTES de la checklist: después ya se habría elegido la fuente', () => {
    expect(src.indexOf('AV.formatear')).toBeLessThan(src.indexOf('CHECKLIST OBLIGATORIA'))
  })
})
