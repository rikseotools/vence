#!/usr/bin/env node
/**
 * canary-landing-vs-bd.cjs — ¿lo que ve el opositor coincide con lo que dice la BD?
 *
 * POR QUÉ (16/07/2026, a petición de Manuel): todo el trabajo de verificar plazas contra documentos
 * no vale nada si la LANDING enseña otra cosa. Entre la vista y el opositor hay tres sitios donde el
 * número se puede perder: `landing_estadisticas` (texto libre), `resolveVars` (una variable que el
 * código no conozca se renderiza VACÍA) y la caché.
 *
 * Ya pasó todo eso el mismo día: tarjetas con cifras tecleadas que driftaron (537 donde el documento
 * decía 128), dos landings que quedaron SIN tarjetas al reescribirlas, y {plazasTotal} escrito en la
 * BD antes de desplegar el código que lo resuelve (habría salido en blanco).
 *
 * Compara la tarjeta de plazas contra `oposiciones_ssot`, resolviendo la variable igual que el
 * renderizador. ⚠️ Pide con ?cb= para forzar render fresco: la web cachea y un desfase de caché sería
 * un falso positivo.
 *
 * Uso:  node scripts/canary-landing-vs-bd.cjs
 */
require('dotenv').config({ path: '.env.local' });
const {Client}=require('pg');
const {normalizarEtiquetaBoletin, checkConvocatoriaLinks}=require('../lib/convocatoria/linkCoherence.cjs');
const fmt=n=>n==null?'—':String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
(async()=>{
const c=new Client({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}, statement_timeout:40000});
await c.connect();
const rows=(await c.query(`select slug, plazas_libres l, plazas_promocion_interna p, plazas_total t, temas_count tc, landing_estadisticas le, estado_proceso estado
  from oposiciones_ssot where is_active and jsonb_typeof(landing_estadisticas)='array'
    and landing_estadisticas::text like '%plazas%' order by plazas_total desc nulls last limit 40`)).rows;
let ok=0, mal=0, sin=0, botonMal=0, contradice=0;
for(const r of rows){
  const card=(r.le||[]).find(x=>/plaza|vacante/i.test(String(x.texto||'')));
  if(!card) continue;
  const esperado = String(card.numero)==='{plazasTotal}' ? fmt(r.t)
    : String(card.numero)==='{plazasLibres}' ? fmt(r.l)
    : String(card.numero)==='{plazasPromocion}' ? fmt(r.p)
    : String(card.numero);
  let html=''; try{ html=await fetch(`https://www.vence.es/${r.slug}?cb=${Date.now()}`).then(x=>x.text()) }catch{}
  const m=html.match(/<div class="text-[^"]*font-bold[^"]*"[^>]*>([^<]*)<\/div>/);
  const visto = m ? m[1].trim() : null;
  // CAPA EN VIVO del guardarraíl del botón oficial: no basta con que la BD sea coherente, hay que
  // ver que la PÁGINA RENDERIZADA no prometa un boletín y lleve a otro sitio (una caché
  // per-instancia sin purgar puede seguir sirviendo el enlace viejo — que es exactamente cómo se
  // queda un arreglo a medias). Se juzga con el MISMO núcleo puro que el sweep y el gate
  // (`checkConvocatoriaLinks`), sobre la etiqueta y el href REALES del HTML servido: así el canario
  // no puede opinar distinto que el detector, ni quedarse atrás cuando este mejore (T-134).
  // La etiqueta se lee ENTERA, mayúsculas y minúsculas. Con `[A-Z]{3,6}` se leía «BOC» de «BOCyL»
  // (Castilla y León) y el canario acusaba de incoherente a una landing PERFECTA: la etiqueta decía
  // BOC —que es Cantabria/Canarias— y el enlace iba a bocyl.jcyl.es. El dato en BD siempre estuvo
  // bien. Un canario que grita sobre lo correcto enseña a ignorar sus rojos, que es peor que no
  // tenerlo; `normalizarEtiquetaBoletin` ya se encarga de mayusculizar lo que lea. 28/07.
  const boton = html.match(/Ver (?:convocatoria|OEP) en ([A-Za-zÁÉÍÓÚáéíóú]{3,6})/);
  if (boton) {
    const etiquetaVista = normalizarEtiquetaBoletin(boton[1]);
    const hrefBoton = (html.match(/href="(https?:\/\/[^"]+)"[^>]*>(?:(?!<\/a>).)*?Ver (?:convocatoria|OEP) en /s) || [])[1];
    const issues = checkConvocatoriaLinks({
      diarioOficial: etiquetaVista, programaUrl: hrefBoton, estadoProceso: r.estado,
    }).filter((i) => i.severidad === 'error');
    if (issues.length) {
      botonMal++;
      for (const i of issues) console.log(`  ❌ ${r.slug.padEnd(38)} botón oficial: ${i.detalle}`);
    }
  }
  // CAPA 3 — la página contra SÍ MISMA: el hero y la FAQ del JSON-LD tienen que contar las mismas
  // plazas. Nadie las comparaba, y por ahí se coló el defecto del 28/07: el hero pasó a decir «425
  // plazas de acceso libre, de las cuales 43 están reservadas…» (correcto) mientras el JSON-LD que
  // se lleva Google seguía con la plantilla guardada «425 plazas de acceso libre (43 reservadas…)»,
  // que invita a sumar 468. Dos superficies de la misma página dando distinta cifra es exactamente
  // el defecto que este proyecto ya pagó en T-142; la diferencia es que esta vez la equivocada era
  // la que leen los buscadores, que es la que no mira nadie.
  const heroM = html.match(/Oposición con <strong>([\d.]+) plazas de acceso libre<\/strong>([^<]*)/);
  const faqM = html.match(/Se convocan ([\d.]+) plazas de acceso libre([^"<]*)/);
  if (heroM && faqM) {
    const heroTxt = (heroM[1] + heroM[2]).replace(/\s+/g, ' ').trim();
    const faqTxt = (faqM[1] + faqM[2]).replace(/\s+/g, ' ').trim();
    // Se compara la CIFRA y la RELACIÓN («de las cuales» = dentro · «y otras/más» = aparte), no la
    // redacción entera: la FAQ puede seguir con más frases y eso es legítimo.
    const rel = (t) => (/de las cuales/i.test(t) ? 'dentro' : /y otr[ao]s?\b|\bmás\b/i.test(t) ? 'aparte' : 'sin_relacion');
    const cifra = (t) => (t.match(/^([\d.]+)/) || [])[1];
    if (cifra(heroTxt) !== cifra(faqTxt) || rel(heroTxt) !== rel(faqTxt)) {
      contradice++;
      console.log(`  ❌ ${r.slug.padEnd(38)} hero y JSON-LD se contradicen`);
      console.log(`       hero → ${heroTxt.slice(0, 90)}`);
      console.log(`       faq  → ${faqTxt.slice(0, 90)}`);
    }
  }
  // Una variable sin dato imprime «—»: en una tarjeta significa «no consta», pero dentro de una
  // frase es texto roto publicado («…y — de promoción interna», canarias, visto el 28/07).
  if (faqM && /—/.test(faqM[2])) {
    contradice++;
    console.log(`  ❌ ${r.slug.padEnd(38)} frase con variable sin dato: «${(faqM[1] + faqM[2]).slice(0, 80)}»`);
  }
  if(!visto){ sin++; console.log(`  ⚠️  ${r.slug.padEnd(38)} sin tarjeta en la web`); continue }
  if(visto===esperado){ ok++; }
  else { mal++; console.log(`  ❌ ${r.slug.padEnd(38)} BD dice "${esperado}" · la web enseña "${visto}"   [${card.numero}]`); }
}
console.log(`\n═══ ${ok} coinciden · ${mal} NO coinciden · ${sin} sin tarjeta · ${botonMal} botón oficial incoherente · ${contradice} página contra sí misma`);
if (mal > 0 || sin > 0 || botonMal > 0 || contradice > 0) process.exitCode = 1;
await c.end();
})().catch(e=>console.error('ERR',e.message||e));
