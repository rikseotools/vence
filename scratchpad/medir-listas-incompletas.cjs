// ¿Alguna de las listas que dicen «TODOS los X» está YA incompleta?
//
// Esa es la prueba decisiva de [T-722]. Una lista fija no es peligrosa por serlo: es peligrosa
// cuando ya se quedó corta y el guardarraíl sigue dando verde sobre un universo que no es el real.
// Aquí se contrasta cada lista contra lo que hay de verdad en el árbol.
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..')

function ficheros(dir, out = []) {
  const abs = path.join(REPO, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (/node_modules|\.next|dist/.test(rel)) continue
    if (e.isDirectory()) ficheros(rel, out)
    else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

const TODOS = [...ficheros('scripts'), ...ficheros('lib'), ...ficheros('app'), ...ficheros('backend/src')]

/** Cada caso: la lista declarada y cómo se reconoce de verdad a un miembro. */
const CASOS = [
  {
    nombre: 'ESCRITORES de explicación estructurada',
    test: '__tests__/guardrails/escritoresExplicacionConsultanDetector.test.ts',
    declarados: ['scripts/aplicar-explicacion.ts', 'scripts/backfill-explanation-data.ts'],
    // Escribe `explanation_data` en `questions`: eso es ser escritor, se llame como se llame.
    esMiembro: (src) => /explanation_data/.test(src) &&
      /(UPDATE\s+questions|\.update\(\s*questions|set\(\{[^}]*explanationData)/is.test(src),
  },
  {
    nombre: 'SCRIPTS_DE_DINERO',
    test: '__tests__/guardrails/dineroTrabajador.guardrail.test.ts',
    declarados: [
      'scripts/backfill-loyalty-coupons.cjs', 'scripts/import-stripe-payments.cjs',
      'scripts/conciliar-vales.ts', 'scripts/stripe/precio-heredado.cjs',
    ],
    // Toca dinero: pide la puerta, o habla con Stripe para algo que no es solo leer.
    esMiembro: (src) => /puedeTocarDinero|OPERACIONES_DE_DINERO/.test(src) ||
      /stripe\.(coupons|subscriptions|invoices|refunds|paymentIntents)\.(create|update|del|cancel|pay)/.test(src),
  },
]

for (const c of CASOS) {
  const reales = TODOS.filter((f) => {
    let src = ''
    try { src = fs.readFileSync(path.join(REPO, f), 'utf8') } catch { return false }
    return c.esMiembro(src)
  })
  const faltan = reales.filter((f) => !c.declarados.includes(f))
  const sobran = c.declarados.filter((d) => !reales.includes(d))
  console.log(`── ${c.nombre}`)
  console.log(`   declarados: ${c.declarados.length} · encontrados en el árbol: ${reales.length}`)
  console.log(`   ⚠️  NO declarados: ${faltan.length}`)
  for (const f of faltan.slice(0, 10)) console.log(`        + ${f}`)
  if (sobran.length) console.log(`   (declarados que ya no cumplen el criterio: ${sobran.join(', ')})`)
  console.log('')
}
