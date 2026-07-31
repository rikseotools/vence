/**
 * @jest-environment node
 */
// Guardarraíl del backlog: el fichero docs/roadmap/tareas-pendientes.md y la tabla
// `backlog_tasks` se unen por el id `T-xxx` de cada cabecera. Si una cabecera pierde el
// id, o hay ids repetidos, el join se rompe EN SILENCIO y dos sesiones vuelven a pisarse.
//
// No toca BD a propósito: así corre en CI. La comparación contra la tabla la hace
// `node scripts/backlog.cjs sync` (avisa de huérfanas en ambos sentidos).
//
// Mismo patrón que __tests__/lib/admin/runbookRegistry.test.ts (registro ↔ CLAUDE.md).
import { readFileSync } from 'fs'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { tituloDependeDeFecha } = require('../../lib/backlog/plazo.cjs')
import { join } from 'path'
import { parseBacklogMarkdown, findHeadingsWithoutId, findDateLockedTitles } from '@/lib/backlog/claim'

const MD_PATH = join(process.cwd(), 'docs', 'roadmap', 'tareas-pendientes.md')
const md = readFileSync(MD_PATH, 'utf8')
const tasks = parseBacklogMarkdown(md)

describe('backlog — guardarraíles de tareas-pendientes.md', () => {
  it('hay tareas que auditar (el fichero no se ha vaciado por accidente)', () => {
    expect(tasks.length).toBeGreaterThan(10)
  })

  it('TODA cabecera de tarea lleva su id [T-xxx]', () => {
    // Sin id no se puede coger la tarea: `backlog.cjs claim` no la encuentra.
    const sinId = findHeadingsWithoutId(md)
    expect(sinId).toEqual([])
  })

  it('los ids son ÚNICOS (un id duplicado haría que dos tareas compartan claim)', () => {
    const vistos = new Map<string, string[]>()
    for (const t of tasks) vistos.set(t.id, [...(vistos.get(t.id) || []), t.title])
    const dup = [...vistos.entries()].filter(([, v]) => v.length > 1)
    expect(dup).toEqual([])
  })

  it('ninguna cabecera deja el TÍTULO vacío (si no, la tarea es invisible)', () => {
    // Origen: T-067 (31/07/2026). Quien la reabrió escribió TODO el texto dentro del
    // corchete de fecha —`### [T-067] 🟡 [REABIERTA 30/07 — falta avisar a Jesús David…]`—
    // y el parser, que quita ese corchete para quedarse con el título, se quedó sin nada.
    // Efecto: `next` no la sugería y en `list` salía una línea EN BLANCO, así que una
    // oposición construida y verificada (celador-murcia, 9.545 preguntas) llevaba días
    // esperando go-live sin que nadie pudiera verla. El título va DESPUÉS del corchete.
    const sinTitulo = tasks
      .filter(t => !t.doneMarked && !String(t.title ?? '').trim())
      .map(t => `${t.id} (cabecera sin título fuera del corchete)`)
    expect(sinTitulo).toEqual([])
  })

  it('toda tarea VIVA y NO aparcada declara prioridad con su emoji (🔴/🟠/🟡/🟢)', () => {
    // La prioridad ordena el reparto; sin ella `next` no sabe qué sugerir.
    // Exentas: las cerradas (✅) y las APARCADAS (⬜). Aparcar es una decisión
    // explícita ("esto no entra en el orden de ataque, por coste/tamaño"), no un
    // descuido: exigirle prioridad obligaría a inventar una falsa. Lo que el
    // guardarraíl sigue cazando es la tarea viva a la que se le OLVIDÓ ponerla.
    const sinPrioridad = tasks
      .filter(t => !t.doneMarked && !t.parked && t.priority == null)
      .map(t => `${t.id} ${t.title}`)
    expect(sinPrioridad).toEqual([])
  })

  it('el fichero conserva la sección "## Abiertas" (de ella depende el estado)', () => {
    expect(/^##\s+Abiertas\s*$/m.test(md)).toBe(true)
  })

  it('los ids siguen el formato T-NNN', () => {
    for (const t of tasks) expect(t.id).toMatch(/^T-\d{3}$/)
  })
})

// Un runbook que Claude no sabe cuándo leer no sirve de nada: la frase-gatillo tiene que
// estar en CLAUDE.md, que es lo que Claude lee en cada sesión. Este bloque nace de un fallo
// real: el runbook se ancló SIN la frase "revisa las tareas pendientes" —justo la forma
// natural, y la convención del resto del proyecto ("revisa OEPs", "revisa rollover"…)—
// así que el disparador no saltaba con la frase que de verdad usa el usuario.
describe('backlog — el disparador está donde Claude lo lee', () => {
  const claudeMd = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8')
  const runbook = readFileSync(join(process.cwd(), 'docs', 'runbooks', 'tareas-pendientes.md'), 'utf8')

  // SPEC: frases con las que un humano pide el backlog. Si añades una al runbook,
  // añádela aquí Y a CLAUDE.md (este test te lo recuerda).
  const FRASES_GATILLO = [
    'revisa las tareas pendientes',
    'revisa el backlog',
    '¿qué tareas pendientes tenemos?',
    'coge una tarea',
    'añádelo a pendientes',
  ]

  it('CLAUDE.md enlaza el runbook del backlog', () => {
    expect(claudeMd).toContain('docs/runbooks/tareas-pendientes.md')
  })

  it('cada frase-gatillo está en CLAUDE.md (si no, el disparador no salta)', () => {
    const ausentes = FRASES_GATILLO.filter(f => !claudeMd.toLowerCase().includes(f.toLowerCase()))
    expect(ausentes).toEqual([])
  })

  it('cada frase-gatillo está también en el propio runbook', () => {
    const ausentes = FRASES_GATILLO.filter(f => !runbook.toLowerCase().includes(f.toLowerCase()))
    expect(ausentes).toEqual([])
  })

  it('CLAUDE.md recuerda la regla dura: coger ANTES de trabajar', () => {
    expect(claudeMd).toMatch(/coger ANTES de trabajar/i)
  })

  it('el runbook enlaza el manual de push/deploy (cerrar el ciclo)', () => {
    expect(runbook).toContain('pusheo-revision-despliegue.md')
  })
})

// La REGLA DURA ("coger ANTES de trabajar") dependía solo de la disciplina de leerla. El
// 20/07 se coló dos veces (RD 176/2022 y T-044/Almería) → se añade ENFORCEMENT: un pre-push
// que bloquea si empujas un commit que menciona un T-NNN vivo que no tienes reclamado.
// Este bloque fija que el hook exista, invoque el bridge, y que las docs lo cuenten.
describe('backlog — enforcement del claim por pre-push', () => {
  const hook = readFileSync(join(process.cwd(), '.husky', 'pre-push'), 'utf8')
  const claudeMd = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8')
  const runbook = readFileSync(join(process.cwd(), 'docs', 'runbooks', 'tareas-pendientes.md'), 'utf8')

  it('.husky/pre-push invoca el guard del backlog', () => {
    expect(hook).toContain('backlog-push-guard.cjs')
  })

  it('el guard existe y expone la lógica pura testeable', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractTaskIds, evaluatePush } = require('@/lib/backlog/pushGuard.cjs')
    expect(typeof extractTaskIds).toBe('function')
    expect(typeof evaluatePush).toBe('function')
  })

  it('CLAUDE.md y el runbook mencionan la enforcement por pre-push (para que se sepa que existe)', () => {
    expect(claudeMd).toMatch(/pre-push/i)
    expect(runbook).toMatch(/pre-push/i)
  })

  // El comando `reserve` existía desde el episodio T-123/T-126 y NO estaba escrito en ningún sitio
  // donde alguien lo lea: 0 menciones en CLAUDE.md, 0 en el runbook. Resultado, 4 colisiones más el
  // 28/07. Una herramienta que resuelve el problema pero nadie conoce no lo resuelve.
  it('el comando `reserve` está documentado donde se lee (CLAUDE.md y su runbook)', () => {
    const claude = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf-8')
    const runbook = readFileSync(join(process.cwd(), 'docs/runbooks/tareas-pendientes.md'), 'utf-8')
    expect(claude).toMatch(/backlog\.cjs[^\n]*reserve/)
    expect(runbook).toContain('reserve')
  })

  it('el sync ABORTA ante ids duplicados en vez de pisar la tarea ajena', () => {
    const src = readFileSync(join(process.cwd(), 'scripts/backlog.cjs'), 'utf-8')
    expect(src).toContain('sync ABORTADO')
    // y el aviso tiene que enseñar la salida, no solo quejarse
    expect(src).toMatch(/sync ABORTADO[\s\S]{0,1200}backlog\.cjs reserve/)
  })

  it('ninguna tarea VIVA codifica un candado de fecha en el TÍTULO', () => {
    // El campo existe (`snooze_until`, desde el 28/07) y aun así el 29/07 seguía habiendo dos
    // fichas gritando la fecha en la cabecera: T-221 «⛔ NO COGER HASTA EL 29/07 07:00 UTC» y
    // T-234 «⏱ MEDIR EL 11/08». Un título no vence solo — la fecha de T-221 pasó y el texto
    // siguió diciendo "no coger", así que la tarea quedó congelada por una cadena de caracteres.
    //
    // La fecha va en la BD, que sí vence sola:
    //    node scripts/backlog.cjs snooze <id> --hasta <fecha> --motivo "…"
    //    node scripts/backlog.cjs pause  <id> --tras-deploy --hecho "…" --falta "…"
    const vivas = tasks.filter((t) => t.inOpenSection && !t.doneMarked)
    const candados = findDateLockedTitles(vivas)
    expect(candados.map((c) => `${c.id} (${c.patron}): ${c.title}`)).toEqual([])
  })

  it('ningún título VIVO se apoya en una palabra relativa («hoy», «último día»)', () => {
    // Hermano del anterior, y el caso peor: aquel caza «NO COGER HASTA EL 29/07», que al menos
    // parece una fecha. Este caza «hoy es el ÚLTIMO día», que NO lo parece y sin embargo caduca
    // en 24 horas — se escribe un día y al siguiente el título miente sin que nada cambie.
    //
    // Caso real (T-330, 30/07/2026): «Newsletter: hoy es el ÚLTIMO día de plazo de Conserjería
    // de la UJA». El valor de esa tarea moría el 31/07 a las 23:59 y lo único que lo decía era
    // ese «hoy», escrito la víspera. Desde el 31/07 hay campo para eso:
    //    node scripts/backlog.cjs due <id> --fecha "…" --motivo "quién lo espera o qué lo fija"
    const vivas = tasks.filter((t) => t.inOpenSection && !t.doneMarked)
    const relativos = vivas.filter((t) => tituloDependeDeFecha(t.title))
    expect(relativos.map((t) => `${t.id}: ${t.title}`)).toEqual([])
  })
})
/**
 * Una ficha CERRADA no puede vivir en la sección «## Abiertas».
 *
 * Medido el 30/07/2026: de 184 fichas listadas como abiertas, **70 estaban cerradas en la BD** y
 * **65 lo decían en su propio título** (`✅`, `HECHA`, `CERRADA`, `CANCELADA`, `RESUELTA`). Las
 * abiertas de verdad eran 114.
 *
 * No es cosmético: quien abre el backlog para elegir trabajo lee 184 entradas y más de un tercio
 * son ruido. Y el `done` del CLI ya avisa de que hay que mover la entrada — pero avisar no basta,
 * porque el aviso se ve una vez y el fichero se queda así para siempre.
 *
 * Se comprueba por TEXTO a propósito: este guardarraíl corre en CI sin acceso a la base de datos,
 * así que no puede preguntar el `status`. El título es la señal que sí está a mano, y con ella
 * habría cazado 65 de los 70 casos.
 */
describe('guardarraíl — las fichas cerradas no se quedan en «## Abiertas»', () => {
  // La marca de cierre tiene que estar en la POSICIÓN DEL ESTADO, no en cualquier parte del
  // título. Con una regex ingenua, `[30/07 — fuga CERRADA y 141 reparadas]` daba falso positivo:
  // la cerrada era la fuga, no la tarea. Dos formas válidas, las que usa el fichero:
  //   `### [T-286] ✅ [HECHA 29/07] …`   → emoji de cerrada justo tras el id
  //   `### [T-095] … [CANCELADA 24/07] …` → el corchete de estado EMPIEZA por la marca
  const CERRADA_POR_EMOJI = /^### \[T-\d+\]\s*✅/
  const CERRADA_POR_ESTADO = /^### \[T-\d+\][^[]*\[\s*(HECHA|CERRADA|CANCELADA|RESUELTA|DESCARTADA)\b/i
  const CERRADA = { test: (l: string) => CERRADA_POR_EMOJI.test(l) || CERRADA_POR_ESTADO.test(l) }

  function cabecerasDeAbiertas(): string[] {
    const lineas = readFileSync(MD_PATH, 'utf8').split('\n')
    const iAb = lineas.findIndex((l) => l.trim() === '## Abiertas')
    const iHe = lineas.findIndex((l, i) => i > iAb && l.trim() === '## Hechas')
    if (iAb < 0 || iHe < 0) return []
    return lineas.slice(iAb, iHe).filter((l) => l.startsWith('### [T-'))
  }

  it('ninguna cabecera de «## Abiertas» se anuncia como cerrada', () => {
    const malas = cabecerasDeAbiertas()
      .filter((l) => CERRADA.test(l))
      .map((l) => l.slice(0, 110))
    // El detalle va DENTRO del valor comparado: Jest no acepta un 2º argumento en expect()
    // (eso es Vitest) y, si se pasa, lanza en vez de comparar — ya me costó un rojo hoy.
    expect({ fichasCerradasEnAbiertas: malas }).toEqual({ fichasCerradasEnAbiertas: [] })
  })
})
