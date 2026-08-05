// __tests__/lib/laws/lawNameResuelta.test.ts
//
// Núcleo puro del criterio de `law_name` (T-559). Importa la función REAL, nunca una copia.
import {
  esLeyResuelta,
  decidirLawNamePersistida,
  RELLENOS_DE_LEY,
  EVENTO_LAW_NAME_SIN_RESOLVER,
} from '@/lib/laws/lawNameResuelta'

describe('esLeyResuelta — el criterio único de "esto es una ley de verdad"', () => {
  it.each(['CE', 'Ley 39/2015', 'Excel 365', 'LO 3/2007', 'Explorador Windows 10'])(
    'acepta la ley real %s',
    (ley) => {
      expect(esLeyResuelta(ley)).toBe(true)
    },
  )

  it.each([null, undefined, '', '   '])('rechaza el vacío (%p)', (v) => {
    expect(esLeyResuelta(v as string | null | undefined)).toBe(false)
  })

  it.each([...RELLENOS_DE_LEY])('rechaza el relleno %s', (relleno) => {
    expect(esLeyResuelta(relleno)).toBe(false)
  })

  it('rechaza el relleno aunque venga con otra caja o con espacios', () => {
    // El literal que se persistió 15.109 veces llegaba tal cual, pero un cliente
    // puede mandarlo capitalizado: el criterio no puede depender de eso.
    expect(esLeyResuelta('Unknown')).toBe(false)
    expect(esLeyResuelta('  UNKNOWN  ')).toBe(false)
    expect(esLeyResuelta('undefined')).toBe(false)
  })

  it('NO rechaza una ley real que contenga un relleno como subcadena', () => {
    // Guarda anti-exceso: el corte es por valor completo, no por `includes`.
    expect(esLeyResuelta('Ley de lo Desconocido (unknown)')).toBe(true)
  })
})

describe('decidirLawNamePersistida — qué se guarda y cuándo se emite', () => {
  const base = {
    delCliente: null,
    resueltaDesdeArticulo: null,
    tieneArticulo: true,
    esPsicotecnica: false,
  }

  it('usa la ley del cliente cuando es válida, sin emitir', () => {
    const d = decidirLawNamePersistida({ ...base, delCliente: 'Ley 39/2015' })
    expect(d).toEqual({ lawName: 'Ley 39/2015', emitir: false, motivo: 'del_cliente' })
  })

  it('resuelve desde el artículo cuando el cliente no manda nada', () => {
    const d = decidirLawNamePersistida({ ...base, resueltaDesdeArticulo: 'Excel 365' })
    expect(d).toEqual({ lawName: 'Excel 365', emitir: false, motivo: 'resuelta_desde_articulo' })
  })

  it('🔒 EL BUG: el relleno del cliente NO gana a la ley resuelta', () => {
    // Esta es la regresión de T-559. El escritor hacía `delCliente || resuelta`, y como
    // 'unknown' es truthy, el relleno ganaba y se persistía la ley inventada.
    const d = decidirLawNamePersistida({
      ...base,
      delCliente: 'unknown',
      resueltaDesdeArticulo: 'Excel 365',
    })
    expect(d.lawName).toBe('Excel 365')
    expect(d.motivo).toBe('resuelta_desde_articulo')
  })

  it('🔒 EL BUG: nunca persiste el relleno, ni aunque sea lo único que hay', () => {
    const d = decidirLawNamePersistida({ ...base, delCliente: 'unknown' })
    expect(d.lawName).toBeNull()
    expect(RELLENOS_DE_LEY).not.toContain(d.lawName as unknown as string)
  })

  it('recorta el espacio sobrante de la ley que persiste', () => {
    expect(decidirLawNamePersistida({ ...base, delCliente: '  CE  ' }).lawName).toBe('CE')
  })

  describe('cuándo se emite (regla: un null inesperado NO se guarda en silencio)', () => {
    it('EMITE si había article_id y aun así no se resolvió', () => {
      const d = decidirLawNamePersistida({ ...base, tieneArticulo: true })
      expect(d).toEqual({ lawName: null, emitir: true, motivo: 'irresoluble_con_articulo' })
    })

    it('NO emite en psicotécnicas: no tienen ley por diseño', () => {
      // Son miles al día; emitir aquí ahogaría la señal que sí importa.
      const d = decidirLawNamePersistida({ ...base, esPsicotecnica: true, tieneArticulo: false })
      expect(d).toEqual({ lawName: null, emitir: false, motivo: 'psicotecnica_sin_ley' })
    })

    it('NO emite si no había article_id con el que resolver', () => {
      const d = decidirLawNamePersistida({ ...base, tieneArticulo: false })
      expect(d).toEqual({ lawName: null, emitir: false, motivo: 'sin_articulo_que_resolver' })
    })

    it('la psicotécnica manda sobre el artículo: no se emite aunque traiga article_id', () => {
      const d = decidirLawNamePersistida({ ...base, esPsicotecnica: true, tieneArticulo: true })
      expect(d.emitir).toBe(false)
      expect(d.motivo).toBe('psicotecnica_sin_ley')
    })
  })

  it('NUNCA devuelve un relleno, sea cual sea la entrada', () => {
    // Barrido del producto cartesiano: la propiedad que sostiene todo lo demás.
    const valores = [null, undefined, '', '  ', 'unknown', 'UNKNOWN', 'undefined', 'null', 'CE']
    for (const delCliente of valores) {
      for (const resueltaDesdeArticulo of valores) {
        for (const tieneArticulo of [true, false]) {
          for (const esPsicotecnica of [true, false]) {
            const d = decidirLawNamePersistida({
              delCliente,
              resueltaDesdeArticulo,
              tieneArticulo,
              esPsicotecnica,
            })
            if (d.lawName !== null) expect(esLeyResuelta(d.lawName)).toBe(true)
          }
        }
      }
    }
  })
})

describe('contrato del evento', () => {
  it('el nombre del evento es único y estable (los dos gemelos emiten el mismo)', () => {
    expect(EVENTO_LAW_NAME_SIN_RESOLVER).toBe('law_name_sin_resolver')
  })
})
