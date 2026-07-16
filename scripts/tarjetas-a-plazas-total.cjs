#!/usr/bin/env node
/**
 * tarjetas-a-plazas-total.cjs — pasa las tarjetas de plazas de cifra TECLEADA a {plazasTotal}.
 *
 * POR QUÉ EXISTE (16/07/2026): una auditoría adversarial cazó que las tarjetas se habían "arreglado"
 * escribiendo el número correcto a mano (537→128, 129→212, 425→328). Eso es exactamente lo que el
 * cambio decía negarse a hacer: arregla UNA tarjeta y deja intacta la máquina de mentir. Y es peor
 * que evidente, porque el número tecleado coincide HOY con plazas_total → el auditor se queda VERDE
 * sobre datos que driftarán en cuanto la convocatoria cambie.
 *
 * Se tecleó a propósito y por seguridad: el código que resuelve {plazasTotal} no estaba desplegado, y
 * `resolveVars` devuelve '' para una variable desconocida → la tarjeta habría salido EN BLANCO en
 * producción al expirar la caché. Escribir la mitad del incremento (BD) sin la otra (código) es el
 * fallo; las cifras literales correctas son el estado seguro MIENTRAS TANTO.
 *
 * ⚠️ ORDEN OBLIGATORIO: este script se corre DESPUÉS de desplegar el frontend que trae {plazasTotal}
 * (vista → lib/api/convocatoria/queries.ts → varsMap en app/[oposicion]/page.tsx). Antes, no: dejaría
 * las tarjetas en blanco. Por eso comprueba el deploy vivo y ABORTA si el código no está.
 *
 * Uso:  node scripts/tarjetas-a-plazas-total.cjs            (simula, no escribe)
 *       node scripts/tarjetas-a-plazas-total.cjs --apply
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const APPLY = process.argv.includes('--apply')

// Las 3 arregladas contra su documento del corpus. El literal actual DEBE coincidir con plazas_total
// (si no, alguien tocó el dato y hay que mirarlo a mano, no pisarlo).
const OBJETIVO = {
  'celador-sescam-clm': 128,      // DOCM-240-2025-9540: 115 + 4 + 9
  'administrativo-madrid': 212,   // BOCM-20260714-6: 107 + 105 (7 y 11 de discapacidad DENTRO)
  'tcae-aragon': 328,             // Decreto 12/2026 (BOA nº 22): 196 libre, 328 totales
}

/** Commit que cableó {plazasTotal} (vista → queries.ts → varsMap). Sin él desplegado, la variable
 *  no se resuelve y la tarjeta sale vacía. */
const COMMIT_PLAZAS_TOTAL = 'f5a15f54'

/**
 * ¿Corre en producción código que sepa resolver {plazasTotal}?
 *
 * ⚠️ La 1ª versión miraba si la web imprimía "{plazasTotal}" literal. Era TEATRO: antes del cambio la
 * tarjeta lleva la cifra tecleada, así que la variable no aparece por ningún lado y el check pasaba
 * siempre — justo cuando más peligroso es. El método bueno es el del runbook de despliegue: el commit
 * vivo en /api/health + `git merge-base --is-ancestor`.
 */
async function codigoDesplegado() {
  const { execSync } = require('child_process')
  const health = await fetch('https://www.vence.es/api/health').then((r) => r.json()).catch(() => null)
  const vivo = health?.deploy
  if (!vivo) return { ok: false, motivo: 'no se pudo leer el commit vivo de /api/health' }
  try {
    execSync(`git merge-base --is-ancestor ${COMMIT_PLAZAS_TOTAL} ${vivo}`, { stdio: 'ignore' })
    return { ok: true, vivo }
  } catch {
    return { ok: false, motivo: `el deploy vivo (${vivo}) NO incluye ${COMMIT_PLAZAS_TOTAL}`, vivo }
  }
}

async function main() {
  // Guardarraíl 1: sin el código desplegado, esto deja las tarjetas EN BLANCO en producción.
  const dep = await codigoDesplegado()
  if (!dep.ok) {
    console.error(`❌ ABORTO: ${dep.motivo}.`)
    console.error('   Despliega el frontend primero (scripts/deploy-frontend.sh); si no, {plazasTotal}')
    console.error('   no se resuelve y la tarjeta sale VACÍA para el usuario.')
    process.exit(1)
  }
  console.log(`✓ deploy vivo ${dep.vivo} incluye ${COMMIT_PLAZAS_TOTAL} → la variable se resolverá\n`)

  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  for (const [slug, esperado] of Object.entries(OBJETIVO)) {
    const r = (await c.query(
      `SELECT o.id oid, cv.id cid, cv.landing_estadisticas le, v.plazas_total total
         FROM oposiciones o
         JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
         JOIN oposiciones_ssot v ON v.id = o.id
        WHERE o.slug = $1`, [slug])).rows[0]
    if (!r) { console.log(`⚠️  ${slug}: sin convocatoria vigente`); continue }

    // Guardarraíl 2: la vista debe decir lo que el documento dice. Si no, NO tocar.
    if (Number(r.total) !== esperado) {
      console.log(`❌ ${slug}: plazas_total=${r.total} y el documento dice ${esperado} → NO se toca, revisar a mano`)
      continue
    }
    const cards = (r.le || []).map((t) =>
      String(t.numero).replace(/\./g, '') === String(esperado) ? { ...t, numero: '{plazasTotal}' } : t)
    const cambia = JSON.stringify(cards) !== JSON.stringify(r.le)
    if (!cambia) { console.log(`✅ ${slug}: ya usa {plazasTotal}`); continue }

    if (APPLY) {
      // La copia LEGACY de `oposiciones` es el fallback de la vista: si se deja con la cifra
      // tecleada, la mentira revive en cuanto la convocatoria vigente cambie o se archive.
      await c.query(`UPDATE convocatorias SET landing_estadisticas=$2::jsonb, updated_at=now() WHERE id=$1`, [r.cid, JSON.stringify(cards)])
      await c.query(`UPDATE oposiciones SET landing_estadisticas=$2::jsonb WHERE id=$1`, [r.oid, JSON.stringify(cards)])
    }
    console.log(`${APPLY ? '✅ aplicado' : '· simulado'} ${slug}: ${esperado} → {plazasTotal} (resuelve a ${r.total})`)
  }
  await c.end()
  if (!APPLY) console.log('\n(simulación — usa --apply para escribir)')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
