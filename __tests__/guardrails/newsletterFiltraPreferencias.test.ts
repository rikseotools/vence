/**
 * @jest-environment node
 */
// Guardarraíl: TODA vía de envío de newsletter filtra preferencias. (T-457, 01/08/2026)
//
// ── QUÉ PASABA ───────────────────────────────────────────────────────────────────────────────
// El envío por **audiencia** excluía `unsubscribed_all` y `email_newsletter_disabled`. El envío
// por **selección manual** (`selectedUserIds`) construía su propia consulta en la ruta —
// `inArray(id, selectedUserIds) AND email IS NOT NULL`— y no miraba ninguna preferencia. Dos
// puertas al mismo recurso con criterios distintos no protegen ([T-130]): la buena no sirve de
// nada mientras exista la otra.
//
// ── POR QUÉ ES DE FICHERO ────────────────────────────────────────────────────────────────────
// Lo que hay que impedir no es un cálculo (eso lo fija `__tests__/emails/newsletterDestinatarios`)
// sino una OMISIÓN: que la ruta vuelva a armarse su propia lista de destinatarios. Montar el
// handler entero exigiría Next + Drizzle + Resend; lo que protege de verdad es que la consulta no
// pueda renacer ahí.
import fs from 'fs'
import path from 'path'

const RAIZ = path.join(__dirname, '..', '..')
const leer = (p: string) => fs.readFileSync(path.join(RAIZ, p), 'utf8')

const SEND = 'app/api/admin/newsletters/send/route.ts'
const QUERIES = 'lib/api/newsletters/queries.ts'

describe('la ruta de envío no se arma sus propios destinatarios', () => {
  const src = leer(SEND)

  it('NO consulta `user_profiles` por su cuenta', () => {
    // Ésta era la consulta del agujero. Si vuelve a aparecer aquí, es que alguien ha
    // reabierto la segunda puerta.
    expect(src).not.toMatch(/\.from\(\s*userProfiles\s*\)/)
    expect(src).not.toMatch(/(?<![\w$])userProfiles\.id(?![\w$])/)
  })

  it('la vía de SELECCIÓN MANUAL pasa por `getNewsletterRecipientsByIds`', () => {
    // `\b` con lookbehind: sin él, `XXgetNewsletterRecipientsByIds(` pasaría el test y el
    // guardarraíl sería teatro (mismo fallo de coincidencia laxa que costó T-454).
    expect(src).toMatch(/(?<![\w$])getNewsletterRecipientsByIds\s*\(/)
  })

  it('la vía de AUDIENCIA sigue pasando por `getNewsletterAudience`', () => {
    expect(src).toMatch(/(?<![\w$])getNewsletterAudience\s*\(/)
  })

  it('CANTA cuántos se cayeron por preferencias en vez de encogerse en silencio', () => {
    // Un envío de 500 que sale a 488 tiene que verse: si no, el hueco se vuelve a usar
    // sin que nadie lo note, que es exactamente cómo llegó hasta aquí.
    expect(src).toMatch(/(?<![\w$])skippedBlocked(?![\w$])/)
  })
})

describe('el criterio de bloqueo vive en un solo sitio', () => {
  const src = leer(QUERIES)

  it('`email_newsletter_disabled` se lee UNA sola vez: dentro de getBlockedNewsletterUserIds', () => {
    // Trinquete. Estaba copiado en `getNewsletterAudience` y en `getAudienceStats`, y la tercera
    // vía no lo tenía. Copiarlo otra vez es cómo se vuelven a separar los criterios.
    // Se cuenta el ACCESO A LA COLUMNA (`emailPreferences.emailNewsletterDisabled`), no el
    // identificador suelto: el select la nombra dos veces en la misma línea (clave y columna).
    const ACCESO = /(?<![\w$])emailPreferences\.emailNewsletterDisabled(?![\w$])/g
    expect((src.match(ACCESO) || []).length).toBe(2) // el select + el eq() del where

    // Y las dos, dentro de esa función: si aparecen fuera, el criterio se ha vuelto a copiar.
    const fn = src.slice(src.indexOf('export async function getBlockedNewsletterUserIds'))
    const finFn = fn.indexOf('\nexport ', 1)
    const cuerpo = finFn > 0 ? fn.slice(0, finFn) : fn
    expect((cuerpo.match(ACCESO) || []).length).toBe(2)
  })

  it('la decisión de quién está bloqueado la toma el núcleo puro, no la consulta', () => {
    expect(src).toMatch(/(?<![\w$])blockedUserIds\s*\(/)
    expect(src).toMatch(/(?<![\w$])filterEligibleRecipients\s*\(/)
  })
})
