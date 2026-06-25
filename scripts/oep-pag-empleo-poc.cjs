#!/usr/bin/env node
/**
 * PoC read-only — Sensor "PAG empleo" (administracion.gob.es) + diff opositatest
 * ----------------------------------------------------------------------------
 * Cierra el agujero del radar OEP: detect-boletines solo lee BOCYL+BOE (2 de ~19
 * boletines). El Buscador del Punto de Acceso General es un AGREGADOR NACIONAL
 * (estado + autonómico + LOCAL) con filtro nativo de "Plazo Abierto" y grupo C1/C2.
 *
 * Esto NO toca producción: solo consulta fuentes públicas, cruza con el catálogo
 * (oposiciones) y lista las convocatorias de plazo abierto + cuáles parecen NUEVAS.
 *
 * Uso:
 *   node scripts/oep-pag-empleo-poc.cjs                 # C1 (idGrupo=4) + C2 (=5), plazo abierto
 *   node scripts/oep-pag-empleo-poc.cjs --grupo=4       # solo C1
 *   node scripts/oep-pag-empleo-poc.cjs --plazo=3       # últimas 72h (modo cron incremental)
 *   node scripts/oep-pag-empleo-poc.cjs --opositatest   # además, snapshot/diff de opositatest
 *
 * API descubierta (reverse-engineering 25/06/2026):
 *   POST https://administracion.gob.es/pagFront/empleoBecas/empleo/buscadorEmpleoAvanzado.htm
 *   idGrupo: 4=C1 5=C2 0=todos | idPlazo: 1=abierto 3=últimas72h 2=cerrado
 *   tipoVista=Avanzado (hidden) | busquedaRealizada=true
 *   GOTCHA: enviar fechaPublicacion(Desde/Hasta) o tipoVista=0 vacíos => HTTP 400. Solo selects con valor.
 *   Paginación: numPaginaActual + paginador=true. Cada <li> trae jsonDetalle estructurado.
 */

const fs = require('fs')
const path = require('path')

// ── carga .env.local (node no lo hace solo en scripts) ──
;(() => {
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch { /* opcional */ }
})()

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const PAG_BASE = 'https://administracion.gob.es/pagFront/empleoBecas/empleo'
const ADV_URL = `${PAG_BASE}/buscadorEmpleoAvanzado.htm`

const args = process.argv.slice(2)
const arg = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d }
const has = (k) => args.includes(`--${k}`)

const GRUPOS = { 4: 'C1', 5: 'C2' }
const CCAA = { '00': 'Nacional', '01': 'Andalucía', '02': 'Aragón', '03': 'Asturias', '04': 'Baleares',
  '05': 'Canarias', '06': 'Cantabria', '07': 'Castilla y León', '08': 'Castilla-La Mancha', '09': 'Cataluña',
  '10': 'C. Valenciana', '11': 'Extremadura', '12': 'Galicia', '13': 'Madrid', '14': 'Murcia',
  '15': 'Navarra', '16': 'País Vasco', '17': 'La Rioja', '18': 'Ceuta', '19': 'Melilla' }
const ADMIN = { '1': 'Estatal', '2': 'Autonómica', '3': 'Local', '4': 'Universidad', '5': 'Otra' }

function decode(s) {
  return s.replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á').replace(/&Eacute;/g, 'É').replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó').replace(/&Uacute;/g, 'Ú').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// jsonDetalle usa # en vez de comillas: #campo#:#valor#
function jdField(json, key) {
  const m = json.match(new RegExp(`#${key}#:#?([^#,}]*)#?`))
  return m ? m[1].trim() : ''
}

function parseItems(htmlBody) {
  const out = []
  const blocks = htmlBody.split('<li class="ppg-table__list--type02').slice(1)
  for (const raw of blocks) {
    const block = raw.slice(0, 6000)
    const field = (label) => {
      const m = block.match(new RegExp(`${label}\\s*</h4>\\s*<p[^>]*>([\\s\\S]*?)</p>`, 'i'))
      return m ? decode(m[1]) : ''
    }
    const h3 = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)
    const titulo = h3 ? decode(h3[1]) : ''
    const refM = titulo.match(/Ref\.?\s*(\d+)/i)
    const jd = (block.match(/name="jsonDetalle"\s+value="([^"]*)"/) || [])[1] || ''
    const plazoTxt = field('Plazo de presentaci[oó]n:')
    const fechaM = plazoTxt.match(/(\d{2}\/\d{2}\/\d{4})/)
    out.push({
      id: jdField(jd, 'idConvocatoria') || (refM ? refM[1] : ''),
      cuerpo: jdField(jd, 'desDenominacionCuerpo') || titulo.replace(/Ref\.?\s*\d+\s*\|?\s*/i, ''),
      grupo: GRUPOS[jdField(jd, 'idsGrupo')] || jdField(jd, 'idsGrupo'),
      organismo: field('[oÓ]rgano convocante:'),
      admin: ADMIN[jdField(jd, 'idsAdmiconvocante')] || '?',
      ccaa: CCAA[jdField(jd, 'idsCcaa')] || jdField(jd, 'idsCcaa'),
      plazas: field('Convocadas:') || jdField(jd, 'sDesde'),
      plazoHasta: fechaM ? fechaM[1] : plazoTxt,
      titulacion: field('Titulaci[oó]n:'),
    })
  }
  return out
}

function form(params) {
  // set completo de campos válidos (campos de fecha/numéricos vacíos => 400, ojo)
  const base = {
    tipoVista: 'Avanzado', busquedaRealizada: 'true', denominacion: '', referencia: '',
    idGeografica: '0', idAmbCAutonoma: '0', idAmbProvincia: '0', idConvocante: '0',
    tipoPlazaPublicacion: '0', idVia: '2', idSeleccion: '0', idGrupo: '0', idPlazo: '5',
    ...params,
  }
  return new URLSearchParams(base).toString()
}

async function fetchPage(grupo, plazo, pagina) {
  const params = { idGrupo: String(grupo), idPlazo: String(plazo) }
  if (pagina > 1) { params.numPaginaActual = String(pagina); params.paginador = 'true' }
  const res = await fetch(ADV_URL, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': `${PAG_BASE}/buscadorEmpleoAvanzado.htm`,
    },
    body: form(params),
  })
  const html = await res.text()
  if (res.status !== 200) return { status: res.status, items: [], totalPaginas: 0, total: 0 }
  const meta = html.match(/#numPaginasTotales#:(\d+),#numRegistrosMostrar#:\d+,#elementoInicialPaginacion#:\d+,#elementoFinalPaginacion#:\d+,#numRegistrosTotales#:(\d+)/)
  return {
    status: 200,
    items: parseItems(html),
    totalPaginas: meta ? parseInt(meta[1]) : 1,
    total: meta ? parseInt(meta[2]) : null,
  }
}

async function fetchGrupo(grupo, plazo) {
  const first = await fetchPage(grupo, plazo, 1)
  if (first.status !== 200) { console.error(`  ⚠️ grupo ${grupo}: HTTP ${first.status}`); return [] }
  let all = [...first.items]
  for (let p = 2; p <= first.totalPaginas; p++) {
    const pg = await fetchPage(grupo, plazo, p)
    all = all.concat(pg.items)
  }
  console.log(`  ${GRUPOS[grupo] || grupo}: ${first.total ?? all.length} convocatorias (${first.totalPaginas} pág.)`)
  return all
}

// ── cruce con catálogo ──
function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() }

async function loadCatalog() {
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) { console.error('⚠️ sin credenciales Supabase, salto cruce'); return [] }
  const s = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await s.from('oposiciones').select('slug, nombre, administracion, plazas_libres, estado_proceso')
  return (data || []).map(o => ({ ...o, _n: norm(`${o.nombre} ${o.slug}`) }))
}

// ¿el catálogo cubre este organismo? heurística por solapamiento de tokens del organismo
function coveredBy(catalog, organismo) {
  const tks = norm(organismo).split(' ').filter(t => t.length > 3 &&
    !['ayuntamiento', 'universidad', 'diputacion', 'cabildo', 'consorcio', 'gobierno', 'junta'].includes(t))
  if (!tks.length) return null
  return catalog.find(o => tks.every(t => o._n.includes(t))) || null
}

async function runPag() {
  const plazo = parseInt(arg('plazo', '1'))
  const grupos = arg('grupo') ? [parseInt(arg('grupo'))] : [4, 5]
  const plazoTxt = { 1: 'Plazo Abierto', 3: 'Últimas 72h', 2: 'Plazo Cerrado', 5: 'Todas' }[plazo] || plazo
  console.log(`\n🔎 PAG administracion.gob.es — ${plazoTxt} — grupos ${grupos.map(g => GRUPOS[g]).join('+')}\n`)

  let items = []
  for (const g of grupos) items = items.concat(await fetchGrupo(g, plazo))

  const catalog = await loadCatalog()
  console.log(`\n📊 ${items.length} convocatorias | catálogo: ${catalog.length} oposiciones\n`)

  const nuevas = []
  console.log('Nº  GRP  ÁMBITO     CCAA              ÓRGANO CONVOCANTE                  PLZ   PLAZO       CUERPO')
  console.log('─'.repeat(132))
  items.sort((a, b) => (b.admin === 'Local') - (a.admin === 'Local'))
  items.forEach((it, i) => {
    const hit = coveredBy(catalog, it.organismo)
    if (!hit) nuevas.push(it)
    const flag = hit ? '   ' : ' 🆕'
    console.log(
      `${String(i + 1).padStart(2)}${flag} ${(it.grupo || '').padEnd(3)} ${(it.admin || '').padEnd(10)} ` +
      `${(it.ccaa || '').padEnd(17)} ${(it.organismo || '').slice(0, 33).padEnd(34)} ` +
      `${String(it.plazas || '').padStart(4)}  ${(it.plazoHasta || '').padEnd(11)} ${(it.cuerpo || '').slice(0, 28)}`
    )
  })

  console.log(`\n🆕 CANDIDATAS sin match obvio en catálogo: ${nuevas.length}/${items.length}`)
  for (const n of nuevas) {
    console.log(`   · [${n.grupo}|${n.admin}|${n.ccaa}] ${n.organismo} — ${n.cuerpo} (${n.plazas} plz, hasta ${n.plazoHasta}) [PAG id ${n.id}]`)
  }

  // snapshot para futuro diff (lo que sería dedup key del cron)
  const out = path.join('/tmp', `pag_empleo_${plazo}_${grupos.join('-')}.json`)
  fs.writeFileSync(out, JSON.stringify(items, null, 2))
  console.log(`\n💾 snapshot: ${out} (dedup key sería pag:<id>)`)
  return items
}

// ── opositatest: descubrir RUNWAY (OEP aprobada sin convocatoria) + validar estados ──
// Es competidor y SSR sin API JSON: scrapeo de HTML (web components Stencil). Lo valioso
// es que publican MUY pronto el "Pendientes de convocar" (OEP aprobada, aún sin convocatoria)
// = oposición vendible (runway) antes de que salga en boletines. Cf. feedback_runway_examen_vendible.
async function runOpositatest() {
  console.log('\n📅 opositatest.com/calendario — descubrir RUNWAY (OEP aprobada sin convocatoria) + validar estados\n')
  const cuerpos = ['administracion-general', 'administracion-justicia', 'corporaciones-locales',
    'comunidades-autonomas', 'hacienda', 'ministerio-interior', 'fuerzas-cuerpos-seguridad',
    'correos', 'sanidad', 'educacion']
  const catalog = await loadCatalog()
  const snapshot = {}
  const runway = []
  for (const c of cuerpos) {
    try {
      const res = await fetch(`https://www.opositatest.com/calendario/${c}`, { headers: { 'User-Agent': UA } })
      const html = await res.text()
      // por cada oposición listada, ventana de contexto para leer su estado
      const seen = new Set()
      const entries = []
      for (const m of html.matchAll(/href="\/oposiciones\/([a-z0-9\-]+)"/g)) {
        const slug = m[1]
        if (seen.has(slug)) continue
        seen.add(slug)
        const ctx = html.slice(m.index, m.index + 2500)
        const pendiente = /Pendientes? de convocar|pendiente de (?:su )?convocatoria|OEP[^.]{0,40}sin convocar/i.test(ctx)
        const boe = [...new Set((ctx.match(/BOE-A-20\d\d-\d+/g) || []))].slice(0, 2)
        const oep = (ctx.match(/OEPs?\s*([\d,\s]+)/) || [])[1]?.trim()
        const e = { slug, pendiente, oep, boe }
        entries.push(e)
        if (pendiente) {
          const inCat = catalog.find(o => o._n.includes(norm(slug).split(' ')[0]) || norm(slug).includes(norm(o.slug).split(' ')[0]))
          runway.push({ ...e, cuerpo: c, enCatalogo: !!inCat, estadoNuestro: inCat?.estado_proceso })
        }
      }
      snapshot[c] = entries
      console.log(`  ${c}: ${entries.length} oposiciones, ${entries.filter(e => e.pendiente).length} con OEP pendiente de convocar`)
    } catch (e) { console.log(`  ${c}: error ${e.message}`) }
  }

  console.log(`\n🛫 RUNWAY — OEP aprobada sin convocatoria (vendible YA, antes de boletines): ${runway.length}`)
  for (const r of runway) {
    const tag = r.enCatalogo ? `EN CATÁLOGO (estado: ${r.estadoNuestro || '?'})` : '🆕 NO en catálogo'
    console.log(`   · [${r.cuerpo}] ${r.slug} — OEP ${r.oep || '?'} ${r.boe.length ? '· ' + r.boe.join(',') : ''} → ${tag}`)
  }

  // diff temporal: qué AÑADIERON desde la última ejecución (señal de novedad temprana)
  const out = path.join('/tmp', 'opositatest_snapshot.json')
  let prev = null
  try { prev = JSON.parse(fs.readFileSync(out, 'utf8')) } catch {}
  if (prev) {
    console.log('\n🔄 Novedades vs snapshot anterior:')
    let any = false
    for (const c of Object.keys(snapshot)) {
      const prevSlugs = new Set((prev[c] || []).map(e => e.slug))
      for (const e of snapshot[c]) if (!prevSlugs.has(e.slug)) { console.log(`   + [${c}] ${e.slug}${e.pendiente ? ' (pendiente de convocar)' : ''}`); any = true }
    }
    if (!any) console.log('   (sin novedades)')
  } else {
    console.log('\n(primera ejecución: snapshot base guardado; relanza para ver el diff temporal)')
  }
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2))
  console.log(`\n💾 snapshot: ${out}`)
}

;(async () => {
  await runPag()
  if (has('opositatest')) await runOpositatest()
})().catch(e => { console.error('ERR', e); process.exit(1) })
