#!/usr/bin/env npx tsx
/**
 * cerrar.ts — cierra UNA impugnación por el camino que exige el manual: el endpoint
 * `/api/v2/dispute/resolve` de producción, nunca un UPDATE directo.
 *
 * ## Por qué existe
 *
 * El manual (§6, §15) es tajante: cerrar con `UPDATE question_disputes` **no manda el email**
 * (el trigger que lo hacía se eliminó el 14/04/2026 porque fallaba en silencio), no concede el
 * euro de recompensa (§6.bis) y se salta la puerta de barajado (§0). Es decir, la impugnación
 * queda «cerrada» y el usuario no se entera de nada.
 *
 * Pero llamar al endpoint necesita un access token de admin, y hasta ahora eso se resolvía
 * improvisando un script suelto en cada sesión. Improvisar el camino de escritura es justo lo
 * que el registro de herramientas existe para evitar, así que queda aquí, con su firma estable.
 *
 * La identidad se acuña con el mismo `lib/sim/session` que usa la simulación: cookie de sesión
 * Auth.js → `/api/auth/token` → Bearer. El admin sale de `DISPUTE_ADMIN_EMAIL` (por defecto
 * manueltrader@gmail.com: es el que está en la whitelist del guard, no cualquier admin sirve).
 *
 * La impugnación puede vivir en dos tablas y el endpoint necesita saber en cuál. Eso NO se pide
 * ya por `--psicotecnica`: se mira en la BD, como hace el dossier. Ver `resolverTipo`.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/impugnaciones/cerrar.ts <dispute_id> \
 *     --estado resolved|rejected --mensaje <fichero.txt> [--psicotecnica] \
 *     [--sin-recompensa "<motivo>"] [--con-recompensa "<motivo>"] [--saltar-barajado "<motivo>"] [--aplicar]
 *
 *   Exige tener la impugnación RESERVADA (T-474): cerrar lo que no has cogido es lo que hace que
 *   dos sesiones acaben en el mismo caso. Si sigues el flujo del manual ya la tienes, porque
 *   `revisar-impugnacion.cjs` reserva al abrir el dossier. Escape: `--igualmente "<motivo>"`.
 *
 *   CORREGIR una respuesta YA enviada (T-394) — no re-resuelve, no toca el estado y no vuelve a
 *   evaluar la recompensa; solo le escribe de nuevo y deja traza:
 *     … --correccion "<qué se corrige y por qué>" --mensaje <fichero.txt> --aplicar
 *
 * Sin `--aplicar` enseña lo que enviaría y no toca nada.
 */
import { readFileSync } from 'fs'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extraerEnlacesBoe, anclaDe, articuloCitadoEnElTexto, extraerCitas, verificarDocumento } = require('../../lib/impugnaciones/verificarEnlaces.cjs')
const { validarVerdictoSistemico } = require('../../lib/impugnaciones/verdictoSistemico.cjs')
const { exigirPersona } = require('../../lib/sessions/aprobacion.cjs')
import { config } from 'dotenv'
import { tokenDeAdmin, ADMIN_POR_DEFECTO } from './lib/admin-token'
import { comprobarReserva, anunciar } from './lib/comprobar-reserva'
import { comprobarTemario, anunciarTemario } from './lib/puerta-temario'
import { comprobarEmbudo, anunciarEmbudo } from './lib/puerta-embudo'

config({ path: '.env.local' })

const BASE = process.env.DISPUTE_BASE_URL || 'https://www.vence.es'
const ADMIN = process.env.DISPUTE_ADMIN_EMAIL || ADMIN_POR_DEFECTO

/** Reparte argv. Puro y exportado para poder testearlo sin red ni BD. */
export function parsearArgs(argv: string[]) {
  const valor = (f: string) => {
    const i = argv.indexOf(f)
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
  }
  const posicionales = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')))
  return {
    disputeId: posicionales[0] || null,
    estado: valor('--estado'),
    mensajeFichero: valor('--mensaje'),
    psicotecnica: argv.includes('--psicotecnica'),
    sinRecompensa: valor('--sin-recompensa'),
    // Simétrico [T-388]: concede el euro a mano cuando el motivo es subjetivo (`otro`,
    // `explicacion_confusa`, `explicacion_mejorable`) y el caso lo merece. Exige MOTIVO por la
    // misma razón que el de arriba: un booleano no deja rastro de POR QUÉ sí se pagó.
    conRecompensa: valor('--con-recompensa'),
    saltarBarajado: valor('--saltar-barajado'),
    silencioso: process.argv.includes('--silencioso'),
    nota: valor('--nota'),
    correccion: valor('--correccion'),
    // Escape de la puerta de reserva (T-474). Exige motivo: un escape anónimo no se puede revisar
    // después, y lo que hay que poder ver es si la puerta se está rodeando por sistema.
    igualmente: valor('--igualmente'),
    // La pregunta que hay que hacerse en TODA impugnación, exigida en el cierre (T-520).
    sistemico: valor('--sistemico'),
    // Escape, con motivo y contado: un escape anónimo no se puede revisar después.
    sistemicoOmitido: valor('--sistemico-omitido'),
    // Escape de la puerta de TEMARIO (04/08/2026). Separado del de reserva a propósito: son dos
    // condiciones distintas y compartir el escape apagaría las dos de una vez.
    temarioIgualmente: valor('--temario-igualmente'),
    // Escape de la puerta del EMBUDO (T-609, 06/08/2026). Propio y separado de los otros dos por
    // el mismo motivo: compartir el escape apagaría las tres puertas a la vez.
    embudoIgualmente: valor('--embudo-igualmente'),
    aplicar: argv.includes('--aplicar'),
  }
}

export type TipoImpugnacion = 'legislative' | 'psychometric'

/**
 * Decide contra qué tabla se cierra, a partir de dónde EXISTE realmente la impugnación.
 *
 * Puro y exportado porque el fallo que corrige es silencioso y caro: sin `--psicotecnica`, una
 * impugnación psicotécnica se enviaba como legislativa y el endpoint contestaba
 * `404 "Impugnacion no encontrada"`. Ese texto se lee como «esa impugnación no existe» —te manda
 * a dudar del id— y no como «te falta un flag», que es lo que pasaba. Ocurrió el 31/07/2026
 * cerrando la impugnación de una serie numérica, con la respuesta ya redactada y aprobada.
 *
 * El flag se conserva, pero ya solo como declaración de intenciones: si contradice a la BD se
 * aborta en vez de mandar la petición que se sabe que va a fallar.
 */
export function resolverTipo(opts: {
  flagPsicotecnica: boolean
  enLegislativas: boolean
  enPsicotecnicas: boolean
}): { tipo: TipoImpugnacion; detectado: boolean } {
  const { flagPsicotecnica, enLegislativas, enPsicotecnicas } = opts
  if (!enLegislativas && !enPsicotecnicas) {
    throw new Error(
      'ese id no está en question_disputes ni en psychometric_question_disputes — revisa el id (no es que falte un flag)',
    )
  }
  // Dos filas con el mismo UUID en tablas distintas no debería ocurrir; si ocurre, manda lo que
  // se haya pedido a mano antes que una adivinanza.
  if (enLegislativas && enPsicotecnicas) {
    return { tipo: flagPsicotecnica ? 'psychometric' : 'legislative', detectado: false }
  }
  const real: TipoImpugnacion = enPsicotecnicas ? 'psychometric' : 'legislative'
  if (flagPsicotecnica && real === 'legislative') {
    throw new Error('pasaste --psicotecnica pero esa impugnación es legislativa: cerrarla así daría 404')
  }
  return { tipo: real, detectado: !flagPsicotecnica }
}

/**
 * Mira en las dos tablas. Si la BD no está accesible devuelve `null` y el script cae al flag
 * (comportamiento de siempre): quedarse sin poder cerrar por no poder MIRAR sería peor que el
 * defecto que esto arregla.
 */
async function dondeVive(disputeId: string): Promise<{ enLegislativas: boolean; enPsicotecnicas: boolean } | null> {
  const url = process.env.DATABASE_URL
  if (!url) return null
  let sql: any
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    const [leg] = await sql`SELECT 1 FROM question_disputes WHERE id = ${disputeId}`
    const [psy] = await sql`SELECT 1 FROM psychometric_question_disputes WHERE id = ${disputeId}`
    return { enLegislativas: !!leg, enPsicotecnicas: !!psy }
  } catch {
    return null
  } finally {
    await sql?.end?.().catch(() => {})
  }
}

/**
 * Deja constancia de un cierre SILENCIOSO. Sin esto, «cerrada sin escribirle» es indistinguible de
 * «se nos olvidó contestar»: no queda email, ni campana, ni `admin_response`. La traza es lo único
 * que permite, dentro de tres meses, saber que fue una decisión y cuál fue el motivo.
 *
 * Fail-open: la impugnación YA está cerrada cuando esto corre. Perder la traza es malo; abortar y
 * dejar creer que el cierre falló sería peor.
 */
async function trazarCierreSilencioso(disputeId: string, motivo: string): Promise<boolean> {
  const url = process.env.DATABASE_URL
  if (!url) return false
  let sql: any
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'cli:impugnaciones/cerrar', 'info',
              'dispute_cerrada_en_silencio',
              ${JSON.stringify({ disputeId, motivo })}::jsonb, NOW())`
    return true
  } catch {
    return false
  } finally {
    await sql?.end?.().catch(() => {})
  }
}

async function main() {
  const a = parsearArgs(process.argv.slice(2))
  // ── LO QUE SALE HACIA UNA PERSONA LO APRUEBA UNA PERSONA (T-486) ─────────────────────────
  // Antes que nada, incluso antes de validar los argumentos: esto le escribe por correo a quien
  // presentó la impugnación. Un trabajador autónomo no manda eso, deja el borrador.
  if (!exigirPersona('impugnacion')) process.exit(4)
  if (!a.disputeId || !a.estado || (!a.mensajeFichero && !a.silencioso)) {
    console.error('uso: cerrar.ts <dispute_id> --estado resolved|rejected (--mensaje <fichero.txt> | --silencioso --nota "<por qué>") [--aplicar]')
    process.exit(1)
  }
  // El cierre SILENCIOSO exige decir por qué no se escribe. Cerrar sin mensaje y sin motivo es
  // indistinguible de olvidarse de contestar, y desde fuera nadie puede saber cuál de las dos fue.
  if (a.silencioso && !a.nota) {
    console.error('--silencioso exige --nota "<por qué no se le escribe>" (p.ej. «respondida en la impugnación X, misma causa»)')
    process.exit(1)
  }
  if (a.silencioso && a.mensajeFichero) {
    console.error('--silencioso y --mensaje son incompatibles: o se le escribe o no.')
    process.exit(1)
  }
  if (a.estado !== 'resolved' && a.estado !== 'rejected') {
    console.error(`--estado tiene que ser resolved o rejected (llegó «${a.estado}»)`)
    process.exit(1)
  }
  // Mismo motivo que --silencioso/--mensaje arriba: uno pide QUITAR el euro y el otro
  // CONCEDERLO, así que los dos a la vez no tienen una respuesta única. El endpoint también lo
  // rechaza (Zod), pero fallar aquí evita el viaje de red y da un mensaje más claro.
  if (a.sinRecompensa && a.conRecompensa) {
    console.error('--sin-recompensa y --con-recompensa son incompatibles: elige uno.')
    process.exit(1)
  }
  // adminResponse VACÍO es lo que hace el cierre silencioso: el endpoint no manda email ni campana
  // (emailSkipReason='empty_response'). Ver `feedback-nila-cierre-silencioso`.
  const mensaje = a.silencioso ? '' : readFileSync(a.mensajeFichero!, 'utf8').trim()

  // ── PUERTA DE LOS ENLACES: no sale un enlace que no se ha abierto ───────────────────────────
  //
  // Regla de Manuel, y regla de la casa: si el mensaje enlaza al BOE y cita un artículo, hay
  // que ABRIRLO y comprobar que dice lo que decimos. Dependía de acordarse y el 02/08 se hizo
  // a medias (se comprobó que el ancla existía, no que llevara al artículo citado). Que exista
  // no basta: en el Código Civil `#a3` existe y lleva a «Artículo 301 a 324. (Derogados)».
  //
  // Se descarga aquí, en el último punto por el que pasa el mensaje, y el juicio lo pone el
  // núcleo puro `lib/impugnaciones/verificarEnlaces.cjs` (11 tests).
  if (mensaje) {
    const enlaces = extraerEnlacesBoe(mensaje)
    for (const url of enlaces) {
      const ancla = anclaDe(url)
      const articulo = articuloCitadoEnElTexto(mensaje)
      const citas = extraerCitas(mensaje)
      process.stdout.write(`🔗 abriendo ${url} … `)
      let html: string | null = null
      try {
        const r = await fetch(url.split('#')[0], { signal: AbortSignal.timeout(20000) })
        html = r.ok ? await r.text() : null
        if (!r.ok) console.log(`HTTP ${r.status}`)
      } catch (e) {
        console.log(`no se pudo abrir (${(e as Error).message.slice(0, 40)})`)
      }
      if (!html) {
        console.log('   ⚠️  NO se ha podido comprobar el enlace. Compruébalo a mano antes de enviar.')
        if (a.aplicar && !process.argv.includes('--enlace-sin-comprobar')) {
          console.error('   ❌ abortado: repite con --enlace-sin-comprobar si aun así quieres enviarlo.')
          process.exit(1)
        }
        continue
      }
      const v = verificarDocumento(html, { ancla, articulo, citas })
      if (v.ok) {
        console.log(`✅ ${ancla ? `#${ancla} → ${v.tituloDelBloque ?? 'bloque'}` : 'documento'}${citas.length ? ` · ${citas.length} cita(s) literal(es)` : ''}`)
      } else {
        console.log('❌')
        v.problemas.forEach((problema: string) => console.error(`   · ${problema}`))
        console.error('   ❌ abortado: el mensaje NO se envía con un enlace o una cita que no casan.')
        process.exit(1)
      }
    }
  }

  const donde = await dondeVive(a.disputeId)
  let tipo: TipoImpugnacion
  let detectado = false
  if (donde) {
    ;({ tipo, detectado } = resolverTipo({ flagPsicotecnica: a.psicotecnica, ...donde }))
  } else {
    tipo = a.psicotecnica ? 'psychometric' : 'legislative'
    console.log('⚠️  BD no accesible: no se ha podido comprobar el tipo, se usa el flag.')
  }

  const cuerpo: Record<string, unknown> = {
    disputeId: a.disputeId,
    questionType: tipo,
    status: a.estado,
    adminResponse: mensaje,
  }
  if (a.sinRecompensa) cuerpo.skipRewardReason = a.sinRecompensa
  if (a.conRecompensa) cuerpo.grantRewardReason = a.conRecompensa
  if (a.correccion) cuerpo.correccionDeRespuesta = a.correccion
  if (a.saltarBarajado) cuerpo.skipShuffleReason = a.saltarBarajado

  const etiqueta = tipo === 'psychometric' ? ' (psicotécnica)' : ''
  console.log(`\n── ${a.disputeId} → ${a.estado}${etiqueta}${detectado ? ' [tipo detectado en BD]' : ''}`)
  console.log(`   endpoint: ${BASE}/api/v2/dispute/resolve · admin: ${ADMIN}`)
  if (a.sinRecompensa) console.log(`   sin recompensa: ${a.sinRecompensa}`)
  if (a.conRecompensa) console.log(`   🎁 recompensa A MANO: ${a.conRecompensa}`)
  if (a.saltarBarajado) console.log(`   salta barajado: ${a.saltarBarajado}`)
  if (a.silencioso) {
    console.log(`   🔇 CIERRE SILENCIOSO — sin email ni campana. Motivo: ${a.nota}`)
  } else {
    console.log('\n' + mensaje.split('\n').map((l) => '   │ ' + l).join('\n'))
  }

  // ── PUERTA DE RESERVA (T-474) ──────────────────────────────────────────────────────────────
  // Se comprueba también en dry-run —y a propósito—: enterarte de que el caso es de otra sesión
  // DESPUÉS de redactarle el mensaje al usuario no sirve de nada. Solo aborta con --aplicar.
  const tabla = tipo === 'psychometric' ? 'psychometric_question_disputes' : 'question_disputes'
  const veredicto = await comprobarReserva({ tabla, id: a.disputeId, igualmente: a.igualmente })
  const sePuedeReserva = anunciar(veredicto, { aplicar: a.aplicar })

  // ── PUERTA DE TEMARIO ──────────────────────────────────────────────────────────────────────
  // La Regla previa OBLIGATORIA del runbook de epígrafes, exigida donde se escribe. Ver
  // `lib/puerta-temario.ts` para el porqué de bloquear aquí y no en el dossier.
  const vTemario = await comprobarTemario({ disputeId: a.disputeId, tabla, igualmente: a.temarioIgualmente })
  const sePuedeTemario = anunciarTemario(vTemario, { aplicar: a.aplicar })

  // ── PUERTA DEL EMBUDO (T-609) ──────────────────────────────────────────────────────────────
  // ¿Ya hay una respuesta de Manuel en `session_questions` que VETA este envío? Ver
  // `lib/puerta-embudo.ts` para el incidente que la motiva. También en dry-run, por lo mismo que
  // las otras dos: enterarte después de haber redactado no sirve de nada.
  const vEmbudo = await comprobarEmbudo({ disputeId: a.disputeId, igualmente: a.embudoIgualmente })
  const sePuedeEmbudo = anunciarEmbudo(vEmbudo, { aplicar: a.aplicar })

  const sePuede = sePuedeReserva && sePuedeTemario && sePuedeEmbudo

  // ── PUERTA DEL VERDICTO SISTÉMICO (T-520) ──────────────────────────────────────────────────
  // «Después de cada impugnación deberías hacerte esa pregunta y que no se te olvide, porque si no
  // no avanzamos nada» (Manuel, 04/08/2026). Va AQUÍ, en el último paso, porque el dossier se lee
  // al empezar y para el cierre la pregunta ya se quedó por el camino. Se anuncia también en
  // dry-run, para que no sorprenda con el mensaje ya aprobado.
  let sistemicoOk = true
  if (a.sistemicoOmitido) {
    console.log(`\n⚠️  verdicto sistémico OMITIDO a propósito: ${a.sistemicoOmitido}`)
  } else {
    const v = validarVerdictoSistemico(a.sistemico)
    if (v.ok) {
      console.log(`\n🔬 sistémico [${v.clase}]: ${String(a.sistemico).trim()}`)
    } else {
      sistemicoOk = false
      console.error(`\n❌ ${v.problema}`)
      console.error('   Una impugnación llega por UNA pregunta y casi nunca es un caso aislado:')
      console.error('   quien la escribe solo ha visto la punta. Declara qué miraste, con una de:')
      console.error('     --sistemico "aislado: <por qué no puede haber más casos>"')
      console.error('     --sistemico "medido: <qué medí> → <N> casos"          (tiene que llevar la CIFRA)')
      console.error('     --sistemico "ficha T-nnn: <qué se abrió>"')
      console.error('   Escape contado: --sistemico-omitido "<por qué no procede>"')
    }
  }

  if (!a.aplicar) {
    const bien = sePuede && sistemicoOk
    console.log(bien ? '\n(dry-run — repite con --aplicar para enviarlo)\n' : '\n(dry-run — con --aplicar esto se habría abortado)\n')
    return
  }
  if (!sePuede || !sistemicoOk) process.exit(1)

  const token = await tokenDeAdmin()
  const res = await fetch(`${BASE}/api/v2/dispute/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  })
  const out = await res.json().catch(() => ({}))
  console.log(`\nHTTP ${res.status}:`, JSON.stringify(out, null, 2))
  // El email es la mitad del trabajo: si no sale, la impugnación queda cerrada y el usuario
  // sin enterarse. Se canta en vez de dejarlo enterrado en el JSON.
  if (out?.success) {
    if (a.silencioso) {
      const trazada = await trazarCierreSilencioso(a.disputeId, a.nota!)
      console.log(`\n✅ cerrada EN SILENCIO (sin email ni campana)${trazada ? ' · traza guardada' : ' · ⚠️ no se pudo guardar la traza'}`)
    } else {
      console.log(out.emailSent ? '\n✅ cerrada y email enviado' : `\n⚠️ cerrada pero SIN email: ${out.emailError || out.emailSkipReason || '?'}`)
    }
    // Cerrar el caso RETIRA su borrador del embudo (T-486). Si no, la fila se queda abierta y
    // `npm run flota` sigue pidiendo que se apruebe algo YA ENVIADO: medido el 06/08, 15
    // borradores abiertos cuyos 15 casos estaban resueltos. Una señal que no se apaga sola acaba
    // mintiendo, y una lista que miente se deja de mirar. Fail-open: el cierre ya está hecho.
    await retirarBorradorDelEmbudo(a.disputeId, `impugnación ${a.estado}`)
  } else {
    process.exitCode = 1
  }
}


/**
 * Retira del embudo el borrador de esta impugnación. El criterio vive en UN sitio
 * (`lib/sessions/retirarBorrador.cjs`), compartido con el cierre de feedback: copiarlo aquí es
 * como nacieron los cinco escritores de `seguimiento_url` [T-130].
 */
async function retirarBorradorDelEmbudo(casoId: string, motivo: string): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) return
  let sql: any = null
  try {
    const postgres = (await import('postgres')).default
    sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { retirarBorradoresDe } = require('../../lib/sessions/retirarBorrador.cjs')
    const n = await retirarBorradoresDe(sql, casoId, motivo)
    if (n > 0) console.log(`   🧹 ${n} borrador(es) retirados del embudo: ya no hacen falta`)
  } catch { /* el cierre ya está hecho: esto nunca puede tumbarlo */ } finally {
    try { await sql?.end({ timeout: 5 }) } catch {}
  }
}

if (process.argv[1]?.endsWith('cerrar.ts')) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
