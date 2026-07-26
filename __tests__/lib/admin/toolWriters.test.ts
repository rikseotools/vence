// Tests del núcleo puro que detecta ESCRITURAS a recursos sensibles (T-130).
//
// Es la pieza de la que depende que el guardarraíl anti-duplicado sea fiable o ruidoso. Si detecta
// de más, el CI se pone rojo por SELECTs y esquemas y se aprende a ignorar (la lección de
// `hash_change`). Si detecta de menos, alguien abre una puerta nueva al mismo dato y nadie se entera
// — que es justo lo que pasó el 26/07 con `seguimiento_url`.
//
// Los fragmentos son las formas REALES en que este repo escribe: `postgres` con template literal,
// Drizzle `.set({})`, y SQL crudo multilínea.

import {
  RECURSOS_SENSIBLES,
  escribeRecurso,
  recursosEscritos,
  esDefinicionDeEsquema,
} from '../../../lib/admin/toolWriters'

const seguimiento = RECURSOS_SENSIBLES.find((r) => r.columna === 'seguimiento_url')!
const lifecycle = RECURSOS_SENSIBLES.find((r) => r.columna === 'lifecycle_state')!

describe('escribeRecurso — detecta las formas reales de escribir', () => {
  it('UPDATE … SET col = (template literal de `postgres`)', () => {
    const codigo = "await sql`UPDATE oposiciones SET seguimiento_url = ${url} WHERE id = ${id}`"
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })

  it('UPDATE … SET multilínea con varias columnas', () => {
    const codigo = `
      await tx\`
        UPDATE oposiciones
           SET seguimiento_last_hash = NULL,
               seguimiento_url = \${nueva},
               seguimiento_change_status = 'ok'
         WHERE id = \${id}\``
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })

  it('INSERT INTO … (col)', () => {
    const codigo = `INSERT INTO oposiciones (slug, nombre, seguimiento_url) VALUES ($1,$2,$3)`
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })

  it('Drizzle .set({ camelCase: … })', () => {
    const codigo = `await db.update(oposiciones).set({ seguimientoUrl: url, updatedAt: sql\`NOW()\` })`
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })

  it('Drizzle .values({ camelCase: … })', () => {
    const codigo = `await db.insert(oposiciones).values({ slug, seguimientoUrl: url })`
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })
})

describe('escribeRecurso — NO detecta lo que solo lee o define (precisión)', () => {
  it('un SELECT no es una escritura', () => {
    const codigo = "const r = await sql`SELECT slug, seguimiento_url FROM oposiciones WHERE is_active`"
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('un select de Drizzle tampoco', () => {
    const codigo = `db.select({ seguimientoUrl: oposiciones.seguimientoUrl }).from(oposiciones)`
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('una definición de esquema DEFINE la columna, no la escribe', () => {
    const codigo = `
      export const oposiciones = pgTable("oposiciones", {
        id: uuid().primaryKey(),
        seguimientoUrl: text("seguimiento_url"),
      })`
    expect(esDefinicionDeEsquema(codigo)).toBe(true)
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('un tipo o interfaz que la menciona no es una escritura', () => {
    const codigo = `export interface OposicionToScan { seguimientoUrl: string; fetcherType: string }`
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('un comentario que la nombra no cuenta', () => {
    const codigo = `// ojo: seguimiento_url la consumen varios sensores del radar\nconst x = 1`
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('un UPDATE a OTRA columna no dispara', () => {
    const codigo = "await sql`UPDATE oposiciones SET is_active = true WHERE slug = ${slug}`"
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })
})

describe('escribeRecurso — los topes evitan el falso positivo por distancia', () => {
  it('un UPDATE lejanísimo de la mención NO cuenta como escritura', () => {
    // Sin acotar los cuantificadores, un UPDATE al principio del fichero casaría con una columna
    // nombrada cientos de líneas después. El relleno supera el tope de 400 chars entre SET y la
    // columna a propósito.
    const codigo =
      "await sql`UPDATE otra_tabla SET campo = 1`\n" +
      '// '.padEnd(900, 'x') +
      '\nconst nota = "seguimiento_url = algo"'
    expect(escribeRecurso(codigo, seguimiento)).toBe(false)
  })

  it('pero el UPDATE real con varias columnas por medio SÍ cuenta', () => {
    const codigo = `sql\`UPDATE oposiciones SET a = 1, b = 2, c = 3, seguimiento_url = \${u}\``
    expect(escribeRecurso(codigo, seguimiento)).toBe(true)
  })
})

describe('recursosEscritos — resumen por fichero', () => {
  it('devuelve todos los recursos que toca un mismo fichero', () => {
    const codigo = `
      await sql\`UPDATE oposiciones SET seguimiento_url = \${u} WHERE id = \${id}\`
      await sql\`UPDATE questions SET lifecycle_state = 'approved' WHERE id = \${q}\``
    const r = recursosEscritos(codigo)
    expect(r).toContain('seguimiento_url')
    expect(r).toContain('lifecycle_state')
  })

  it('devuelve vacío para un fichero que no escribe nada sensible', () => {
    expect(recursosEscritos('export const suma = (a: number, b: number) => a + b')).toEqual([])
  })

  it('no revienta con entrada vacía', () => {
    expect(recursosEscritos('')).toEqual([])
    expect(escribeRecurso('', lifecycle)).toBe(false)
  })
})

describe('RECURSOS_SENSIBLES — coherencia de la configuración', () => {
  it('cada recurso declara la regla que le toca, y con lo que esa regla necesita', () => {
    for (const r of RECURSOS_SENSIBLES) {
      if (r.regla === 'guardarrail_compartido') {
        expect(r.moduloGuardarrail).toBeTruthy()
      } else {
        // trinquete: sin techo no hay nada que vigilar, y sin apuntar a su protección real
        // el registro se convierte en el silo que viene a evitar.
        expect(typeof r.techo).toBe('number')
        expect(r.guardarrailPropio).toBeTruthy()
      }
    }
  })

  it('no hay columnas repetidas (dos entradas del mismo recurso = reglas en conflicto)', () => {
    const cols = RECURSOS_SENSIBLES.map((r) => r.columna)
    expect(new Set(cols).size).toBe(cols.length)
  })

  it('la lista se mantiene CORTA a propósito (si crece mucho, es un inventario)', () => {
    expect(RECURSOS_SENSIBLES.length).toBeLessThanOrEqual(10)
  })
})
