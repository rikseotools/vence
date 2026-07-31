/**
 * @jest-environment node
 */
// Unitarios de la decisión PURA que impide que `backlog.cjs sync` le pise el título a la tarea de
// otra sesión. Importa el módulo REAL de producción, nunca una copia.
//
// El caso de origen (28/07): otra sesión reservó T-225 en la BD a las 09:17, su ficha aún no estaba
// pusheada, y el `sync` de esta sesión reconcilió el id como si fuera suyo. El detector que ya
// existía solo miraba ids repetidos DENTRO del markdown, donde este choque no se ve.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esOtraTarea, esColisionReal, parecido } = require('@/lib/backlog/syncGuard.cjs') as {
  esOtraTarea: (bd: string | null, md: string | null) => boolean
  esColisionReal: (caso: {
    tituloBd: string | null; tituloMd: string | null; estuvoEnElHistorial: boolean
  }) => boolean
  parecido: (a: string, b: string) => number
}

const T225_BD = 'El pre-commit no corre `typecheck`: un `main` rojo por tipos bloquea el gate de deploy de TODAS las sesiones'
const T225_MD = 'La FAQ que ingiere Google sigue diciendo la frase AMBIGUA de las plazas: la redacción nueva vive en una rama muerta'

describe('esOtraTarea — parar antes de pisar la tarea de otra sesión', () => {
  it('CAZA el choque real del 28/07 (T-225)', () => {
    expect(esOtraTarea(T225_BD, T225_MD)).toBe(true)
    expect(parecido(T225_BD, T225_MD)).toBeLessThan(0.25)
  })

  it('NO estorba cuando el título es el mismo', () => {
    expect(esOtraTarea(T225_BD, T225_BD)).toBe(false)
  })

  it('NO estorba al rellenar el hueco que deja `reserve`', () => {
    // `reserve` inserta un título provisional a propósito: sustituirlo ES su función, y tratarlo
    // como colisión rompería el flujo que el runbook manda usar.
    expect(esOtraTarea('RESERVADA — ficha pendiente de escribir en el markdown', T225_MD)).toBe(false)
  })

  it('NO estorba al afinar la redacción de la misma ficha (retitulado legítimo)', () => {
    const antes = 'Convocatorias que no declaran si el cupo de discapacidad va DENTRO de las plazas libres'
    const despues = 'Convocatorias que no declaran si el cupo de discapacidad va dentro de las plazas libres — y la vista las suma por defecto'
    expect(esOtraTarea(antes, despues)).toBe(false)
  })

  it('distingue por VOCABULARIO, no por longitud: dos títulos largos y ajenos siguen siendo ajenos', () => {
    const a = 'El 52-68% de los usuarios ACTIVOS ve errores de fetch en el cliente y nadie se entera'
    const b = 'Provenance: 104 señales OEP aplicadas sin documento curado y los PDF que ningún extractor lee'
    expect(esOtraTarea(a, b)).toBe(true)
  })

  it('con material insuficiente NO opina (un guardarraíl que grita por nada se acaba saltando)', () => {
    expect(esOtraTarea(null, T225_MD)).toBe(false)
    expect(esOtraTarea('', T225_MD)).toBe(false)
    expect(esOtraTarea(T225_BD, '')).toBe(false)
  })

  it('los acentos y el markdown del título no cuentan como diferencia', () => {
    expect(esOtraTarea('La redacción **nueva** vive en una rama muerta', 'La redaccion nueva vive en una rama muerta')).toBe(false)
  })
})

describe('esColisionReal — separar la colisión del retitulado (29/07)', () => {
  // Dos casos REALES del mismo día, con diez minutos entre uno y otro. Los dos abortaban el sync
  // de TODAS las sesiones, y ese aborto fue lo que ocultó durante horas que las fichas de T-251 y
  // T-254 se habían borrado de `main`.
  const T219_BD = '308 preguntas de «señale la INCORRECTA» sirven un encabezado que se contradice a sí mismo'
  const T219_MD = 'El marco contradictorio de las preguntas de tipo NEGATIVO'
  const T089_BD = 'Migración a Koigrid — POC whole-stack OK y **gate de PICO SUPERADO**'
  const T089_MD = 'Migración a Koigrid — **A3 RESUELTO: ya no queda bloqueo técnico.**'

  it('T-219: el retitulado de una ficha NUESTRA ya no se toma por colisión', () => {
    // Sin una palabra en común: `esOtraTarea` sigue diciendo "son distintos"…
    expect(esOtraTarea(T219_BD, T219_MD)).toBe(true)
    // …pero la ficha ya estaba en el historial del fichero, así que es nuestra.
    expect(esColisionReal({
      tituloBd: T219_BD, tituloMd: T219_MD, estuvoEnElHistorial: true,
    })).toBe(false)
  })

  it('T-089: igual con el retitulado al desbloquearse el trabajo', () => {
    expect(esColisionReal({
      tituloBd: T089_BD, tituloMd: T089_MD, estuvoEnElHistorial: true,
    })).toBe(false)
  })

  it('REGRESIÓN — el caso T-225 que creó el guardarraíl SIGUE parando', () => {
    // Aquí la ficha era NUEVA en ese markdown (otra sesión había reservado el id y su ficha no
    // estaba pusheada), así que el historial no la tenía. Si esto se pusiera en verde, habríamos
    // reabierto el agujero que el guardarraíl existe para tapar.
    expect(esColisionReal({
      tituloBd: T225_BD, tituloMd: T225_MD, estuvoEnElHistorial: false,
    })).toBe(true)
  })

  it('el historial NO indulta por sí solo: si los títulos se parecen, nunca hubo conflicto', () => {
    expect(esColisionReal({
      tituloBd: T219_MD, tituloMd: T219_MD, estuvoEnElHistorial: false,
    })).toBe(false)
  })

  it('sin material para juzgar, no opina (igual que esOtraTarea)', () => {
    expect(esColisionReal({ tituloBd: null, tituloMd: 'algo', estuvoEnElHistorial: false })).toBe(false)
    expect(esColisionReal({ tituloBd: '', tituloMd: '', estuvoEnElHistorial: false })).toBe(false)
  })

  // El historial cuesta ~1 s por ficha (`git log -S` sobre un markdown de 2 MB). Desde que el
  // guard mira las 177 tareas vivas y no 32 (T-382), resolverlo para todas dejaba el `sync` en
  // más de dos minutos. Perezoso, solo se paga por las divergencias reales.
  it('acepta el historial PEREZOSO (función) además de booleano', () => {
    const espia = jest.fn(() => true)
    expect(esColisionReal({ tituloBd: 'Alfa beta gamma', tituloMd: 'Delta epsilon zeta', estuvoEnElHistorial: espia })).toBe(false)
    expect(espia).toHaveBeenCalledTimes(1)
  })

  it('NO resuelve el historial si los títulos ya se parecen (ahí no hay nada que decidir)', () => {
    const espia = jest.fn(() => false)
    expect(esColisionReal({ tituloBd: 'Alfa beta gamma delta', tituloMd: 'Alfa beta gamma delta épsilon', estuvoEnElHistorial: espia })).toBe(false)
    expect(espia).not.toHaveBeenCalled()
  })

  it('tolera que no le pasen nada', () => {
    // @ts-expect-error — entrada inválida a propósito
    expect(esColisionReal(undefined)).toBe(false)
  })
})
