/**
 * sidSinTruncarAMano.guardrail.test.ts — nadie vuelve a abreviar un sid por su cuenta. (T-538)
 *
 * `sid.cjs` es la fuente única de identidad desde [T-407], que nació de encontrar SEIS copias del
 * resolvedor con DOS reglas distintas. Este guardarraíl cierra la otra mitad del mismo problema:
 * la identidad no solo se resuelve en un sitio, también se **escribe** en un sitio.
 *
 * Porque abreviar mal no es cosmético. Once sitios recortaban el sid por longitud (8 ó 12
 * caracteres) cuando su forma canónica pone lo distintivo al PRINCIPIO: con cinco sesiones
 * abiertas el mismo día, las cinco se escribían `imp-04ag`, y la cola marcaba con candado seis
 * reservas ajenas junto a un nombre que quien miraba leía como suyo.
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const ROOT = path.join(__dirname, '..', '..')
const { sidCorto } = req(path.join(ROOT, 'lib/sessions/sid.cjs'))

/** Los módulos que enseñan un sid a una persona. Si nace otro, se añade aquí. */
const MODULOS = [
  'lib/impugnaciones/reserva.cjs',
  'lib/backlog/claim.ts',
  'lib/backlog/claimGate.cjs',
  'lib/backlog/pushGuard.cjs',
  'scripts/impugnaciones/cola.cjs',
  'scripts/impugnaciones/revisar-impugnacion.cjs',
  'scripts/impugnaciones/revisar-feedback.cjs',
]

const leer = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
/** Sin comentarios: lo que importa es el código, no la prosa que lo explica. */
const soloCodigo = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\*.*$/gm, ' ')

/**
 * Recortes a mano de algo que es un SID.
 *
 * Se mira la ventana INMEDIATAMENTE anterior al `.slice(0,N)`, no «sid en algún punto de la
 * línea»: la primera versión de esta regla daba falsos positivos en
 * `` `…${sidCorto(sid)} (usuario ${String(row.user_id).slice(0, 8)})` `` — ahí el recorte es del id
 * del USUARIO, que no es un sid y se puede abreviar sin riesgo. Un guardarraíl que marca lo
 * correcto se aprende a ignorar, y entonces deja de proteger.
 */
export function recortesDeSidAMano(codigo: string): string[] {
  const fuera: string[] = []
  const re = /\.slice\(\s*0\s*,\s*\d+\s*\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(codigo))) {
    const ventana = codigo.slice(Math.max(0, m.index - 30), m.index)
    const esSid = /claimed_?by|\bsid\b/i.test(ventana)
    const esOtroId = /user_id|question_id|dispute_id|feedback_id|\brow\.id\b/i.test(ventana)
    if (esSid && !esOtroId) fuera.push((ventana + m[0]).trim())
  }
  return fuera
}

describe('ningún módulo abrevia un sid por su cuenta', () => {
  it.each(MODULOS)('%s usa sidCorto y no un slice a pelo', (rel) => {
    const codigo = soloCodigo(leer(rel))

    expect(recortesDeSidAMano(codigo)).toEqual([])
    expect(codigo).toContain('sidCorto')
  })

  describe('el detector distingue un sid de otros ids (o se aprendería a ignorar)', () => {
    it('caza el recorte de un sid', () => {
      expect(recortesDeSidAMano('console.log(`${sid.slice(0, 12)}`)')).toHaveLength(1)
      expect(recortesDeSidAMano("String(t.claimed_by).slice(0, 12)")).toHaveLength(1)
    })

    it('NO caza el recorte del id de un usuario, que no es un sid', () => {
      expect(recortesDeSidAMano('`${sidCorto(sid)} (usuario ${String(row.user_id).slice(0, 8)})`')).toEqual([])
      expect(recortesDeSidAMano('r.question_id.slice(0, 8)')).toEqual([])
    })
  })

  it('todos importan la MISMA función (no una copia local)', () => {
    // Dos formas legítimas de escribir la misma ruta: relativa (`../sessions/sid.cjs`) en lib, y
    // `path.join(…, 'sessions', 'sid.cjs')` en los scripts, que corren desde cualquier cwd.
    const RUTA_AL_MODULO = /sessions[/'"\s,]+sid\.cjs/
    for (const rel of MODULOS) {
      expect(soloCodigo(leer(rel))).toMatch(RUTA_AL_MODULO)
    }
  })

  it('nadie se reimplementa sidCorto', () => {
    for (const rel of MODULOS) {
      expect(soloCodigo(leer(rel))).not.toMatch(/function\s+sidCorto/)
    }
  })
})

describe('la abreviatura no puede volver a colisionar', () => {
  it('cualquier par de sesiones del tooling se distingue tras abreviar', () => {
    // Nombres reales de worktrees creados con `crear-worktree.sh`, incluidos los cinco del 04/08
    // que provocaron el fallo. Si alguien vuelve a truncar por longitud, esto se cae.
    const sids = [
      'imp-04ago-b-fedora-45b0da',
      'imp-04ago-c-fedora-eca3f1',
      'imp-04ago-d-fedora-75459b',
      'imp-04ago-e-fedora-b6a253',
      'imp-04ago-g-fedora-73618e',
      'imp-01ago-f-fedora-11aa22',
      'preguntas-02ago-fedora-33bb44',
      't486-flota-fedora-aead7f',
    ]
    expect(new Set(sids.map(sidCorto)).size).toBe(sids.length)
  })

  it('la abreviatura conserva lo que un humano usa para reconocer su worktree', () => {
    // El nombre abreviado tiene que seguir siendo el del directorio: es lo que la persona ve en su
    // terminal y con lo que compara.
    expect(sidCorto('imp-04ago-c-fedora-eca3f1')).toBe('imp-04ago-c')
  })
})
