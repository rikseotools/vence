/**
 * @jest-environment node
 */
// El EMBUDO de preguntas de las sesiones a Manuel (T-493).
//
// Antes de esto una duda tenía dos destinos y los dos malos: la terminal de la sesión, donde muere
// con ella, o el `resume_check` de una tarea PAUSADA, donde `clasificarEspera` la buscaba con cinco
// expresiones regulares — si la sesión no escribía la palabra correcta, la pregunta desaparecía.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validarPregunta, ordenarEmbudo, respuestasSinLeer, esperaHoras, formatearEmbudo } =
  require('@/lib/backlog/preguntas.cjs')

const AHORA = new Date('2026-08-02T20:00:00Z')
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const p = (over: Record<string, any> = {}) => ({
  id: 1, sid: 'sesion-a', task_id: null, question: '¿hago A o B?', context: null,
  blocking: false, asked_at: haceH(1), status: 'open', seen_at: null, answer: null, ...over,
})

// Se comprueba en el punto de ESCRITURA, igual que el `--esfuerzo` obligatorio de `reserve`: una
// pregunta mal formulada obliga a pedir contexto, y entonces el embudo cuesta más que entrar en la
// sesión — que es justo lo que venía a evitar.
describe('validarPregunta — que se pueda contestar SIN abrir la sesión', () => {
  it('rechaza el «¿sigo?»: eso no es una decisión', () => {
    const v = validarPregunta({ question: '¿sigo?' })
    expect(v.ok).toBe(false)
    expect(v.problemas[0]).toContain('caracteres')
  })

  it('rechaza el problema sin alternativas: contestarlo obligaría a investigar', () => {
    const v = validarPregunta({ question: 'El barrido tarda mucho en las rutas de temario, es lento' })
    expect(v.ok).toBe(false)
    expect(v.problemas[0]).toContain('opciones')
  })

  it('acepta la que plantea la decisión', () => {
    expect(validarPregunta({ question: '¿El barrido entra en las rutas de test o lo dejo solo en públicas?' }).ok).toBe(true)
  })

  it('si BLOQUEA, el contexto es obligatorio (es lo que permite desbloquear sin ida y vuelta)', () => {
    const q = '¿Uso la cuenta de test o creo una nueva para el barrido?'
    expect(validarPregunta({ question: q, blocking: true }).ok).toBe(false)
    expect(validarPregunta({ question: q, blocking: true, context: 'la de test ya sirve preguntas' }).ok).toBe(true)
  })

  it('sin bloquear, el contexto no se exige: preguntar tiene que salir barato', () => {
    expect(validarPregunta({ question: '¿lo dejo en 10 rpm o subo a 20?' }).ok).toBe(true)
  })
})

// Ordenar solo por antigüedad enterraría una sesión parada hace diez minutos detrás de cinco dudas
// cómodas de ayer.
describe('ordenarEmbudo — lo que BLOQUEA primero, y dentro de eso lo más viejo', () => {
  it('una sesión parada adelanta a una duda vieja que no bloquea', () => {
    const orden = ordenarEmbudo([
      p({ id: 1, asked_at: haceH(30) }),
      p({ id: 2, asked_at: haceH(1), blocking: true }),
      p({ id: 3, asked_at: haceH(10) }),
    ])
    expect(orden.map((x: any) => x.id)).toEqual([2, 1, 3])
  })

  it('entre dos que bloquean, la más vieja', () => {
    const orden = ordenarEmbudo([
      p({ id: 1, asked_at: haceH(2), blocking: true }),
      p({ id: 2, asked_at: haceH(8), blocking: true }),
    ])
    expect(orden.map((x: any) => x.id)).toEqual([2, 1])
  })

  it('lo respondido y lo retirado no vuelve a salir', () => {
    expect(ordenarEmbudo([p({ status: 'answered' }), p({ id: 2, status: 'withdrawn' })])).toEqual([])
  })
})

// `seen_at` existe para que el aviso salga UNA vez: uno que se repite para siempre se vuelve
// indistinguible del ruido y se aprende a saltarlo, que es como murieron tres guardarraíles de
// este repo en un solo día.
describe('respuestasSinLeer — el camino de vuelta', () => {
  it('devuelve las respondidas que esta sesión aún no ha visto', () => {
    const r = respuestasSinLeer([
      p({ id: 1, status: 'answered', answer: 'sí' }),
      p({ id: 2, status: 'answered', answer: 'no', seen_at: haceH(1) }),
      p({ id: 3, status: 'open' }),
    ], 'sesion-a')
    expect(r.map((x: any) => x.id)).toEqual([1])
  })

  it('no enseña las de OTRA sesión', () => {
    expect(respuestasSinLeer([p({ status: 'answered', sid: 'sesion-b' })], 'sesion-a')).toEqual([])
  })

  it('sin sid no afirma nada', () => {
    expect(respuestasSinLeer([p({ status: 'answered' })], null)).toEqual([])
  })
})

describe('esperaHoras — el dato que convierte «hay preguntas» en «hay una sesión parada»', () => {
  it('redondea a la BAJA: exagerar la espera resta credibilidad', () => {
    expect(esperaHoras(p({ asked_at: haceH(5.9) }), AHORA)).toBe(5)
    expect(esperaHoras(p({ asked_at: haceH(0.4) }), AHORA)).toBe(0)
  })
})

describe('formatearEmbudo — lo que Manuel lee de un vistazo', () => {
  it('sin preguntas no imprime nada (un embudo vacío no debe ocupar pantalla)', () => {
    expect(formatearEmbudo([])).toEqual([])
    expect(formatearEmbudo([p({ status: 'answered' })])).toEqual([])
  })

  it('canta cuántas tienen la sesión PARADA, que es lo que cuesta dinero', () => {
    const l = formatearEmbudo([p({ blocking: true }), p({ id: 2 })], { ahora: AHORA })
    expect(l[0]).toContain('2 PREGUNTA(S)')
    expect(l[0]).toContain('1 con la sesión PARADA')
  })

  it('cada línea lleva la tarea, la espera y cómo responder', () => {
    const l = formatearEmbudo([p({ task_id: 'T-487', asked_at: haceH(6) })], { ahora: AHORA })
    expect(l[1]).toContain('[T-487]')
    expect(l[1]).toContain('(6h)')
    expect(l.at(-1)).toContain('responder')
  })

  it('con muchas, recorta y DICE cuántas quedan (nunca trunca en silencio)', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => p({ id: i + 1 }))
    const l = formatearEmbudo(muchas, { ahora: AHORA, limite: 5 })
    expect(l.some((x: string) => x.includes('…y 15 más'))).toBe(true)
  })
})

describe('[T-705] el embudo avisa si ya hay una pregunta abierta sobre la misma tarea', () => {
  const fs = require('fs')
  const path = require('path')
  const cli = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'backlog.cjs'), 'utf8')
  // El bloque del comando `preguntar`, para no medir coincidencias de otros sitios del CLI.
  const bloque = cli.slice(cli.indexOf("cmd === 'preguntar'"), cli.indexOf("cmd === 'borrador'"))

  it('consulta las preguntas ABIERTAS de esa tarea antes de insertar la nueva', () => {
    const iConsulta = bloque.indexOf('session_questions')
    const iInsert = bloque.indexOf('INSERT INTO public.session_questions')
    expect(iConsulta).toBeGreaterThan(-1)
    expect(iInsert).toBeGreaterThan(iConsulta)   // avisa ANTES, o el aviso no sirve de nada
    expect(bloque).toContain("status = 'open'")
  })

  it('no cuenta las TUYAS: repreguntar sobre tu propia tarea no es un duplicado', () => {
    expect(bloque).toContain('sid IS DISTINCT FROM')
  })

  it('AVISA pero NO bloquea: la segunda pregunta suele ser legítima', () => {
    // «avisar ≠ bloquear» es uno de los nueve principios del sistema de sesiones. Otra sesión
    // puede haber medido algo que la primera no tenía.
    const tras = bloque.slice(bloque.indexOf('YA HAY'))
    expect(tras).not.toMatch(/process\.exit\(/)
  })

  it('enseña el id y el texto de la previa, que es lo que permite decidir', () => {
    expect(bloque).toMatch(/#\$\{p\.id\}/)
    expect(bloque).toContain('p.question')
  })

  it('ofrece el camino corto: contestar a la que ya está en vez de abrir otra', () => {
    expect(bloque).toContain('responder ${previas[0].id}')
  })

  it('usa la columna que existe (`asked_at`), no una inventada', () => {
    // Se estrenó con `created_at` y reventó en la primera ejecución real: la tabla no la tiene.
    expect(bloque).toContain('asked_at')
    expect(bloque).not.toMatch(/session_questions[\s\S]{0,200}created_at/)
  })
})
