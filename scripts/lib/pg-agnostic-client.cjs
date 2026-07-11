// scripts/lib/pg-agnostic-client.cjs
//
// Cliente de BD AGNÓSTICO drop-in para los scripts de `scripts/`.
//
// Sustituye a `@supabase/supabase-js` en los scripts que solo hacían lectura/
// escritura de DATOS (no auth/storage/realtime). Habla el mismo dialecto de
// query-builder que el cliente de Supabase (`.from().select().eq()...` con
// respuesta `{ data, error }`), pero por debajo usa `postgres` sobre
// `DATABASE_URL` → RDS / Neon / cualquier PostgreSQL. NUNCA Supabase.
//
// Motivo: tras el cutover a RDS (04/07/2026) la BD Supabase quedó CONGELADA;
// los scripts que seguían con `createClient(SUPABASE_URL, ...)` leían un
// snapshot viejo. Este shim los migra en bloque cambiando UNA línea de import:
//
//     - const { createClient } = require('@supabase/supabase-js')
//     + const { createClient } = require('./lib/pg-agnostic-client')   // ruta relativa
//
// Subconjunto soportado (el que usan los scripts):
//   from · select(cols | '*', { count:'exact', head:true }) · insert · update ·
//   upsert(rows, { onConflict }) · delete · eq · neq · gt · gte · lt · lte ·
//   like · ilike · in · is · not(col,'is',null) · order · limit · range ·
//   single · maybeSingle
//
// NO soportado (lanza error claro → el script se arregla a mano): rpc, storage,
// auth, realtime/channel, .or(), .contains(), .filter() genérico, selects con
// relaciones anidadas (`a:otra(x)`). Son minoría; fallan RUIDOSAMENTE, nunca en
// silencio.

const postgres = require('postgres')

function makeSql() {
  const DB_URL = process.env.DATABASE_URL
  if (!DB_URL) {
    throw new Error('DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts')
  }
  return postgres(DB_URL, {
    prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10,
    ssl: 'require', onnotice: () => {},
  })
}

const unsupported = (what) => {
  throw new Error(
    `[pg-agnostic-client] "${what}" no soportado por el shim agnóstico. ` +
    `Reescribe ese script a SQL con \`postgres\` (patrón: scripts/audit-oposiciones-coherencia.cjs).`
  )
}

// Un builder por consulta. Es "thenable": al await-earlo ejecuta y resuelve a
// { data, error }, igual que supabase-js.
class QueryBuilder {
  constructor(sql, table) {
    this._sql = sql
    this._table = table
    this._action = 'select'
    this._columns = '*'
    this._values = null          // filas para insert/upsert / objeto para update
    this._onConflict = null
    this._filters = []           // { col, op, val }
    this._orders = []            // { col, ascending }
    this._limit = null
    this._range = null           // [from, to]
    this._single = false         // exige exactamente 1 fila
    this._maybeSingle = false    // 0 ó 1 fila
    this._count = null           // 'exact' → devuelve count
    this._head = false           // solo count, sin filas
    this._returning = true       // insert/update/upsert/delete devuelven filas por defecto
  }

  // ---- selección / acción ----
  select(columns = '*', opts = {}) {
    if (this._action === 'select') this._action = 'select'
    this._columns = columns || '*'
    if (opts.count) this._count = opts.count
    if (opts.head) { this._head = true }
    // Cuando select() se encadena tras insert/update/upsert/delete solo marca returning.
    return this
  }
  insert(values, opts = {}) { this._action = 'insert'; this._values = values; if (opts.count) this._count = opts.count; return this }
  update(values, opts = {}) { this._action = 'update'; this._values = values; if (opts.count) this._count = opts.count; return this }
  upsert(values, opts = {}) { this._action = 'upsert'; this._values = values; this._onConflict = opts.onConflict || null; if (opts.count) this._count = opts.count; return this }
  delete(opts = {}) { this._action = 'delete'; if (opts.count) this._count = opts.count; return this }

  // ---- filtros ----
  eq(col, val) { this._filters.push({ col, op: '=', val }); return this }
  neq(col, val) { this._filters.push({ col, op: '<>', val }); return this }
  gt(col, val) { this._filters.push({ col, op: '>', val }); return this }
  gte(col, val) { this._filters.push({ col, op: '>=', val }); return this }
  lt(col, val) { this._filters.push({ col, op: '<', val }); return this }
  lte(col, val) { this._filters.push({ col, op: '<=', val }); return this }
  like(col, val) { this._filters.push({ col, op: 'like', val }); return this }
  ilike(col, val) { this._filters.push({ col, op: 'ilike', val }); return this }
  in(col, arr) { this._filters.push({ col, op: 'in', val: arr }); return this }
  is(col, val) { this._filters.push({ col, op: 'is', val }); return this }
  not(col, op, val) { this._filters.push({ col, op: 'not', notOp: op, val }); return this }
  or() { unsupported('.or()') }
  contains() { unsupported('.contains()') }
  filter() { unsupported('.filter()') }
  overlaps() { unsupported('.overlaps()') }

  // ---- modificadores ----
  order(col, opts = {}) { this._orders.push({ col, ascending: opts.ascending !== false }); return this }
  limit(n) { this._limit = n; return this }
  range(from, to) { this._range = [from, to]; return this }
  single() { this._single = true; return this }
  maybeSingle() { this._maybeSingle = true; return this }

  // ---- construcción de fragmentos ----
  _whereFragment() {
    const sql = this._sql
    if (!this._filters.length) return null
    const frags = this._filters.map((f) => {
      const col = sql(f.col)
      switch (f.op) {
        case '=': case '<>': case '>': case '>=': case '<': case '<=':
          return sql`${col} ${sql.unsafe(f.op)} ${f.val}`
        case 'like': return sql`${col} LIKE ${f.val}`
        case 'ilike': return sql`${col} ILIKE ${f.val}`
        case 'in': return sql`${col} = ANY(${f.val})`
        case 'is':
          if (f.val === null) return sql`${col} IS NULL`
          if (f.val === true) return sql`${col} IS TRUE`
          if (f.val === false) return sql`${col} IS FALSE`
          return sql`${col} IS ${f.val}`
        case 'not':
          if (f.notOp === 'is' && f.val === null) return sql`${col} IS NOT NULL`
          if (f.notOp === 'is' && f.val === true) return sql`${col} IS NOT TRUE`
          if (f.notOp === 'is' && f.val === false) return sql`${col} IS NOT FALSE`
          if (f.notOp === 'eq') return sql`${col} <> ${f.val}`
          if (f.notOp === 'in') return sql`NOT (${col} = ANY(${f.val}))`
          return unsupported(`.not(col, '${f.notOp}', ...)`)
        default: return unsupported(`filtro ${f.op}`)
      }
    })
    return frags.reduce((acc, fr) => (acc ? sql`${acc} AND ${fr}` : fr), null)
  }

  _selectColumns() {
    const sql = this._sql
    const c = (this._columns || '*').trim()
    if (c === '*' || c === '') return sql`*`
    if (/[():]/.test(c)) unsupported('select con relaciones/funciones anidadas')
    const cols = c.split(',').map((x) => x.trim()).filter(Boolean)
    return sql(cols)
  }

  async _run() {
    const sql = this._sql
    const table = sql(this._table)
    const where = this._whereFragment()

    if (this._action === 'select') {
      if (this._head && this._count) {
        const [row] = await sql`SELECT count(*)::int AS count FROM ${table} ${where ? sql`WHERE ${where}` : sql``}`
        return { data: null, count: row.count, error: null }
      }
      let q = sql`SELECT ${this._selectColumns()} FROM ${table}`
      if (where) q = sql`${q} WHERE ${where}`
      if (this._orders.length) {
        const ords = this._orders.reduce(
          (acc, o) => { const frag = sql`${sql(o.col)} ${o.ascending ? sql.unsafe('ASC') : sql.unsafe('DESC')}`; return acc ? sql`${acc}, ${frag}` : frag },
          null,
        )
        q = sql`${q} ORDER BY ${ords}`
      }
      if (this._range) { const [from, to] = this._range; q = sql`${q} LIMIT ${to - from + 1} OFFSET ${from}` }
      else if (this._limit != null) q = sql`${q} LIMIT ${this._limit}`
      const rows = await q
      let count = null
      if (this._count) {
        const [cr] = await sql`SELECT count(*)::int AS count FROM ${table} ${where ? sql`WHERE ${where}` : sql``}`
        count = cr.count
      }
      return { data: rows, count, error: null }
    }

    if (this._action === 'insert' || this._action === 'upsert') {
      const rows = Array.isArray(this._values) ? this._values : [this._values]
      if (!rows.length) return { data: [], error: null }
      const cols = Object.keys(rows[0])
      let q = sql`INSERT INTO ${table} ${sql(rows, ...cols)}`
      if (this._action === 'upsert') {
        const conflictCols = (this._onConflict ? String(this._onConflict).split(',').map((s) => s.trim()) : ['id'])
        const updators = cols.filter((c) => !conflictCols.includes(c))
        const setFrag = updators.length
          ? updators.reduce((acc, c) => { const fr = sql`${sql(c)} = EXCLUDED.${sql(c)}`; return acc ? sql`${acc}, ${fr}` : fr }, null)
          : null
        q = setFrag
          ? sql`${q} ON CONFLICT (${sql(conflictCols)}) DO UPDATE SET ${setFrag}`
          : sql`${q} ON CONFLICT (${sql(conflictCols)}) DO NOTHING`
      }
      q = sql`${q} RETURNING *`
      const data = await q
      return { data, error: null }
    }

    if (this._action === 'update') {
      const entries = Object.entries(this._values)
      const setFrag = entries.reduce((acc, [k, v]) => { const fr = sql`${sql(k)} = ${v}`; return acc ? sql`${acc}, ${fr}` : fr }, null)
      let q = sql`UPDATE ${table} SET ${setFrag}`
      if (where) q = sql`${q} WHERE ${where}`
      q = sql`${q} RETURNING *`
      const data = await q
      return { data, error: null }
    }

    if (this._action === 'delete') {
      let q = sql`DELETE FROM ${table}`
      if (where) q = sql`${q} WHERE ${where}`
      q = sql`${q} RETURNING *`
      const data = await q
      return { data, error: null }
    }

    return unsupported(`acción ${this._action}`)
  }

  // thenable: await builder → { data, count?, error }
  then(resolve, reject) {
    this._run()
      .then((res) => {
        if (this._single) {
          if (res.data && res.data.length === 1) return resolve({ ...res, data: res.data[0] })
          return resolve({ data: null, count: res.count ?? null, error: { message: `single(): se esperaba 1 fila, hubo ${res.data ? res.data.length : 0}` } })
        }
        if (this._maybeSingle) {
          return resolve({ ...res, data: res.data && res.data.length ? res.data[0] : null })
        }
        return resolve(res)
      })
      .catch((err) => resolve({ data: null, count: null, error: { message: err.message, code: err.code } }))
    return undefined
  }
}

class AgnosticClient {
  constructor(sql) { this._sql = sql }
  from(table) { return new QueryBuilder(this._sql, table) }
  rpc() { unsupported('.rpc()') }
  get auth() { return unsupported('.auth') }
  get storage() { return unsupported('.storage') }
  channel() { unsupported('.channel()') }
  // Permite cerrar el pool explícitamente: client.end()
  async end() { try { await this._sql.end({ timeout: 5 }) } catch { /* noop */ } }
}

function createClient(/* url, key — ignorados: la conexión es DATABASE_URL */) {
  return new AgnosticClient(makeSql())
}

module.exports = { createClient }
