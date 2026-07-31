// T-351 (fase Access) — los tres artículos de `Access 365` daban `Ctrl+S` para Guardar, que es el
// atajo de la versión INGLESA (Save). En el Office instalado en español es **Ctrl+G**, y de forma
// uniforme en las tres apps: Word «guardar el documento», Excel «guardar el libro» y Access
// «guardar el objeto». Esa uniformidad es la comprobación de coherencia que lo cierra.
//
// Fuentes: temario de oposiciones (josenrique.es), que lo lista para las tres apps a la vez, más la
// convención ya fijada del proyecto para Word y Excel. Las fuentes que dan Ctrl+S —la página es-es de
// Microsoft y las webs traducidas automáticamente— son traducciones del inglés, el mismo patrón que
// costó las notas al pie.
//
// `Mayús+F12` NO se toca: es tecla de función, no se localiza, y es alias legítimo de Guardar.
// Ninguna pregunta activa de Access menciona estos atajos, así que no hay ninguna clave en juego.
const path = require('path')
const ROOT = path.resolve(__dirname, '../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 })

const NOTA_ES = `
> ⚠️ **Se examina el Access INSTALADO EN ESPAÑOL.** El atajo de **Guardar** es **Ctrl+G** (mnemónico **G**uardar), igual que en Word («guardar el documento») y en Excel («guardar el libro»): Office localiza este atajo de forma uniforme en las tres aplicaciones. **Ctrl+S** es el de la versión **inglesa** (*Save*) y es el distractor típico; aparece en la página de soporte de Microsoft es-ES porque está **traducida del inglés** y conserva las teclas originales.`

const PLAN = [
  { num: '1', reps: [
    ['| **Ctrl+S** | Guardar el objeto activo |', '| **Ctrl+G** | Guardar el objeto activo (en la versión inglesa, Ctrl+S) |'],
  ] },
  { num: '2', reps: [
    ['- **Guardar por primera vez:** Ctrl+S o botón Guardar de la barra de acceso rápido. Access solicita un nombre para la consulta.',
     '- **Guardar por primera vez:** Ctrl+G o botón Guardar de la barra de acceso rápido. Access solicita un nombre para la consulta.'],
    ['- **Ctrl+S:** guardar la consulta.', '- **Ctrl+G:** guardar la consulta.'],
  ] },
  { num: '5', reps: [
    ['| `Ctrl+S` o `Mayús+F12` | Guardar un objeto de base de datos |', '| `Ctrl+G` o `Mayús+F12` | Guardar un objeto de base de datos |'],
    ['| `Ctrl+S` | Guardar la estructura de la tabla |', '| `Ctrl+G` | Guardar la estructura de la tabla |'],
    ['| `Ctrl+S` | Guardar la consulta |', '| `Ctrl+G` | Guardar la consulta |'],
    ['| `Ctrl+S` o `Mayús+F12` | General | Guardar el objeto activo |', '| `Ctrl+G` o `Mayús+F12` | General | Guardar el objeto activo |'],
    ['| `Ctrl+S` o `Mayús+F12` | Guardar el objeto activo |', '| `Ctrl+G` o `Mayús+F12` | Guardar el objeto activo |'],
    ['> **Diferencia clave para el examen**: `Ctrl+S` / `Mayús+F12` guardan el objeto con su nombre actual; `F12` abre "Guardar como" y permite cambiar el nombre o la ubicación.',
     '> **Diferencia clave para el examen**: `Ctrl+G` / `Mayús+F12` guardan el objeto con su nombre actual; `F12` abre "Guardar como" y permite cambiar el nombre o la ubicación.' + NOTA_ES],
  ] },
]

;(async () => {
  console.log(APPLY ? '⚠️  APPLY\n' : '🔎 DRY-RUN\n')
  let abortar = false
  const nuevos = []
  for (const p of PLAN) {
    const [a] = await sql`SELECT a.id, a.content FROM articles a JOIN laws l ON l.id = a.law_id
        WHERE l.short_name = 'Access 365' AND a.article_number = ${p.num}`
    let c = a.content
    console.log(`— Access 365 art.${p.num}`)
    for (const [de, to] of p.reps) {
      const n = c.split(de).length - 1
      console.log(`   ${n === 1 ? '✅' : '❌'} ${n}× «${de.slice(0, 62)}…»`)
      if (n !== 1) { abortar = true; continue }
      c = c.replace(de, to)
    }
    const resto = c.split('\n').filter((l) => /ctrl *\+ *s\b/i.test(l) && !/ingles|inglesa|save/i.test(l))
    if (resto.length) { console.log(`   ⚠️ quedan ${resto.length} línea(s) con Ctrl+S sin contrastar`); resto.forEach((l) => console.log(`      «${l.trim().slice(0, 100)}»`)) }
    nuevos.push({ id: a.id, num: p.num, c })
  }
  if (abortar) { console.error('\n❌ abortado'); await sql.end(); process.exit(1) }
  if (!APPLY) { console.log('\n✅ todo cuadra.'); await sql.end(); return }
  await sql.begin(async (tx) => {
    for (const n of nuevos) {
      await tx`UPDATE articles SET content = ${n.c}, updated_at = now() WHERE id = ${n.id}`
      console.log(`  ✍️  Access 365 art.${n.num}`)
    }
  })
  console.log('\n✅ confirmado.')
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
