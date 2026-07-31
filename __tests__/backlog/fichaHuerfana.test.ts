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
//
// El caso de T-427 (31/07): ese arreglo llevaba DOS DÍAS en `main` cuando ocurrió el incidente que
// tenía que cazar… y lo anunció como sano. Miraba el historial de la rama LOCAL, y un worktree no
// alcanza lo que otra sesión pushee después de haberlo creado — es decir, era ciego justo para las
// fichas AJENAS, que son las que protege. La prueba está en `origin/main`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarHuerfana, clasificarHuerfanas, MOTIVOS } = require('@/lib/backlog/fichaHuerfana.cjs') as {
  clasificarHuerfana: (h: Huerfana) => Veredicto
  clasificarHuerfanas: (hs: Huerfana[]) => {
    todas: Veredicto[]
    borradas: string[]
    noVerificables: string[]
    miasSinEscribir: string[]
    desactualizadas: string[]
    sinPushear: string[]
  }
  MOTIVOS: readonly string[]
}

type Origen = { consultable: boolean; estaAhora: boolean; estuvo: boolean }
type Huerfana = { id: string; estuvoEnElMarkdown?: boolean; esMia?: boolean; origen?: Origen }
type Veredicto = {
  id: string
  motivo: 'borrada' | 'no_verificable' | 'mia_sin_escribir' | 'desactualizada' | 'sin_pushear'
  esRegresion: boolean
  alcance: 'origin' | 'local' | 'ninguno'
}

/** `origin/main` visto desde una sesión sana. */
const origen = (estaAhora: boolean, estuvo: boolean): Origen => ({ consultable: true, estaAhora, estuvo })
const SIN_ORIGIN: Origen = { consultable: false, estaAhora: false, estuvo: false }

describe('clasificarHuerfana — regresión vs trabajo en vuelo', () => {
  it('CAZA el caso real del 29/07: la ficha estuvo en el markdown y desapareció', () => {
    // T-254 y T-251 se escribieron el 28/07 y las borró un commit posterior con el fichero rancio.
    expect(clasificarHuerfana({ id: 'T-254', estuvoEnElMarkdown: true, origen: origen(false, true) }))
      .toEqual({ id: 'T-254', motivo: 'borrada', esRegresion: true, alcance: 'origin' })
  })

  it('NO grita por la ficha que otra sesión todavía no ha pusheado', () => {
    // T-260 vive en el worktree `feedback-impugnaciones`; su id está reservado en la tabla y su
    // ficha aún no ha llegado a NINGUNA rama compartida. Eso es el claim funcionando, no un fallo.
    const r = clasificarHuerfana({ id: 'T-260', estuvoEnElMarkdown: false, origen: origen(false, false) })
    expect(r.motivo).toBe('sin_pushear')
    expect(r.esRegresion).toBe(false)
  })

  it('la antigüedad de la tarea NO decide: solo decide el historial del fichero', () => {
    // Dos tareas idénticas salvo por el historial tienen que salir distintas. Si algún día se
    // intenta inferir el motivo del `created_at`, este test se pone rojo — y con razón: una tarea
    // puede llevar días viva con la ficha sin pushear, y otra perderla al commit siguiente.
    expect(clasificarHuerfana({ id: 'T-900', origen: origen(false, true) }).motivo).toBe('borrada')
    expect(clasificarHuerfana({ id: 'T-900', origen: origen(false, false) }).motivo).toBe('sin_pushear')
  })

  it('exige un id: sin id no hay nada que clasificar', () => {
    expect(() => clasificarHuerfana({ id: '', estuvoEnElMarkdown: true })).toThrow(TypeError)
    // @ts-expect-error — probamos a propósito la entrada inválida
    expect(() => clasificarHuerfana(null)).toThrow(TypeError)
  })
})

describe('T-427 — el punto ciego: la prueba está en origin/main, no en mi rama', () => {
  it('REGRESIÓN del 31/07: ficha AJENA borrada de main que mi worktree nunca llegó a ver', () => {
    // Esto es el incidente exacto, y es el test que antes no existía. La sesión que corrió el sync
    // había creado su worktree ANTES de que `e0adb142a` añadiera la ficha de T-418, así que su
    // historial local no la contenía (comprobado: el pickaxe desde `e0adb142a^` devuelve vacío).
    // Con el criterio viejo eso daba `sin_pushear` — verde — el mismo día en que `a9797ae3a` la
    // había borrado de `main`.
    const r = clasificarHuerfana({
      id: 'T-418',
      estuvoEnElMarkdown: false,        // ← mi rama no la vio JAMÁS
      origen: origen(false, true),      // ← pero origin/main sí la tuvo
    })
    expect(r.motivo).toBe('borrada')
    expect(r.esRegresion).toBe(true)
    expect(r.alcance).toBe('origin')
  })

  it('«mi rama va por detrás» NO es una ficha que falte: la ficha está viva en origin/main', () => {
    // Antes este caso se disfrazaba de `sin_pushear`, que manda a la sesión a escribir una ficha
    // que ya existe — y así es como nacen dos fichas del mismo id.
    const r = clasificarHuerfana({ id: 'T-430', estuvoEnElMarkdown: false, origen: origen(true, true) })
    expect(r.motivo).toBe('desactualizada')
    expect(r.esRegresion).toBe(false)
  })

  it('sin poder ver origin/main dice «no lo sé», nunca «está bien»', () => {
    const r = clasificarHuerfana({ id: 'T-431', estuvoEnElMarkdown: false, origen: SIN_ORIGIN })
    expect(r.motivo).toBe('no_verificable')
    expect(r.esRegresion).toBe(false)
    expect(r.alcance).toBe('ninguno')
  })

  it('un llamador que NO pasa los hechos de origin tampoco recibe un verde', () => {
    // Trinquete contra la vuelta atrás: si alguien reintroduce la llamada local-only de antes,
    // el resultado es `no_verificable` (ruidoso y honesto), nunca `sin_pushear`.
    expect(clasificarHuerfana({ id: 'T-432', estuvoEnElMarkdown: false }).motivo).toBe('no_verificable')
  })

  it('sigue cazando la regresión LOCAL: me la llevé yo y aún no lo he pusheado', () => {
    // La ficha nunca llegó a origin (por eso `estuvo:false`), pero estuvo en mi rama y ya no está.
    // Es una regresión igual, y hay que decir que se ve en local para no mandar a nadie a mirar main.
    const r = clasificarHuerfana({ id: 'T-433', estuvoEnElMarkdown: true, origen: origen(false, false) })
    expect(r.motivo).toBe('borrada')
    expect(r.alcance).toBe('local')
  })

  it('los motivos van declarados de más a menos accionable', () => {
    // `en_otra_rama` (T-445) va EL ÚLTIMO a propósito: es el único donde no hay nada que hacer
    // salvo esperar a que esa sesión fusione. `sin_pushear` queda por delante porque, desde que
    // significa «en NINGUNA rama», es también la pinta que tiene el trabajo perdido.
    expect(MOTIVOS).toEqual([
      'borrada', 'no_verificable', 'mia_sin_escribir', 'desactualizada', 'sin_pushear', 'en_otra_rama',
    ])
  })
})

describe('mia_sin_escribir — la ficha que NUNCA llegó a existir', () => {
  // Caso propio del 31/07: se escribió la ficha de T-435, `sync` la reconcilió, y no entró en
  // ningún commit — `git log -S` no la encuentra en ninguna revisión. El aviso la dio por
  // `sin_pushear`, que era CORRECTO (en el historial no estuvo nunca) y por eso sonó inofensivo.
  // Ni T-427 ni T-428 cubren esto: los dos protegen contra BORRAR una ficha que ya existió.
  it('si la tarea la tengo YO reclamada, «otra sesión no la ha pusheado» es imposible', () => {
    const r = clasificarHuerfana({
      id: 'T-435', estuvoEnElMarkdown: false, esMia: true, origen: origen(false, false),
    })
    expect(r.motivo).toBe('mia_sin_escribir')
    expect(r.esRegresion).toBe(false)   // no es una regresión: es trabajo mío sin terminar
  })

  it('la MISMA fila, si la tiene otra sesión, sigue siendo trabajo en vuelo normal', () => {
    // El discriminante es el claim, no el id ni la antigüedad.
    expect(clasificarHuerfana({ id: 'T-435', esMia: false, origen: origen(false, false) }).motivo)
      .toBe('sin_pushear')
  })

  it('no pisa a los motivos más graves: si estuvo en origin, sigue siendo BORRADA', () => {
    expect(clasificarHuerfana({ id: 'T-435', esMia: true, origen: origen(false, true) }).motivo)
      .toBe('borrada')
  })

  it('el lote lo separa en su propio grupo', () => {
    const r = clasificarHuerfanas([
      { id: 'T-435', esMia: true, origen: origen(false, false) },
      { id: 'T-260', esMia: false, origen: origen(false, false) },
    ])
    expect(r.miasSinEscribir).toEqual(['T-435'])
    expect(r.sinPushear).toEqual(['T-260'])
  })
})

describe('clasificarHuerfanas — el lote se separa para que la regresión no quede tapada', () => {
  it('separa los cuatro grupos, cada uno con su acción distinta', () => {
    const r = clasificarHuerfanas([
      { id: 'T-254', estuvoEnElMarkdown: true, origen: origen(false, true) },
      { id: 'T-418', estuvoEnElMarkdown: false, origen: origen(false, true) },
      { id: 'T-430', estuvoEnElMarkdown: false, origen: origen(true, true) },
      { id: 'T-260', estuvoEnElMarkdown: false, origen: origen(false, false) },
      { id: 'T-431', estuvoEnElMarkdown: false, origen: SIN_ORIGIN },
    ])
    expect(r.borradas).toEqual(['T-254', 'T-418'])
    expect(r.desactualizadas).toEqual(['T-430'])
    expect(r.sinPushear).toEqual(['T-260'])
    expect(r.noVerificables).toEqual(['T-431'])
    expect(r.todas).toHaveLength(5)
  })

  it('el día normal no produce NADA accionable (el aviso no se gasta)', () => {
    const r = clasificarHuerfanas([
      { id: 'T-260', estuvoEnElMarkdown: false, origen: origen(false, false) },
      { id: 'T-261', estuvoEnElMarkdown: false, origen: origen(false, false) },
    ])
    expect(r.borradas).toEqual([])
    expect(r.noVerificables).toEqual([])
    expect(r.sinPushear).toHaveLength(2)
  })

  it('tolera la lista vacía y la ausencia de lista', () => {
    expect(clasificarHuerfanas([]).borradas).toEqual([])
    // @ts-expect-error — el llamador puede no tener nada que pasar
    expect(clasificarHuerfanas(undefined).todas).toEqual([])
  })
})
