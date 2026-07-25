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
const {canonicalizeBoletinUrl}=require('../lib/convocatoria/canonicalizeBoletinUrl.cjs');
const {normalizarEtiquetaBoletin}=require('../lib/convocatoria/linkCoherence.cjs');
const fmt=n=>n==null?'—':String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
(async()=>{
const c=new Client({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}, statement_timeout:40000});
await c.connect();
const rows=(await c.query(`select slug, plazas_libres l, plazas_promocion_interna p, plazas_total t, temas_count tc, landing_estadisticas le
  from oposiciones_ssot where is_active and jsonb_typeof(landing_estadisticas)='array'
    and landing_estadisticas::text like '%plazas%' order by plazas_total desc nulls last limit 40`)).rows;
let ok=0, mal=0, sin=0, botonMal=0;
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
  // CAPA EN VIVO del guardarraíl etiqueta↔enlace: no basta con que la BD sea coherente,
  // hay que ver que la PÁGINA RENDERIZADA no prometa un boletín y lleve a otro (una caché
  // per-instancia sin purgar puede seguir sirviendo la etiqueta vieja). Núcleo puro
  // compartido con el sweep: lib/convocatoria/linkCoherence.cjs.
  const boton = html.match(/Ver (?:convocatoria|OEP) en ([A-ZÁÉÍÓÚ]{3,6})/);
  if (boton) {
    const etiquetaVista = normalizarEtiquetaBoletin(boton[1]);
    const hrefBoton = (html.match(/href="(https?:\/\/[^"]+)"[^>]*>(?:(?!<\/a>).)*?Ver (?:convocatoria|OEP) en /s) || [])[1];
    const { boletin, recognized } = hrefBoton ? canonicalizeBoletinUrl(hrefBoton) : { boletin: null, recognized: false };
    if (etiquetaVista && recognized && boletin && boletin !== etiquetaVista) {
      botonMal++;
      console.log(`  ❌ ${r.slug.padEnd(38)} el botón dice "${etiquetaVista}" y enlaza al ${boletin}`);
    }
  }
  if(!visto){ sin++; console.log(`  ⚠️  ${r.slug.padEnd(38)} sin tarjeta en la web`); continue }
  if(visto===esperado){ ok++; }
  else { mal++; console.log(`  ❌ ${r.slug.padEnd(38)} BD dice "${esperado}" · la web enseña "${visto}"   [${card.numero}]`); }
}
console.log(`\n═══ ${ok} coinciden · ${mal} NO coinciden · ${sin} sin tarjeta · ${botonMal} botón oficial incoherente`);
if (mal > 0 || sin > 0 || botonMal > 0) process.exitCode = 1;
await c.end();
})().catch(e=>console.error('ERR',e.message||e));
