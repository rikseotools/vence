#!/usr/bin/env node
// scripts/health/oposicion-sin-temario.cjs
//
// ¿Cuánta gente ha elegido una oposición que no tiene NI UN TEMA? [T-397]
//
//   node scripts/health/oposicion-sin-temario.cjs              # resumen + los premium
//   node scripts/health/oposicion-sin-temario.cjs --todos       # la lista entera
//   node scripts/health/oposicion-sin-temario.cjs --limite 30
//
// SOLO LEE. No escribe, no pinga badge y no manda correo — a propósito, y no por prudencia:
// las tres salidas de este problema (marcar la oposición en el selector, atender a los premium,
// construir el temario) son decisiones de PRODUCTO que no ha tomado nadie todavía. Una alerta
// sin remediación construida enseña a ignorar el buzón entero, que es lo que ya está pasando
// con `fraude_confirmado_sin_accion` (ver T-426).
//
// El criterio vive en `lib/health/oposicionSinTemario.cjs`, con tests. Aquí solo está la
// consulta y cómo se presenta.

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
// El `sslmode` de la URL PISA la opción `ssl` en `pg`: la receta va en un solo sitio.
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const {
  SQL_EXCLUIR_PERSONALIZADAS,
  clasificarEleccion,
  ordenarPorUrgencia,
  resumir,
} = require('../../lib/health/oposicionSinTemario.cjs')

const argv = process.argv.slice(2)
const TODOS = argv.includes('--todos')
const iLim = argv.indexOf('--limite')
const LIMITE = iLim >= 0 && argv[iLim + 1] ? parseInt(argv[iLim + 1], 10) : 12

// `plan_type <> 'free'` es la definición de premium que usa el resto de la app. Se cuenta
// aquí y no fuera para que el número de premium venga de la MISMA fila que el de usuarios:
// dos consultas distintas se desincronizan en cuanto alguien cambia de plan a mitad.
const SQL = `
  with elegidas as (
    select target_oposicion as slug,
           count(*)::int as usuarios,
           count(*) filter (where plan_type is not null and plan_type <> 'free')::int as premium
      from user_profiles
     where target_oposicion is not null
       and ${SQL_EXCLUIR_PERSONALIZADAS}
     group by 1
  ), temas as (
    select position_type, count(*) filter (where is_active)::int as activos
      from topics
     group by 1
  )
  select e.slug, e.usuarios, e.premium, coalesce(t.activos, 0) as temas_activos
    from elegidas e
    left join temas t on t.position_type = e.slug`

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  try {
    const { rows } = await c.query(SQL)
    const hallazgos = ordenarPorUrgencia(
      rows
        .map((r) =>
          clasificarEleccion({
            slug: r.slug,
            usuarios: r.usuarios,
            premium: r.premium,
            temasActivos: r.temas_activos,
          }),
        )
        .filter(Boolean),
    )
    const r = resumir(hallazgos)

    console.log('\n═══ OPOSICIONES ELEGIDAS SIN NI UN TEMA ═══')
    console.log(`  oposiciones: ${r.oposiciones}  ·  usuarios afectados: ${r.usuarios}`)
    console.log(`  🟥 PREMIUM afectados: ${r.premium} (en ${r.conPremium} oposición/es) — están pagando por algo que no existe`)
    console.log('')

    const premium = hallazgos.filter((h) => h.premium > 0)
    if (premium.length) {
      console.log('  🟥 CON PREMIUM — se atienden uno a uno, con nombre y apellidos:')
      for (const h of premium) {
        console.log(`     ${String(h.premium).padStart(2)} premium · ${String(h.usuarios).padStart(3)} usuarios  ${h.slug}`)
      }
      console.log('')
    }

    const soloFree = hallazgos.filter((h) => h.premium === 0)
    const mostrar = TODOS ? soloFree : soloFree.slice(0, LIMITE)
    if (mostrar.length) {
      console.log(`  ⬜ SOLO FREE — por volumen, que es la señal de qué temario construir:`)
      for (const h of mostrar) {
        console.log(`     ${String(h.usuarios).padStart(3)} usuarios  ${h.slug}`)
      }
      if (!TODOS && soloFree.length > mostrar.length) {
        console.log(`     … y ${soloFree.length - mostrar.length} más (--todos para verlas)`)
      }
    }

    // [T-508] Este pie decía «las personalizadas están EXCLUIDAS… NO están rotas» mientras la
    // lista de arriba ya traía dos, una de ellas de una premium que ese día reportó el 404 que
    // eso provoca. Un aviso que desmiente a la propia salida enseña a descartar filas buenas.
    // Ahora se dice exactamente qué se excluye (el formato viejo, que no se puede medir) y qué
    // no (el formato nuevo, que sí).
    const personalizadas = hallazgos.filter((h) => h.tipo === 'personalizada')
    console.log('')
    if (personalizadas.length > 0) {
      console.log(`  📌 ${personalizadas.length} de las de arriba son PERSONALIZADAS vacías (formato`)
      console.log('     `personalizada_<uuid>`): la fila existe pero no tiene ni un tema, así que a')
      console.log('     su dueño el icono 📚 le enseña el temario vacío. Se arregla en el editor, no')
      console.log('     construyendo temario nosotros.')
    }
    console.log('  ⚠️ Las personalizadas del formato VIEJO (UUID pelado en target_oposicion) están')
    console.log('     EXCLUIDAS y seguirán estándolo: sus temas viven bajo otro `position_type`, así')
    console.log('     que el join daría 0 para todas. Contarlas ya hizo publicar una cifra')
    console.log('     equivocada una vez.')
    console.log('  (solo lectura: no se ha tocado nada — las tres salidas son decisión de producto, ver T-397)\n')
  } finally {
    await c.end()
  }
})()
