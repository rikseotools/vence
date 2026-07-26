const fs=require('fs'),path=require('path');
const {makeClient}=require('./db.cjs');
const {analizarLongitud}=require('../lib/generacion/tellLongitud');
const {analizarLiteralidad,analizarIntruso}=require('../lib/generacion/literalidad');
const {analizarCabecera}=require('../lib/generacion/cabeceraExplicacion');
const {analizarSiglas}=require('../lib/generacion/siglasSinDesarrollar');
const {analizarCita}=require('../lib/generacion/citaTruncada');
const norm=t=>t.replace(/[«»""'']/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
(async()=>{
  const Q=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
  const c=makeClient(); await c.connect();
  // Soporta lotes MULTI-LEY: cada pregunta puede traer su propio `law_slug`
  // (igual que insertar-batch-generado.cjs). La clave del mapa es "slug#art".
  const slugs=[...new Set(Q.map(q=>q.law_slug||process.argv[3]).filter(Boolean))];
  const arts=(await c.query(`SELECT l.slug, a.article_number n, a.content FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.slug = ANY($1) AND a.is_active`,[slugs])).rows;
  const byN=Object.fromEntries(arts.map(a=>[a.slug+'#'+a.n,a.content]));
  let fail=0; const pos={};
  Q.forEach((q,i)=>{
    const errs=[];
    const content=byN[(q.law_slug||process.argv[3])+'#'+q.primary_article_number];
    if(!content){errs.push('artículo no encontrado')}
    else{
      const opts=q.options, correcta=opts[q.correct_option];
      const intruso=analizarIntruso(q.question_text);
      const lit=intruso?{estado:'LITERAL'}:analizarLiteralidad(content,correcta);
      if(lit.estado==='NO_LITERAL') errs.push('NO_LITERAL'+(lit.fragmentosNoHallados?' ['+lit.fragmentosNoHallados.join(' / ').slice(0,80)+']':''));
      else{
        const cita=analizarCita(content,correcta);
        if(cita.estado==='TRUNCADA') errs.push(`CITA TRUNCADA (${cita.lado}): ${cita.cola}`);
        if(lit.estado!=='LITERAL') console.log(`  ⚠️ Q${i+1} art.${q.primary_article_number}: ${lit.estado}`);
      }
      const tl=analizarLongitud(opts,q.correct_option); if(tl.tell) errs.push('LONGITUD: '+tl.motivo);
      if(new Set(opts.map(norm)).size!==4) errs.push('opciones duplicadas');
      const letra='ABCD'[q.correct_option];
      const cab=analizarCabecera(q.explanation,q.correct_option); if(!cab.ok) errs.push('cabecera: '+cab.motivo);
      for(const L of 'ABCD') if(L!==letra&&!q.explanation.includes(`**${L})**`)) errs.push('falta bullet '+L);
      const sig=analizarSiglas(q.question_text,q.explanation,opts);
      if(sig.faltan.length) errs.push('SIGLA SIN DESARROLLAR: '+sig.faltan.join(','));
      if(sig.candidatas.length) console.log(`  ⚠️ Q${i+1}: candidata sigla ${sig.candidatas.join(',')}`);
      console.log(`  Q${i+1} ${(q.law_slug||'')} art.${q.primary_article_number} lens=[${opts.map(o=>o.length).join(',')}] correcta=${letra}(${correcta.length})`);
    }
    pos[q.correct_option]=(pos[q.correct_option]||0)+1;
    if(errs.length){fail++;console.log(`  ❌ Q${i+1} art.${q.primary_article_number}: ${errs.join(' | ')}`)}
  });
  console.log(`\n${Q.length-fail}/${Q.length} OK · ${fail} con fallos`);
  console.log('distribución: '+[0,1,2,3].map(k=>`${'ABCD'[k]}=${pos[k]||0}`).join(' '));
  console.log('secuencia: '+Q.map(q=>'ABCD'[q.correct_option]).join(','));
  await c.end(); if(fail) process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
