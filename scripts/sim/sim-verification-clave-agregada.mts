/**
 * sim-verification-clave-agregada.mts — ¿el prompt corregido deja de marcar A y B como
 * «Correcta» cuando la clave es agregada? (ciclo 4 de la revisión del chat, 28/07/2026)
 *
 * Uso:  npx tsx scripts/sim/sim-verification-clave-agregada.mts [n]
 *
 * ## Por qué así
 *
 * Un cambio de PROMPT no se puede reproyectar como uno de enrutado: hay que volver a llamar al
 * modelo. Para no gastar de más, **no se reproduce el comportamiento viejo** —ya está en la BD,
 * en 17 respuestas reales que marcan A y B como «Correcta» a la vez— y solo se ejecuta el
 * NUEVO sobre una muestra pequeña de preguntas con clave agregada.
 *
 * Criterio de éxito: acierta la clave (no se puede romper lo que ya funciona) y NO marca como
 * «Correcta» ninguna opción que no sea la clave.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
// La clave NO está en .env.local: la app la guarda en `ai_api_config.api_key_encrypted`
// (base64), que es de donde la leen lib/chat/shared/openai.ts y anthropic.ts. Se usa la misma
// fuente para no tener dos verdades sobre qué credencial se usa.
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30, onnotice: () => {} })

const N = Number(process.argv[2] || 6)
// `--sin-regla` ejecuta la misma muestra SIN la instrucción nueva. Es el control: si el verde
// sale igual con y sin ella, la simulación no está midiendo nada (mismo criterio que una
// prueba de mutación).
const SIN_REGLA = process.argv.includes('--sin-regla')
// El modelo IMPORTA: la respuesta mala original la produjo gpt-4o. Simular con gpt-4o-mini dio
// verde con y sin la instrucción, o sea que no medía nada. Se usa por defecto el de producción.
const MODELO = process.argv.find(a => a.startsWith('--modelo='))?.split('=')[1] ?? 'gpt-4o'
const L = ['A', 'B', 'C', 'D']

// El trozo del prompt que se ha cambiado, leído del FICHERO REAL: si alguien lo edita y
// rompe la instrucción, esta simulación lo refleja sin tocar nada aquí.
const src = fs.readFileSync('lib/chat/domains/verification/VerificationService.ts', 'utf8')
const regla = src.match(/⚠️ \*\*Si la correcta es una opción AGREGADA[\s\S]*?clave agregada\.\)/)?.[0]
if (!regla) { console.error('❌ no encuentro la instrucción en el prompt — ¿se ha borrado?'); process.exit(1) }

const preguntas = await sql<any[]>`
  SELECT q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
         l.short_name ley, a.article_number art, left(a.content, 1200) texto
  FROM questions q
  JOIN articles a ON a.id = q.primary_article_id
  JOIN laws l ON l.id = a.law_id
  WHERE q.is_active AND q.correct_option IN (2,3)
    -- La FORMA importa: el fallo se dio con «A) y B) son correctas» (dos opciones concretas
    -- que son ciertas por separado), no con «todas las anteriores». Con la segunda forma el
    -- modelo no se equivoca, así que una muestra de «todas» no reproduce nada.
    AND (q.option_c ~* '^\\s*a\\)?\\s*(y|e)\\s*b\\)?\\s*son' OR q.option_d ~* '^\\s*a\\)?\\s*(y|e)\\s*b\\)?\\s*son'
         OR q.option_c ~* 'las (respuestas|opciones) a (y|e) b' OR q.option_d ~* 'las (respuestas|opciones) a (y|e) b')
    AND a.content IS NOT NULL
  ORDER BY q.id LIMIT ${N}`

console.log(`preguntas de clave AGREGADA en la muestra: ${preguntas.length} · modelo ${MODELO}${SIN_REGLA ? '  (CONTROL: sin la instrucción nueva)' : ''}\n`)

const [cfg] = await sql<{ k: string }[]>`
  SELECT api_key_encrypted k FROM ai_api_config WHERE provider='openai' AND is_active LIMIT 1`
if (!cfg) { console.error('❌ no hay credencial de openai activa en ai_api_config'); process.exit(1) }
const OpenAI = (await import('openai')).default
const openai = new OpenAI({ apiKey: Buffer.from(cfg.k, 'base64').toString('utf-8') })

let ok = 0, fallos = 0
for (const [i, q] of preguntas.entries()) {
  const clave = L[q.correct_option]
  const sys = `Eres un profesor de oposiciones que explica por qué una respuesta es correcta.\n\n## 📋 ESTRUCTURA DE TU RESPUESTA\n1. **Respuesta correcta**\n2. **Fundamento legal** — cita el artículo\n3. **Explicación didáctica**\n4. **Por qué las otras opciones son incorrectas** (brevemente, opcional)${SIN_REGLA ? '' : '\n\n' + regla}\n\nLa respuesta correcta marcada en la base de datos es la ${clave} y está verificada: tu papel es EXPLICARLA, no cuestionarla.`
  const user = `Pregunta: "${q.question_text}"\nA) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}\n\nArtículo ${q.art} de ${q.ley}:\n${q.texto}\n\nExplícame por qué la respuesta correcta es "${clave}".`

  const r = await openai.chat.completions.create({
    model: MODELO, max_tokens: 700, temperature: 0.3,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
  })
  const out = r.choices[0]?.message?.content ?? ''

  // ¿Marca como "Correcta" alguna opción que NO es la clave? Ese era el fallo.
  const malas = L.filter((x) => x !== clave)
    .filter((x) => new RegExp(`Opci[oó]n\\s+\\*{0,2}${x}\\*{0,2}\\s*\\*{0,2}:?\\*{0,2}\\s*\\*{0,2}(Correcta|Cierta|Verdadera)`, 'i').test(out))
  // Ojo con este regex: la primera versión no reconocía «La respuesta correcta es "C) A) y B)
  // son correctas."» (con comillas y paréntesis) y marcaba como fallo respuestas perfectas.
  // Un detector con falsos positivos hace que te fíes de un verde que no lo es.
  const aciertaClave = new RegExp(
    `(respuesta correcta(?: es)?\\s*:?\\s*["“]?\\*{0,2}${clave}\\b|opci[oó]n\\s+\\*{0,2}${clave}\\b)`, 'i').test(out)

  const bien = malas.length === 0 && aciertaClave
  bien ? ok++ : fallos++
  console.log(`[${i + 1}] clave ${clave} · ${bien ? '✅' : '❌'} ${malas.length ? 'marca como correctas: ' + malas.join(',') : ''}${aciertaClave ? '' : ' · NO afirma la clave'}`)
  if (!bien) console.log('     ' + out.replace(/\s+/g, ' ').slice(0, 200))
}

console.log(`\nresultado: ${ok}/${preguntas.length} correctas · ${fallos} con el fallo`)
await sql.end({ timeout: 5 })
process.exit(fallos === 0 ? 0 : 1)
