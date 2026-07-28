#!/usr/bin/env npx tsx
/**
 * SIMULADOR de la frase de plazas de la landing — [T-214].
 *
 * Corre la frase VIEJA y la NUEVA sobre TODAS las convocatorias vivas y las compara una a una, con
 * el dato real de `plazas_discapacidad_incluidas`. Importa el núcleo de verdad
 * (`lib/convocatoria/reservaDiscapacidad.ts`), no una copia: si alguien cambia la regla, esta
 * simulación cambia con ella.
 *
 * Por qué hace falta: el cambio toca la primera frase de ~120 landings publicadas, y la cifra de
 * plazas es lo primero que mira un opositor para decidir si se presenta. Un cambio así no se
 * despliega a ciegas — se mira antes, landing por landing.
 *
 *   npx tsx scripts/convocatoria/sim-frase-plazas.ts [--todas]
 */
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import { fraseReserva, relacionReserva } from '../../lib/convocatoria/reservaDiscapacidad'

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** La frase tal como se publica HOY: siempre dos oraciones, siempre legibles como suma. */
function fraseVieja(libres: number, disc: number | null): string {
  return `Oposición con ${fmt(libres)} plazas de acceso libre.` +
    (disc != null && disc > 0 ? ` ${fmt(disc)} reservadas para discapacidad.` : '')
}

/** La frase nueva: el conector sale del dato, y si no consta no se afirma la relación. */
function fraseNueva(libres: number, disc: number | null, incluidas: boolean | null): string {
  const c = fraseReserva(disc, incluidas, fmt)
  return `Oposición con ${fmt(libres)} plazas de acceso libre` + (c ?? '.')
}

async function main() {
  const todas = process.argv.includes('--todas')
  const env = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8')
  const url = env.match(/^DATABASE_URL=(.*)$/m)![1].trim()
    .replace(/^["']|["']$/g, '').replace(/[?&]sslmode=[a-z-]+/, '')
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 })
  await db.connect()
  const { rows } = await db.query(
    `select o.slug, cv.plazas_libres lib, cv.plazas_discapacidad disc, cv.plazas_discapacidad_incluidas incl
       from convocatorias cv join oposiciones o on o.id = cv.oposicion_id
      where cv.is_current and o.is_active and cv.plazas_libres is not null
      order by cv.plazas_libres desc`)
  await db.end()

  const grupos: Record<string, Array<{ slug: string; vieja: string; nueva: string }>> = {
    'IGUAL (sin cupo de discapacidad)': [],
    'DESAMBIGUADA — el cupo va DENTRO (antes se leía inflada)': [],
    'DESAMBIGUADA — el cupo va APARTE (antes ambigua, ahora explícita)': [],
    'RESERVA OCULTADA — la relación no consta (hay que verificarla)': [],
  }

  for (const r of rows) {
    const vieja = fraseVieja(r.lib, r.disc)
    const nueva = fraseNueva(r.lib, r.disc, r.incl)
    const rel = relacionReserva(r.incl)
    const tieneCupo = r.disc != null && r.disc > 0
    const k = !tieneCupo
      ? 'IGUAL (sin cupo de discapacidad)'
      : rel === 'dentro'
        ? 'DESAMBIGUADA — el cupo va DENTRO (antes se leía inflada)'
        : rel === 'aparte'
          ? 'DESAMBIGUADA — el cupo va APARTE (antes ambigua, ahora explícita)'
          : 'RESERVA OCULTADA — la relación no consta (hay que verificarla)'
    grupos[k].push({ slug: r.slug, vieja, nueva })
  }

  console.log(`\n=== Frase de plazas: vieja vs nueva · ${rows.length} landings vivas ===\n`)
  for (const [k, v] of Object.entries(grupos)) {
    console.log(`${String(v.length).padStart(4)}  ${k}`)
  }

  // Comprobación dura: ninguna landing puede perder la cifra de plazas libres.
  const perdidas = rows.filter((r) => !fraseNueva(r.lib, r.disc, r.incl).includes(fmt(r.lib)))
  console.log(`\n⛔ landings que perderían la cifra de plazas libres: ${perdidas.length} (debe ser 0)`)

  for (const [k, v] of Object.entries(grupos)) {
    if (!v.length || k.startsWith('IGUAL')) continue
    console.log(`\n── ${k} ──`)
    for (const x of (todas ? v : v.slice(0, 4))) {
      console.log(`\n · ${x.slug}`)
      console.log(`   ANTES: ${x.vieja}`)
      console.log(`   AHORA: ${x.nueva}`)
    }
    if (!todas && v.length > 4) console.log(`\n   … y ${v.length - 4} más (--todas para verlas)`)
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
