// ¿Por qué SUBE el contador de la campaña si solo he AÑADIDO preguntas?
// Recalcula el finding dos veces sobre las mismas filas: con todas las preguntas activas, y
// como si las 31 de hoy no existieran. La diferencia de conjuntos dice exactamente qué temas
// entraron o salieron POR MI TRABAJO, y separa eso de lo que hayan movido otras sesiones.
const { Client } = require('pg');
const LOTES = ['gen_lopdgdd_t115_2026-07-31','gen_lcsp_t115_2026-07-31','gen_lcsp_cierre_t115_2026-07-31'];
const U = { minArticulos:4, minCobertura:0.6, minHuecos:4 };
const cuenta = n => /^[0-9]+$/.test(n) || /^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$/i.test(n);
const dispara = t => t.n>=U.minArticulos && t.cubiertos<t.n && (t.cubiertos/t.n)>=U.minCobertura && (t.n-t.cubiertos)>=U.minHuecos;

function evaluar(filas, campo){
  const m = new Map();
  for(const f of filas){
    if(!cuenta(f.articulo)) continue;
    if(!m.has(f.topicId)) m.set(f.topicId,{pt:f.pt,tema:f.tema,n:0,cubiertos:0});
    const t=m.get(f.topicId); t.n++; if(f[campo]) t.cubiertos++;
  }
  const out=new Map();
  for(const [k,t] of m) if(dispara(t)) out.set(k,t);
  return out;
}

(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/,''),ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`
    SELECT tp.position_type pt, tp.id::text "topicId", tp.topic_number tema, a.article_number articulo,
      EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id AND q.is_active) cubierto,
      EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id=a.id AND q.is_active
                AND NOT (coalesce(q.tags,'{}'::text[]) && $1::text[])) "cubiertoAntes"
    FROM topic_scope ts
    JOIN topics tp ON tp.id=ts.topic_id AND tp.is_active
    JOIN laws l ON l.id=ts.law_id
    JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
    JOIN articles a ON a.law_id=ts.law_id AND a.article_number=an.num AND a.is_active
    WHERE length(coalesce(a.content,''))>40 AND a.content NOT ILIKE '%derogado%'`, [LOTES]);

  const ahora = evaluar(r.rows,'cubierto');
  const antes = evaluar(r.rows,'cubiertoAntes');
  console.log('temas que disparan AHORA (con mis 31 preguntas):', ahora.size);
  console.log('temas que disparaban SIN ellas:                 ', antes.size);
  const entraron=[...ahora.keys()].filter(k=>!antes.has(k));
  const salieron=[...antes.keys()].filter(k=>!ahora.has(k));
  const antesTodos = (()=>{const m=new Map();for(const f of r.rows){if(!cuenta(f.articulo))continue;
    if(!m.has(f.topicId))m.set(f.topicId,{n:0,cubiertos:0});const t=m.get(f.topicId);t.n++;if(f.cubiertoAntes)t.cubiertos++;}return m})();
  console.log('\n→ ENTRARON por mis preguntas:', entraron.length, '(cobertura ANTES → AHORA; el corte del detector está en el 60%)');
  for(const k of entraron){const t=ahora.get(k);const a=antesTodos.get(k);
    console.log('   ',(t.pt+' T'+t.tema).padEnd(52), `${a.cubiertos}/${a.n} = ${(100*a.cubiertos/a.n).toFixed(1)}%  →  ${t.cubiertos}/${t.n} = ${(100*t.cubiertos/t.n).toFixed(1)}%`, '· huecos:', t.n-t.cubiertos)}
  console.log('→ SALIERON por mis preguntas:', salieron.length);
  for(const k of salieron){const t=antes.get(k);console.log('   ',t.pt,'T'+t.tema,`(antes ${t.cubiertos}/${t.n})`)}
  await c.end();
})();
