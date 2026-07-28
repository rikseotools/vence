/**
 * sim-concepto-cierra-circulo.mts — cuando el usuario pregunta un CONCEPTO desde dentro de una
 * pregunta, ¿la respuesta vuelve a su pregunta o le suelta una ficha de diccionario?
 * (ciclo 6 de la revisión de negativos, 28/07/2026)
 *
 * Uso:  npx tsx scripts/sim/sim-concepto-cierra-circulo.mts [n] [--sin-regla]
 *
 * Reproduce la FORMA exacta del caso, que es lo que hace útil el control (lección del ciclo 4):
 * 4 mensajes —sistema, contexto de la pregunta, la explicación que YA se le dio, y su duda—,
 * con el modelo de PRODUCCIÓN. `--sin-regla` quita la instrucción nueva: si el verde sale igual
 * con y sin ella, la simulación no mide nada.
 *
 * Criterio: la respuesta debe **volver a la pregunta del usuario** (citar su artículo o su
 * clave), no quedarse en la definición.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30, onnotice: () => {} })

const N = Number(process.argv.find(a => /^\d+$/.test(a)) ?? 4)
const SIN_REGLA = process.argv.includes('--sin-regla')

const src = fs.readFileSync('lib/chat/domains/verification/VerificationService.ts', 'utf8')
const regla = src.match(/## 🎯 SI PREGUNTA UN CONCEPTO[\s\S]*?le deja igual que estaba\./)?.[0]
if (!regla) { console.error('❌ la instrucción no está en el prompt'); process.exit(1) }

// Casos reales: preguntas con su artículo, sobre las que simular una duda de concepto.
const casos = await sql<any[]>`
  SELECT q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
         l.short_name ley, a.article_number art, left(a.content, 900) texto
  FROM questions q
  JOIN articles a ON a.id = q.primary_article_id
  JOIN laws l ON l.id = a.law_id
  WHERE q.is_active AND l.short_name = 'Ley 39/2015' AND a.content IS NOT NULL
    AND length(q.question_text) BETWEEN 60 AND 200
  ORDER BY q.id LIMIT ${N}`

const [cfg] = await sql<{ k: string }[]>`SELECT api_key_encrypted k FROM ai_api_config WHERE provider='openai' AND is_active LIMIT 1`
const OpenAI = (await import('openai')).default
const openai = new OpenAI({ apiKey: Buffer.from(cfg.k, 'base64').toString('utf-8') })
const L = ['A', 'B', 'C', 'D']

console.log(`casos: ${casos.length} · modelo gpt-4o${SIN_REGLA ? '  (CONTROL: sin la instrucción)' : ''}\n`)
let cierran = 0
for (const [i, c] of casos.entries()) {
  const clave = L[c.correct_option]
  // El concepto que se pregunta: el término más largo del enunciado (aproximación suficiente).
  const termino = (c.question_text.match(/\b[a-záéíóúñ]{9,}\b/gi) ?? ['procedimiento'])[0]

  const sys = `Eres un tutor de oposiciones de derecho administrativo.${SIN_REGLA ? '' : '\n\n' + regla}`
  const msgs: any[] = [
    { role: 'system', content: sys },
    { role: 'user', content: `El usuario está viendo esta pregunta en un test:\nPregunta: ${c.question_text}\nA) ${c.option_a}\nB) ${c.option_b}\nC) ${c.option_c}\nD) ${c.option_d}\nLa correcta es la ${clave}.\nArtículo ${c.art} de ${c.ley}: ${c.texto}` },
    { role: 'assistant', content: `✅ La respuesta correcta es la ${clave}. Según el artículo ${c.art} de la ${c.ley}…` },
    { role: 'user', content: `¿Qué es ${termino}?` },
  ]
  const r = await openai.chat.completions.create({ model: 'gpt-4o', max_tokens: 600, temperature: 0.3, messages: msgs })
  const out = r.choices[0]?.message?.content ?? ''

  // ¿Cierra el círculo? Vuelve a su pregunta si menciona su artículo o su clave.
  const vuelve = new RegExp(`(art[íi]culo\\s*${c.art}\\b|en tu pregunta|la respuesta correcta es (la )?${clave}\\b|opci[oó]n ${clave}\\b)`, 'i').test(out)
  vuelve ? cierran++ : null
  console.log(`[${i + 1}] "${termino}" · ${vuelve ? '✅ vuelve a su pregunta' : '❌ se queda en la definición'}`)
  if (!vuelve) console.log('     ' + out.replace(/\s+/g, ' ').slice(0, 160))
}
console.log(`\nresultado: ${cierran}/${casos.length} cierran el círculo`)
await sql.end({ timeout: 5 })
