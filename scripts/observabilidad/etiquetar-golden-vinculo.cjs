#!/usr/bin/env node
/**
 * etiquetar-golden-vinculo.cjs — propone etiquetas para AMPLIAR el golden set de
 * `vinculo_articulo_vecino`, usando un panel de los mejores modelos medidos.
 *
 *   node scripts/observabilidad/etiquetar-golden-vinculo.cjs   # lee /tmp/nuevos20-full.json
 *
 * ## Para qué sirve y qué NO decide
 *
 * El golden set tiene 10 casos y con eso **no se puede elegir** entre un modelo de 10/10 y uno de
 * 8/10: ±1 acierto es ruido. Ampliarlo exige adjudicar casos nuevos, y adjudicar a mano es caro.
 *
 * Este script hace lo barato: pasa cada caso por TRES modelos y separa lo unánime de lo discutido.
 * **Donde los tres coinciden, la etiqueta se acepta; donde discrepan, la pone un humano.** Medido el
 * 30/07 sobre 20 casos: **11 unánimes y 9 con discrepancia**. Ese 45% de desacuerdo entre los tres
 * mejores modelos disponibles es, en sí mismo, la prueba de que adjudicar no se automatiza — y por
 * eso el panel es un FILTRO que ahorra la mitad del trabajo humano, no un juez.
 *
 * ⚠️ Antes de leer nada, comprobar que las llamadas se ejecutaron: el 30/07 se agotó el crédito de
 * OpenRouter y un modelo sin crédito devuelve lo mismo que un modelo incapaz.
 *
 * Contexto: ficha T-291 · `data/pilotos/RESULTADOS-vinculo-vecino.md`.
 */
const fs=require('fs'),path=require('path')
const { llamarModelo, hacerRegistrador } = require('./lib/ab-llm.cjs')
const env=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8')
const KEY=env.match(/^OPENROUTER_API_KEY=(.*)$/m)[1].trim()
const PANEL=['google/gemini-3.5-flash','nvidia/nemotron-3-super-120b-a12b','deepseek/deepseek-v4-pro']
const RAIZ=path.join(__dirname,'..','..')
const sql=require('postgres')(
  (fs.readFileSync(path.join(RAIZ,'.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)||[])[1].trim(),
  {ssl:{rejectUnauthorized:false},max:2,connect_timeout:30})
const registrar=hacerRegistrador(sql,'script:etiquetar-golden-vinculo','etiquetar_golden')
const casos=JSON.parse(fs.readFileSync('/tmp/nuevos20-full.json','utf8'))
const PROMPT=(c)=>`Eres un verificador de preguntas de oposición. Cada pregunta debe colgar del artículo que la responde.

PREGUNTA: ${c.enunciado}
A) ${c.opciones.A}
B) ${c.opciones.B}
C) ${c.opciones.C}
D) ${c.opciones.D}
RESPUESTA CORRECTA: ${c.correcta}) ${c.correcta_texto}

ARTÍCULO DONDE ESTÁ HOY (art. ${c.art_vinculado.numero}):
${c.art_vinculado.texto}

ARTÍCULO QUE PROPONE EL DETECTOR (art. ${c.art_sugerido.numero}):
${c.art_sugerido.texto}

¿Cuál de los dos sustenta LITERALMENTE la opción correcta? Avisos: (1) hay preguntas que abarcan varios artículos a la vez, y ahí el actual suele ser tan defendible como el sugerido; (2) si el enunciado pide señalar la INCORRECTA o lo que NO se incluye, la opción correcta puede pertenecer al otro artículo a propósito y el vínculo actual estar bien; (3) si el propio enunciado cita un artículo por su número, eso pesa.

Responde SOLO con JSON: {"veredicto":"vinculado_correcto"|"sugerido_mejor"|"ninguno","razon":"una frase"}`
// La llamada va por el núcleo común, que REGISTRA el gasto: así este script no añade gasto
// invisible y respeta el trinquete de `llmInstrumentation.guardrail.test.ts`.
async function llamar(modelo, prompt) {
  const r = await llamarModelo({ key: KEY, modelo, prompt, registrar })
  if (!r.data) return { v: 'SIN_JSON', razon: '' }
  return { v: r.data.veredicto, razon: r.data.razon || '' }
}

;(async()=>{
const res=[]
for(const c of casos){
  const votos=await Promise.all(PANEL.map(m=>llamar(m,PROMPT(c)).then(r=>({m,...r}))))
  const cuenta={}; for(const v of votos) cuenta[v.v]=(cuenta[v.v]||0)+1
  const orden=Object.entries(cuenta).sort((a,b)=>b[1]-a[1])
  const unanime=orden[0][1]===3
  res.push({id:c.id, ley:c.ley, art:c.art_vinculado.numero, sug:c.art_sugerido.numero,
    consenso:orden[0][0], apoyos:orden[0][1], unanime, votos:votos.map(v=>`${v.m.split('/')[1].slice(0,12)}=${v.v}`),
    razon:votos.find(v=>v.v===orden[0][0])?.razon||''})
  process.stderr.write(unanime?'.':'?')
}
fs.writeFileSync('/tmp/etiquetas20.json',JSON.stringify(res,null,1))
const un=res.filter(r=>r.unanime)
console.log(`\n\nunánimes (3/3): ${un.length}/20 → etiqueta por consenso`)
console.log(`con discrepancia: ${res.length-un.length}/20 → los adjudico yo`)
console.log('\nreparto de los unánimes:')
const c={}; for(const r of un) c[r.consenso]=(c[r.consenso]||0)+1
console.log(' ',JSON.stringify(c))
console.log('\nLOS QUE DISCREPAN:')
for(const r of res.filter(x=>!x.unanime)) console.log(`  ${r.id.slice(0,8)} ${r.ley} ${r.art}→${r.sug} · ${r.votos.join(' | ')}`)
await sql.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
