import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GUARDRAIL / CANARY — TODO cliente LLM del frontend está instrumentado
// ============================================================================
// "Todo debería ser observable": cada `new Anthropic(...)` / `new OpenAI(...)` en app|lib DEBE
// ir envuelto por `instrumentAnthropic(...)` / `instrumentOpenai(...)` (lib/observability/llm.ts),
// para que su uso/tokens/coste se registren en observable_events. Un cliente crudo sin envolver
// es un punto ciego de gasto (justo el bug que motivó esto: generate-explanation creaba un OpenAI
// crudo → invisible). Si alguien añade un cliente nuevo sin instrumentar, este test lo caza.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\.|lib\/observability\/llm\.ts/

function walk(rel: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(join(ROOT, rel)) } catch { return [] }
  for (const e of entries) {
    const child = `${rel}/${e}`
    if (SKIP.test(child)) continue
    const st = statSync(join(ROOT, child))
    if (st.isDirectory()) out = out.concat(walk(child))
    else if (EXT.test(e)) out.push(child)
  }
  return out
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('GUARDRAIL: todo cliente LLM del frontend va instrumentado', () => {
  const files = SCAN_DIRS.flatMap(walk).map((rel) => ({ rel, src: stripComments(readFileSync(join(ROOT, rel), 'utf8')) }))

  it('cada `new Anthropic(` está envuelto por instrumentAnthropic(', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const m of f.src.matchAll(/new\s+Anthropic\s*\(/g)) {
        const around = f.src.slice(Math.max(0, m.index! - 40), m.index! + 20)
        if (!/instrumentAnthropic\s*\(\s*$/.test(around.slice(0, around.length - (m[0].length))) &&
            !/instrumentAnthropic\s*\(/.test(around)) offenders.push(f.rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('cada `new OpenAI(` está envuelto por instrumentOpenai(', () => {
    const offenders: string[] = []
    for (const f of files) {
      for (const m of f.src.matchAll(/new\s+OpenAI\s*\(/g)) {
        const around = f.src.slice(Math.max(0, m.index! - 40), m.index! + 20)
        if (!/instrumentOpenai\s*\(/.test(around)) offenders.push(f.rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('los clientes compartidos importan e instrumentan', () => {
    const an = files.find((f) => f.rel === 'lib/chat/shared/anthropic.ts')!
    const oa = files.find((f) => f.rel === 'lib/chat/shared/openai.ts')!
    expect(an.src).toMatch(/instrumentAnthropic/)
    expect(oa.src).toMatch(/instrumentOpenai/)
  })
})
