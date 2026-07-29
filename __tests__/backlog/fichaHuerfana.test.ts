/**
 * @jest-environment node
 */
// Unitarios de la decisión PURA que separa «me han borrado la ficha» de «otra sesión aún no ha
// pusheado la suya». Importa el módulo REAL de producción, nunca una copia.
//
// El caso de origen (29/07): el commit de tests `4127f3e17` subió una copia rancia del markdown y
// borró de `main` las fichas de T-251 y T-254. Las dos tareas seguían VIVAS en `backlog_tasks`, así
// que `list` las ofrecía por su título y detrás no había ficha que leer. El aviso que lo cazaba ya
// existía, pero (a) se imprimía después de dos `process.exit(2)` y (b) no distinguía la regresión
// del trabajo en vuelo de las otras sesiones, que con 2-10 sesiones a la vez es lo NORMAL.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarHuerfana, clasificarHuerfanas } = require('@/lib/backlog/fichaHuerfana.cjs') as {
  clasificarHuerfana: (h: { id: string; estuvoEnElMarkdown: boolean }) => {
    id: string; motivo: 'borrada' | 'sin_pushear'; esRegresion: boolean
  }
  clasificarHuerfanas: (hs: Array<{ id: string; estuvoEnElMarkdown: boolean }>) => {
    todas: Array<{ id: string; motivo: string; esRegresion: boolean }>
    borradas: string[]
    sinPushear: string[]
  }
}

describe('clasificarHuerfana — regresión vs trabajo en vuelo', () => {
  it('CAZA el caso real del 29/07: la ficha estuvo en el markdown y desapareció', () => {
    // T-254 y T-251 se escribieron el 28/07 y las borró un commit posterior con el fichero rancio.
    expect(clasificarHuerfana({ id: 'T-254', estuvoEnElMarkdown: true })).toEqual({
      id: 'T-254', motivo: 'borrada', esRegresion: true,
    })
  })

  it('NO grita por la ficha que otra sesión todavía no ha pusheado', () => {
    // T-260 vive en el worktree `feedback-impugnaciones`; su id está reservado en la tabla y su
    // ficha aún no ha llegado a esta rama. Eso es el funcionamiento normal del claim, no un fallo.
    const r = clasificarHuerfana({ id: 'T-260', estuvoEnElMarkdown: false })
    expect(r.motivo).toBe('sin_pushear')
    expect(r.esRegresion).toBe(false)
  })

  it('la antigüedad de la tarea NO decide: solo decide el historial del fichero', () => {
    // Dos tareas idénticas salvo por el historial tienen que salir distintas. Si algún día se
    // intenta inferir el motivo del `created_at`, este test se pone rojo — y con razón: una tarea
    // puede llevar días viva con la ficha sin pushear, y otra perderla al commit siguiente.
    expect(clasificarHuerfana({ id: 'T-900', estuvoEnElMarkdown: true }).motivo).toBe('borrada')
    expect(clasificarHuerfana({ id: 'T-900', estuvoEnElMarkdown: false }).motivo).toBe('sin_pushear')
  })

  it('exige un id: sin id no hay nada que clasificar', () => {
    expect(() => clasificarHuerfana({ id: '', estuvoEnElMarkdown: true })).toThrow(TypeError)
    // @ts-expect-error — probamos a propósito la entrada inválida
    expect(() => clasificarHuerfana(null)).toThrow(TypeError)
  })
})

describe('clasificarHuerfanas — el lote se separa para que la regresión no quede tapada', () => {
  it('separa las borradas de las que solo están sin pushear', () => {
    const r = clasificarHuerfanas([
      { id: 'T-254', estuvoEnElMarkdown: true },
      { id: 'T-251', estuvoEnElMarkdown: true },
      { id: 'T-260', estuvoEnElMarkdown: false },
      { id: 'T-238', estuvoEnElMarkdown: false },
    ])
    expect(r.borradas).toEqual(['T-254', 'T-251'])
    expect(r.sinPushear).toEqual(['T-260', 'T-238'])
    expect(r.todas).toHaveLength(4)
  })

  it('el día normal no produce NADA accionable (el aviso no se gasta)', () => {
    const r = clasificarHuerfanas([
      { id: 'T-260', estuvoEnElMarkdown: false },
      { id: 'T-261', estuvoEnElMarkdown: false },
    ])
    expect(r.borradas).toEqual([])
    expect(r.sinPushear).toHaveLength(2)
  })

  it('tolera la lista vacía y la ausencia de lista', () => {
    expect(clasificarHuerfanas([]).borradas).toEqual([])
    // @ts-expect-error — el llamador puede no tener nada que pasar
    expect(clasificarHuerfanas(undefined).todas).toEqual([])
  })
})
