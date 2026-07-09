require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const LAW = 'd47fcaab-f099-499f-b47b-1996db4f71d6';
const h = fs.readFileSync('/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad/ley5.html','utf8');

function decode(t){ return t.replace(/&aacute;/g,'á').replace(/&eacute;/g,'é').replace(/&iacute;/g,'í').replace(/&oacute;/g,'ó').replace(/&uacute;/g,'ú').replace(/&ntilde;/g,'ñ').replace(/&Aacute;/g,'Á').replace(/&Eacute;/g,'É').replace(/&Iacute;/g,'Í').replace(/&Oacute;/g,'Ó').replace(/&Uacute;/g,'Ú').replace(/&Ntilde;/g,'Ñ').replace(/&uuml;/g,'ü').replace(/&laquo;/g,'«').replace(/&raquo;/g,'»').replace(/&aacute;/g,'á').replace(/&deg;/g,'°').replace(/&ordm;/g,'º').replace(/&ordf;/g,'ª').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#8217;/g,"'").replace(/&#8230;/g,'…').replace(/&middot;/g,'·').replace(/&hellip;/g,'…').replace(/&rsquo;/g,"'").replace(/&lsquo;/g,"'").replace(/&ldquo;/g,'"').replace(/&rdquo;/g,'"').replace(/&mdash;/g,'—').replace(/&ndash;/g,'–'); }
function strip(html){ return decode(html.replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(); }

// dividir por bloques de artículo
const parts = h.split('<div class="bloque" id="a');
const arts = [];
for (let i=1;i<parts.length;i++){
  const blk = parts[i];
  const idm = blk.match(/^([0-9]+(?:[\s_]?bis|[\s_]?ter)?)"/i);
  if(!idm) continue;
  let num = idm[1].replace(/_/g,' ').replace(/\s+/g,' ').trim(); // "47 bis"
  // título
  const tm = blk.match(/<h[45] class="articulo">\s*Art[ií]culo\s+[0-9]+[^.]*\.\s*([^<]*)<\/h[45]>/i);
  const title = tm ? strip(tm[1]) : '';
  // contenido: todos los <p class="parrafo..."> hasta el fin del bloque (antes del próximo div bloque)
  const endIdx = blk.indexOf('<div class="bloque"');
  const body = endIdx>0 ? blk.slice(0,endIdx) : blk;
  const paras = [...body.matchAll(/<p class="parrafo[^"]*">([\s\S]*?)<\/p>/g)].map(m=>strip(m[1])).filter(Boolean);
  const content = paras.join('\n\n');
  arts.push({ article_number:num, title, content, len:content.length });
}
console.log('Artículos parseados:', arts.length);
console.log('cortos (<120 chars):', arts.filter(a=>a.len<120).map(a=>a.article_number+':'+a.len).join(',')||'(ninguno)');
console.log('rango:', arts[0].article_number, '...', arts[arts.length-1].article_number);
fs.writeFileSync('/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad/ley5_arts.json', JSON.stringify(arts));

(async()=>{
  const {data:exist}=await s.from('articles').select('article_number').eq('law_id',LAW);
  const have=new Set(exist.map(a=>String(a.article_number)));
  const nuevos=arts.filter(a=>!have.has(a.article_number));
  console.log('ya en BD:', have.size, '| nuevos a insertar:', nuevos.length);
  console.log('muestra nuevo:', JSON.stringify({n:nuevos[0]?.article_number, title:nuevos[0]?.title, content:nuevos[0]?.content.slice(0,80)}));
})();
