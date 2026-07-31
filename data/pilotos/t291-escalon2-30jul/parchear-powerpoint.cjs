// PowerPoint 2016 — enriquecimiento QUIRÚRGICO. A diferencia de Excel/Word 2016, estos artículos
// están bien construidos y ya traen el contraste ES/EN: lo que les falta son bloques concretos que
// las preguntas sí piden. Reescribirlos entero sería destruir contenido bueno para reponer lo mismo.
//
// Se añade solo lo que la medición de cobertura señaló como hueco real, y se corrige una
// contradicción interna que el detector de atajos no ve porque «duplicar» no está en su vocabulario:
// el art.2 daba Ctrl+D para duplicar diapositiva y el art.5 daba Ctrl+Mayús+D (que es lo correcto y
// lo que responde la pregunta de 117 exposiciones).
const path = require('path')
const ROOT = path.resolve(__dirname, '../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const APPLY = process.argv.includes('--apply')
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2, idle_timeout: 20 })

const KEYTIPS = `

## Teclas de acceso (KeyTips)

Al pulsar **Alt** aparecen sobre la cinta las letras de acceso de cada ficha. **En el Office instalado en español las letras siguen el nombre español de la ficha**, no el inglés:

| Ficha | KeyTip (interfaz en español) | KeyTip en la interfaz inglesa |
|---|---|---|
| Archivo | Alt+A | Alt+F (*File*) |
| **Inicio** | **Alt+O** | Alt+H (*Home*) |
| Insertar | Alt+B | Alt+N (*Insert*) |
| Diseño | Alt+C | Alt+G (*Design*) |
| Transiciones | Alt+T | Alt+K |
| Animaciones | Alt+N | Alt+A |
| Presentación con diapositivas | Alt+D | Alt+S |
| Revisar | Alt+R | Alt+R |
| Vista | Alt+V | Alt+W |

> ⚠️ La página de soporte de Microsoft **es-es** enumera los KeyTips de la interfaz **inglesa** (Alt+H para Inicio, Alt+N para Insertar…), porque es una traducción del original. **Sobre un PowerPoint instalado en español, la letra que aparece al pulsar Alt es la de la columna central.** Ante la duda en un examen práctico: pulsar **Alt** y leer lo que muestra la pantalla.`

const TAMANO = `

### Cambiar el tamaño de las diapositivas

En **Diseño ▸ Tamaño de diapositiva ▸ Personalizar tamaño de diapositiva** se elige entre Panorámica (16:9), Estándar (4:3) o una medida propia. **Cuando el cambio reduce el espacio disponible** (por ejemplo, al pasar de 16:9 a 4:3), PowerPoint pregunta qué hacer con el contenido y ofrece dos botones:

- **Maximizar** — aprovecha todo el espacio, a costa de que parte del contenido pueda quedar fuera de la diapositiva.
- **Asegurar el ajuste** — reduce el contenido para que **quepa entero** en el nuevo tamaño.`

const AV = `

## Audio y vídeo

### Vídeo

Se inserta desde **Insertar ▸ Vídeo ▸ Vídeo en mi PC**. En **Herramientas de vídeo ▸ Reproducción** está el desplegable **Inicio**, con estas opciones:

- **En secuencia de clics** — es **la opción predeterminada** al insertar un vídeo desde el equipo: el vídeo arranca en el punto que le corresponda dentro de la secuencia de clics de la diapositiva.
- **Automáticamente** — se reproduce al mostrarse la diapositiva.
- **Al hacer clic** — solo cuando se hace clic sobre el propio vídeo.

Otras opciones: Reproducir a pantalla completa, Ocultar mientras no se reproduce, Repetir hasta su interrupción y Rebobinar después de la reproducción.

### Audio

En **Herramientas de audio ▸ Reproducción**, además del desplegable Inicio, hay casillas propias:

- **Reproducir en segundo plano** — activa de golpe la combinación habitual para música de fondo: reproducción automática, **a lo largo de todas las diapositivas**, en bucle y con el icono oculto durante la presentación.
- Reproducir en todas las diapositivas · Repetir hasta su interrupción · Ocultar durante la presentación · Rebobinar después de la reproducción.

## Formato de texto: superíndice y subíndice

| Formato | Atajo |
|---|---|
| **Superíndice** | **Ctrl + Mayús + Más (+)** |
| **Subíndice** | **Ctrl + Igual (=)** |

También desde **Inicio ▸ Fuente**, con los botones x² y x₂, o en el cuadro de diálogo Fuente.`

const TRANS = `

## Categorías de transiciones

Las transiciones de la ficha **Transiciones** se agrupan en **tres categorías**:

1. **Sutil** — efectos discretos (Desvanecer, Empuje, Barrido, Dividir, Revelar, Cortar…).
2. **Llamativo** — efectos vistosos (Disolver, Cuadros bicolores, Persianas, Reloj, Ondulación, Panal, Destello…).
3. **Contenido dinámico** — mantienen fijo el fondo y **solo mueven el contenido** de la diapositiva (Panorámica, Noria, Transportador, Rotar, Órbita, Volar…).

## Teclas durante la presentación

| Tecla | Efecto |
|---|---|
| **B** o **.** (punto) | pantalla completamente **negra** |
| **W** o **,** (coma) | pantalla completamente **blanca** |
| Esc | finaliza la presentación |
| Número + Intro | salta a esa diapositiva |
| E | borra las anotaciones dibujadas |`

const PLAN = [
  { num: '1', añade: KEYTIPS },
  { num: '2', añade: TAMANO, reps: [[
    '- Duplicar: clic derecho > Duplicar diapositiva (o Ctrl+D)',
    '- Duplicar: clic derecho > Duplicar diapositiva (o **Ctrl+Mayús+D**; Ctrl+D duplica el objeto seleccionado dentro de la diapositiva)',
  ]] },
  { num: '3', añade: AV },
  { num: '4', añade: TRANS },
]

;(async () => {
  console.log(APPLY ? '⚠️  APPLY\n' : '🔎 DRY-RUN\n')
  let abortar = false
  const nuevos = []
  for (const p of PLAN) {
    const [a] = await sql`SELECT a.id, a.content FROM articles a JOIN laws l ON l.id = a.law_id
        WHERE l.short_name = 'PowerPoint 2016' AND a.article_number = ${p.num}`
    let c = a.content
    for (const [de, to] of p.reps || []) {
      const n = c.split(de).length - 1
      console.log(`  art.${p.num} · sustitución «${de.slice(0, 54)}…» → ${n} ocurrencia(s)`)
      if (n !== 1) { abortar = true; continue }
      c = c.replace(de, to)
    }
    c = c.trimEnd() + '\n' + p.añade + '\n'
    console.log(`  art.${p.num}: ${a.content.length} → ${c.length} chars`)
    nuevos.push({ id: a.id, num: p.num, c })
  }
  if (abortar) { console.error('\n❌ abortado'); await sql.end(); process.exit(1) }
  if (!APPLY) { console.log('\n✅ todo cuadra.'); await sql.end(); return }
  await sql.begin(async (tx) => {
    for (const n of nuevos) {
      await tx`UPDATE articles SET content = ${n.c}, updated_at = now() WHERE id = ${n.id}`
      console.log(`  ✍️  PowerPoint 2016 art.${n.num}`)
    }
  })
  console.log('\n✅ confirmado.')
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
