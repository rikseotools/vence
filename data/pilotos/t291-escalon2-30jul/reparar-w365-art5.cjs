// T-351 — `Word 365 Escritorio` art.5 estaba construido sobre una PREMISA FALSA, no sobre filas
// sueltas: afirmaba que en Word 365 los atajos siguen mnemónicos ingleses, que los españoles «ya no
// son válidos», y remataba instruyendo al opositor a «verificar siempre contra Microsoft Support
// es-ES» — justo la página traducida que da las teclas inglesas. La trampa elevada a doctrina.
//
// Su gemelo `Word 365` art.5 es EL MISMO DOCUMENTO ya corregido (misma estructura, sección de teclas
// de función idéntica) y trae la tabla de contraste ES/EN. Así que la reparación es traer el gemelo,
// no parchear veinte filas: menos superficie de error y ninguna posibilidad de dejar medio artículo
// en cada convención.
//
// Se conserva lo ÚNICO exclusivo del de Escritorio que sostenía una pregunta viva: la fila de
// `Ctrl+Alt+I` (vista preliminar), que además está verificada.
//
// Y de paso se arregla la sección 14 en LOS DOS: daba las vistas con el set inglés
// (Alt+Ctrl+P/O), lo que contradecía de frente el arreglo del 30/07 en el art. 6 del mismo
// contenedor (Alt+Ctrl+O = nota al pie). Verificado en español: D=Diseño de impresión, E=Esquema,
// I=vista preliminar. Se retira la fila «Alt+Ctrl+L = Vista Lectura» porque no está verificada y
// choca con Alt+Ctrl+L = nota al final, que sí lo está.
const path = require('path')
const ROOT = path.resolve(__dirname, '../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 })

const ID_ESC = '9bd4c2db-d75c-4816-ad5c-97539731e650'

const VISTAS_VIEJA = `| Ctrl+P | Imprimir el documento |
| Ctrl+F2 | Mostrar u ocultar la vista previa de impresión |
| Alt+Ctrl+P | Vista Diseño de impresión |
| Alt+Ctrl+N | Vista Borrador |
| Alt+Ctrl+O | Vista Esquema |
| Alt+Ctrl+L | Vista Lectura (pantalla completa) |`

const VISTAS_NUEVA = `| Ctrl+P | Imprimir el documento |
| Ctrl+F2 | Mostrar u ocultar la vista previa de impresión |
| Alt+Ctrl+I | Activar o desactivar la vista preliminar |
| Alt+Ctrl+D | Vista **D**iseño de impresión |
| Alt+Ctrl+E | Vista **E**squema |
| Alt+Ctrl+N | Vista Borrador |

> 📌 **Las vistas también se localizan**, y es la clave de todo el bloque de notas: en español son **Alt+Ctrl+D** (**D**iseño de impresión) y **Alt+Ctrl+E** (**E**squema), frente a Ctrl+Alt+P (*Print layout*) y Ctrl+Alt+O (*Outline*) del inglés. Precisamente por eso quedan libres la **O** para la nota al pie (**Alt+Ctrl+O**) y la **L** para la nota al final (**Alt+Ctrl+L**).`

;(async () => {
  console.log(APPLY ? '⚠️  APPLY\n' : '🔎 DRY-RUN\n')
  const [comun] = await sql`SELECT a.id, a.content FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE l.short_name = 'Word 365' AND a.article_number = '5'`
  const [esc] = await sql`SELECT id, content FROM articles WHERE id = ${ID_ESC}::uuid`

  // 1. La sección de vistas, en el gemelo bueno.
  const nVistas = comun.content.split(VISTAS_VIEJA).length - 1
  console.log(`  Word 365 art.5 · bloque de vistas con el set inglés: ${nVistas} ocurrencia(s)`)
  if (nVistas !== 1) { console.error('❌ abortado'); await sql.end(); process.exit(1) }
  const comunNuevo = comun.content.replace(VISTAS_VIEJA, VISTAS_NUEVA)

  // 2. El de Escritorio pasa a ser el gemelo YA corregido.
  const escNuevo = comunNuevo
  console.log(`  Word 365 Escritorio art.5 · ${esc.content.length} → ${escNuevo.length} chars`)
  const doctrina = ['Atajos polisémicos', 'ya no son válidos', 'verifica siempre el atajo contra Microsoft Support']
  for (const d of doctrina)
    console.log(`     «${d.slice(0, 46)}…» presente antes: ${esc.content.includes(d)} · después: ${escNuevo.includes(d)}`)
  console.log(`     conserva Ctrl+Alt+I (sostiene a1bc1366, 28 exp): ${escNuevo.includes('Alt+Ctrl+I')}`)

  if (!APPLY) { console.log('\n✅ todo cuadra.'); await sql.end(); return }
  await sql.begin(async (tx) => {
    await tx`UPDATE articles SET content = ${comunNuevo}, updated_at = now() WHERE id = ${comun.id}`
    await tx`UPDATE articles SET content = ${escNuevo}, updated_at = now() WHERE id = ${esc.id}`
  })
  console.log('\n✅ los dos art.5 escritos.')
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
