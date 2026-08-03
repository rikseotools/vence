#!/usr/bin/env node
/**
 * Corrige una ERRATA en el texto de una opción, y deja rastro.
 *
 * Hermano de `corregir-enunciado.cjs`. Hacía falta porque la re-verificación encuentra erratas
 * visibles al usuario que NO están en el enunciado sino en las opciones («Del Presiente del
 * Gobierno», «Si, en el artículo 119» sin tilde), y sin herramienta la alternativa era un UPDATE a
 * pelo que no deja constancia de que alguien lo miró.
 *
 * DELIBERADAMENTE limitado a erratas: exige que el cambio NO altere el texto más allá de la
 * ortografía, así que aborta si la longitud varía en más de 3 caracteres. Cambiar el CONTENIDO de
 * una opción es otra cosa —toca a la clave y a la resolubilidad— y no se hace desde aquí.
 *
 *   node --env-file=.env.local scripts/explicaciones/corregir-opcion.cjs <question_id> <a|b|c|d|e> <fichero.txt> "<motivo>" [--apply]
 */
const fs = require('fs')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')

const LETRAS = ['a', 'b', 'c', 'd', 'e']

async function main() {
  const [id, letra, ficheroTexto, motivo] = process.argv.slice(2)
  const aplicar = process.argv.includes('--apply')
  if (!id || !LETRAS.includes(letra) || !ficheroTexto || !motivo) {
    console.error('uso: corregir-opcion.cjs <question_id> <a|b|c|d|e> <fichero.txt> "<motivo>" [--apply]')
    process.exit(2)
  }
  const col = `option_${letra}`
  const nuevo = fs.readFileSync(ficheroTexto, 'utf8').replace(/\n$/, '')
  const c = new Client(pgConfig())
  await c.connect()
  try {
    const { rows } = await c.query(`SELECT id, ${col} AS actual FROM questions WHERE id = $1`, [id])
    if (!rows.length) throw new Error('no existe esa pregunta')
    const anterior = rows[0].actual
    if (anterior == null) throw new Error(`la opción ${letra.toUpperCase()} está vacía`)
    console.log(`ANTES  (${letra.toUpperCase()}):`, JSON.stringify(anterior))
    console.log(`DESPUÉS(${letra.toUpperCase()}):`, JSON.stringify(nuevo))
    if (anterior === nuevo) { console.log('· sin cambios, no se escribe'); return }
    // El margen de 3 caracteres separa la errata del cambio de contenido. Pero hay erratas
    // legítimas que lo exceden: una palabra descolocada que deja la frase agramatical («Se deberá
    // enviar un aviso PERSONA dirección de correo postal…», en dos opciones de `52bd9e10`). Para
    // esas hay salida explícita, no un umbral más laxo: `--forzar` deja el guardarraíl protegiendo
    // por defecto y obliga a que la excepción quede REGISTRADA en el evento, que es lo que permite
    // revisarla después.
    const forzado = process.argv.includes('--forzar')
    if (Math.abs(anterior.length - nuevo.length) > 3 && !forzado) {
      throw new Error('el cambio excede el margen de una errata; si de verdad lo es, repítelo con --forzar y explícalo en el motivo (queda registrado)')
    }
    if (!aplicar) { console.log('\n(dry-run: añade --apply para escribir)'); return }

    await c.query('BEGIN')
    await c.query(`UPDATE questions SET ${col} = $2 WHERE id = $1`, [id, nuevo])
    await c.query(
      `INSERT INTO observable_events (source, severity, event_type, metadata)
       VALUES ('scripts/t409', 'info', 'opcion_errata_corregida', $1::jsonb)`,
      [JSON.stringify({ questionId: id, opcion: letra.toUpperCase(), motivo, anterior, nuevo, forzado, tarea: "T-409" })],
    )
    await c.query('COMMIT')
    console.log('\n✅ errata corregida y evento emitido')
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
