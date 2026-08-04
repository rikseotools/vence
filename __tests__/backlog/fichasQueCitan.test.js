// __tests__/backlog/fichasQueCitan.test.js — [T-517]
//
// Que el dossier de un caso enseñe las fichas VIVAS que lo citan. Puro: recibe el markdown.
//
// Nace del 04/08: el feedback 8b788ee0 (Neus) cambió de manos con su ficha [T-507] ya resuelta
// —diagnóstico, arreglo pusheado y borrador pendiente— y la sesión que lo cogió no podía saberlo.

const { fichasQueCitan, lineasDossier } = require('../../lib/backlog/fichasQueCitan.cjs')

const MD = `
## Abiertas

### [T-507] 🟡 [ABIERTO 03/08] El contador anuncia preguntas que el test no sirve

- **CÓMO SALIÓ.** Feedback \`8b788ee0\` de Neus (premium): el tema 3 anunciaba 39 y servía 22.
- **ESTADO:** pusheado, sin desplegar.

### [T-999] 🟠 [ABIERTO 01/08] Otra cosa que no tiene nada que ver

- Nada que ver con ese caso.

## Hechas

### [T-100] ✅ [HECHA 02/08] Algo ya cerrado que también citaba 8b788ee0

- Se resolvió hace tiempo el caso \`8b788ee0\`.
`

describe('fichasQueCitan', () => {
  it('encuentra la ficha VIVA que cita el caso por su id corto', () => {
    const r = fichasQueCitan(MD, ['8b788ee0-9384-4982-bc6a-c91a0d11730a', '8b788ee0'])
    expect(r.map((x) => x.id)).toEqual(['T-507'])
  })

  it('NO devuelve las cerradas: son historia, no contexto pendiente', () => {
    // T-100 cita el mismo caso y lleva ✅. Incluirla llenaría el dossier de ruido, que es
    // como se dejan de leer estos bloques.
    const r = fichasQueCitan(MD, ['8b788ee0'])
    expect(r.find((x) => x.id === 'T-100')).toBeUndefined()
  })

  it('no arrastra fichas que no lo mencionan', () => {
    const r = fichasQueCitan(MD, ['8b788ee0'])
    expect(r.find((x) => x.id === 'T-999')).toBeUndefined()
  })

  it('trae el extracto: la línea donde se explica el porqué, no la cabecera', () => {
    const [f] = fichasQueCitan(MD, ['8b788ee0'])
    expect(f.extracto).toContain('Neus')
    expect(f.extracto).toContain('39')
  })

  it('exige frontera: un id corto dentro de otro hash NO cuenta', () => {
    const md = '### [T-1] 🟡 [ABIERTO] x\n\n- hash 8b788ee0aa11bb22 de otra cosa\n'
    expect(fichasQueCitan(md, ['8b788ee0'])).toEqual([])
  })

  it('ignora identificadores demasiado cortos (casarían con cualquier cosa)', () => {
    expect(fichasQueCitan(MD, ['8b7'])).toEqual([])
    expect(fichasQueCitan(MD, [])).toEqual([])
  })

  it('casa también el uuid entero, no solo el corto', () => {
    const md = '### [T-2] 🟡 [ABIERTO] y\n\n- viene de 8b788ee0-9384-4982-bc6a-c91a0d11730a\n'
    expect(fichasQueCitan(md, ['8b788ee0-9384-4982-bc6a-c91a0d11730a']).map((x) => x.id)).toEqual(['T-2'])
  })

  it('el criterio de VIVA sale del parser compartido: manda el ✅, no la sección', () => {
    // Una ficha cerrada colocada bajo "## Abiertas" sigue siendo cerrada (T-382). Si esto se
    // decidiera aquí por la sección, volveríamos a tener dos verdades sobre qué está vivo.
    const md = '## Abiertas\n\n### [T-3] ✅ [HECHA 01/08] cerrada pero mal colocada\n\n- cita 8b788ee0\n'
    expect(fichasQueCitan(md, ['8b788ee0'])).toEqual([])
  })
})

describe('lineasDossier', () => {
  it('sin fichas no imprime nada (silencio = no hay contexto que rescatar)', () => {
    expect(lineasDossier([])).toEqual([])
  })

  it('avisa de lo que de verdad importa: no rediagnosticar ni prometer de más', () => {
    const txt = lineasDossier(fichasQueCitan(MD, ['8b788ee0'])).join('\n')
    expect(txt).toMatch(/FICHA VIVA/)
    expect(txt).toMatch(/ANTES de rediagnosticar/)
    expect(txt).toMatch(/no se ha desplegado/)
  })
})
