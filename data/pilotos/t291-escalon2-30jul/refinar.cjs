const fs=require('fs'),path=require('path');
const out=JSON.parse(fs.readFileSync(path.join(__dirname,'triaje-sin-cita.json'),'utf8'));
const NEG=/\bno\b.{0,40}\b(es|son|corresponde|figura|incluid|pertenece)|\bexcepto\b|\bincorrect|\bfalsa\b|\bNO\b/;
const META=/^(todas|ninguna|las anteriores|a y b|todas las)/i;
let neg=0,meta=0,resto=[];
for(const o of out){
  if(META.test((o.clave||'').trim())){meta++;continue}
  if(NEG.test(o.q||'')){neg++;continue}
  resto.push(o);
}
console.log(`de las ${out.length} sin cita:`);
console.log(`  ${meta} meta-opción («todas/ninguna») → no hay término que buscar`);
console.log(`  ${neg} de NEGACIÓN → que el término falte en el artículo es lo ESPERADO`);
console.log(`  ${resto.length} restantes = donde sí cabe preguntarse si el artículo lo dice\n`);
const bandas={alto:[],medio:[],bajo:[]};
for(const o of resto){const r=o.ratio;(r===null?bandas.bajo:r>=0.8?bandas.alto:r>=0.4?bandas.medio:bandas.bajo).push(o)}
for(const [k,l] of Object.entries(bandas)){
  console.log(`  ${k.padEnd(6)} ${String(l.length).padStart(3)}q · ${l.reduce((s,x)=>s+x.exp,0)} exp`);
}
console.log('\n### los que peor pinta tienen (medio/bajo, por exposición)');
for(const o of [...bandas.medio,...bandas.bajo].sort((a,b)=>b.exp-a.exp))
  console.log(`  ${o.id.slice(0,8)} ${String(o.exp).padStart(4)}exp ${o.ley} art.${o.num} · falta: ${o.ausentes.join(', ')} · «${o.q.replace(/\s+/g,' ')}»`);
