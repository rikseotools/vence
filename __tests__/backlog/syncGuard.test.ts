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
const { esOtraTarea, parecido } = require('@/lib/backlog/syncGuard.cjs') as {
  esOtraTarea: (bd: string | null, md: string | null) => boolean
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
