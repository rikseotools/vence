/**
 * @jest-environment node
 *
 * [T-626] Un `INSERT` en `observable_events` que nombra una columna inexistente no da error a
 * nadie: la telemetría va envuelta en `catch {}` por diseño, así que falla en silencio y el
 * evento simplemente NO EXISTE.
 *
 * Medido el 06/08/2026: el bucle supervisor de la flota escribía en `event_data` (la columna se
 * llama `metadata`) y llevaba desde que se escribió con **0 eventos registrados**, mientras su
 * propio comentario decía «un bucle que no deja huella es indistinguible de uno muerto». Los
 * otros CUATRO inserts del mismo fichero usaban la forma correcta: fue un outlier, no un cambio
 * de esquema.
 *
 * Es el mismo modo de fallo que [T-615]: el fail-open, que está bien puesto, acabó ocultando que
 * lo que fallaba era la propia observación. Un `catch {}` obliga a comprobar ANTES, porque después
 * ya no hay quien avise.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const DIRS = ['scripts', 'lib', 'app', 'backend/src']

/**
 * Columnas reales de `observable_events`, tomadas de `db/schema.ts` (la fuente de verdad del
 * proyecto). Si el esquema cambia, este guardarraíl lo sigue solo.
 */
function columnasReales(): Set<string> {
  const schema = readFileSync(join(RAIZ, 'db', 'schema.ts'), 'utf8')
  const i = schema.indexOf('pgTable("observable_events"')
  expect(i).toBeGreaterThan(-1)
  const bloque = schema.slice(i, schema.indexOf('}, (table)', i))
  const cols = new Set<string>()
  // `nombreTs: tipo("nombre_sql")` y `nombreTs: tipo()` (mismo nombre en ambos)
  for (const m of bloque.matchAll(/(\w+)\s*:\s*\w+\((?:"([^"]+)")?/g)) {
    cols.add(m[2] || m[1].replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`))
  }
  return cols
}

function ficheros(dir: string, out: string[] = []): string[] {
  let entradas: string[]
  try { entradas = readdirSync(join(RAIZ, dir)) } catch { return out }
  for (const e of entradas) {
    if (e === 'node_modules' || e === '.next' || e === 'dist' || e.startsWith('.')) continue
    const rel = `${dir}/${e}`
    let st
    try { st = statSync(join(RAIZ, rel)) } catch { continue }
    if (st.isDirectory()) ficheros(rel, out)
    else if (/\.(ts|js|cjs|mjs)$/.test(e)) out.push(rel)
  }
  return out
}

/** Extrae la lista de columnas de cada `INSERT INTO … observable_events ( … )` del texto. */
function columnasInsertadas(txt: string): string[][] {
  const out: string[][] = []
  for (const m of txt.matchAll(/INSERT\s+INTO\s+(?:public\.)?observable_events\s*\(([^)]*)\)/gi)) {
    out.push(m[1].split(',').map((c) => c.trim()).filter(Boolean))
  }
  return out
}

describe('[T-626] guardarraíl — ningún INSERT en observable_events nombra una columna que no existe', () => {
  const COLS = columnasReales()
  const todos = DIRS.flatMap((d) => ficheros(d))

  it('lee el esquema y encuentra las columnas conocidas', () => {
    for (const c of ['metadata', 'event_type', 'severity', 'source', 'endpoint', 'error_message']) {
      expect([...COLS]).toContain(c)
    }
    expect(COLS.has('event_data')).toBe(false)   // la que causó la ficha
  })

  it('encuentra inserts que auditar (si esto falla, el guardarraíl se quedó ciego)', () => {
    const conInsert = todos.filter((f) => {
      try { return /INSERT\s+INTO\s+(?:public\.)?observable_events/i.test(readFileSync(join(RAIZ, f), 'utf8')) } catch { return false }
    })
    expect(conInsert.length).toBeGreaterThan(3)
  })

  it('ninguno escribe en una columna inexistente', () => {
    const malos: string[] = []
    for (const f of todos) {
      let txt = ''
      try { txt = readFileSync(join(RAIZ, f), 'utf8') } catch { continue }
      for (const cols of columnasInsertadas(txt)) {
        for (const c of cols) {
          if (!COLS.has(c)) malos.push(`${f}: «${c}»`)
        }
      }
    }
    // El detalle va DENTRO del valor comparado: el fallo dice QUÉ fichero y QUÉ columna.
    expect({ columnasQueNoExisten: malos }).toEqual({ columnasQueNoExisten: [] })
  })

  it('el parser reconoce la forma real y CAZA el caso que motivó la ficha', () => {
    // Contraste explícito: sin esto, un parser roto daría siempre 0 y parecería verde.
    expect(columnasInsertadas(
      "sql`INSERT INTO public.observable_events (event_type, severity, event_data) VALUES (…)`",
    )).toEqual([['event_type', 'severity', 'event_data']])
    expect(columnasInsertadas(
      'INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)',
    )[0]).toContain('metadata')
  })
})
