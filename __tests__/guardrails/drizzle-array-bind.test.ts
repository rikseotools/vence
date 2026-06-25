import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GUARDRAIL — bind de arrays en Drizzle (anti-regresión del 500 del 25/06)
// ============================================================================
// Drizzle interpola un array JS dentro de `sql``` como params SUELTOS (spread),
// NO como un array Postgres. Por eso `sql`... = ANY(${arr}::uuid[])`` genera
// `($1)::uuid[]` / `($1,$2)::uuid[]` → casteo/sintaxis inválida → 500 en runtime
// (invisible a tests que mockean execute y a sql.unsafe).
//
// REGLA: prohibido `${identificador}::tipo[]` dentro de sql``. Usar los helpers
// `pgUuidArray` / `pgTextArray` / `pgIntArray` de lib/api/sqlArrays.ts (generan
// `ARRAY[$1::uuid, ...]::uuid[]`, válido y seguro con array vacío).

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib', 'components', 'contexts', 'hooks']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\./

// El patrón roto: ${ident}::tipo[]  (ident = identificador o acceso a miembro).
const BAD = /\$\{\s*[a-zA-Z_][a-zA-Z0-9_.]*\s*\}::(uuid|text|int|int4|int8|bigint|numeric|float8|bool|boolean|date|timestamptz|jsonb)\[\]/g

// El propio helper contiene `]::uuid[]` (literal de salida), no el patrón ${ident}::tipo[].
// Aun así lo excluimos explícitamente por claridad.
const ALLOWLIST = new Set<string>([
  'lib/api/sqlArrays.ts',
])

function walk(rel: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(join(ROOT, rel)) } catch { return [] }
  for (const e of entries) {
    const childRel = `${rel}/${e}`
    if (SKIP.test(childRel)) continue
    const st = statSync(join(ROOT, childRel))
    if (st.isDirectory()) out = out.concat(walk(childRel))
    else if (EXT.test(e)) out.push(childRel)
  }
  return out
}

// Quita comentarios (línea y bloque) para no cazar el patrón citado en un comentario
// explicativo (mismo gotcha que el ratchet .from): la regla es sobre CÓDIGO real.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('Guardrail — arrays JS en Drizzle van por pgUuidArray/pgTextArray (no ${arr}::tipo[])', () => {
  const violations: string[] = []
  for (const file of SCAN_DIRS.flatMap(walk)) {
    if (ALLOWLIST.has(file)) continue
    const src = stripComments(readFileSync(join(ROOT, file), 'utf8'))
    if (!src.includes('sql`') && !src.includes('::')) continue
    const matches = src.match(BAD)
    if (matches) violations.push(`${file}: ${[...new Set(matches)].join(', ')}`)
  }

  it('no hay `${ident}::tipo[]` en plantillas sql (usa los helpers de sqlArrays)', () => {
    if (violations.length > 0) {
      throw new Error(
        `❌ ${violations.length} fichero(s) con el bind de array ROTO (500 en runtime):\n` +
        violations.map(v => `  • ${v}`).join('\n') +
        `\n\nSustituye \`\${arr}::tipo[]\` por \`\${pgUuidArray(arr)}\` / \`\${pgTextArray(arr)}\` ` +
        `(import desde '@/lib/api/sqlArrays').`
      )
    }
  })

  // Self-test: el patrón debe detectar lo que dice detectar.
  it('meta: detecta el patrón roto y NO el correcto', () => {
    expect('WHERE id = ANY(${ids}::uuid[])'.match(BAD)).not.toBeNull()
    expect('WHERE email = ANY(${data.emails}::text[])'.match(BAD)).not.toBeNull()
    expect('WHERE id = ANY(${pgUuidArray(ids)})'.match(BAD)).toBeNull()           // helper → ok
    expect('ARRAY[${sql.join(x)}]::uuid[]'.match(BAD)).toBeNull()                  // salida del helper → ok
    expect('${v}::uuid'.match(BAD)).toBeNull()                                     // escalar (sin []) → ok
  })
})
