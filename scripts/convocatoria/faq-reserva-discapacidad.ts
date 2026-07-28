#!/usr/bin/env npx tsx
/**
 * Pasa las FAQ que hablan del cupo de discapacidad a la frase DERIVADA del dato — [T-236].
 *
 * ## El problema
 *
 * La frase que distingue si el cupo va DENTRO del turno libre o APARTE se cableó en el hero, pero en
 * la FAQ solo en la rama de fallback… que no ejecuta ninguna landing viva (las 123 tienen
 * `landing_faqs` en BD). Resultado: el hero de `auxilio-judicial` dice ya «425 plazas de acceso
 * libre, de las cuales 43 están reservadas…» (correcto) mientras el JSON-LD que se lleva Google
 * publica «425 plazas de acceso libre (43 reservadas para discapacidad)», que invita a sumar 468.
 * La misma página, dos cifras.
 *
 * ## Por qué una TABLA explícita y no un regex
 *
 * Son textos escritos a mano, uno por convocatoria: de las 71 respuestas que mencionan discapacidad,
 * solo 12 usan el patrón «…de acceso libre (reserva)» y ni dos lo escriben igual. Un regex sobre
 * prosa libre acierta hoy y mutila mañana. Aquí cada reescritura va enumerada, con el texto ACTUAL
 * como guarda: si alguien lo cambió entre medias, esta fila se salta en vez de pisarla (mismo
 * criterio que `corregir-plazas-contra-boletin.cjs`).
 *
 * ## Qué NO toca
 *
 * · Las respuestas que enumeran los turnos por separado citando el boletín («7 de turno libre, 3 de
 *   reserva y 5 de promoción»): describen, no afirman inclusión, y son texto con fuente detrás.
 * · Ninguna CIFRA. Lo único que cambia es la redacción; las plazas se leen del boletín.
 *
 *   npx tsx scripts/convocatoria/faq-reserva-discapacidad.ts [--apply]
 */
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
// El núcleo de la frase, no una copia: si cambia la regla, cambia esto con ella (igual que
// `sim-frase-plazas.ts`, que corre la misma frase sobre todas las convocatorias).
import { fraseReserva } from '../../lib/convocatoria/reservaDiscapacidad'

const REPO = path.join(__dirname, '../..')
const fmt = (n: number | null) => (n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'))

/**
 * Las reescrituras, una por una. `antes` es GUARDA (debe coincidir al carácter) y `despues` usa
 * `{reservaDiscapacidad}`, que el render resuelve con la MISMA frase del hero.
 *
 * Se incluyen dos clases:
 *   · relación DECLARADA (`incluidas` true/false) → la frase pasa a decir la verdad del dato.
 *   · relación SIN DECLARAR que el texto afirmaba igualmente (el paréntesis se lee como suma, o
 *     «incluyendo reservas» afirma lo contrario de lo que suma la vista) → deja de afirmarse. Es la
 *     misma decisión que ya toma el hero: callar es más honesto que inventar la relación. Se
 *     recupera declarando el dato contra el boletín, que es trabajo de otra ficha.
 */
const REESCRITURAS = [
  {
    slug: 'auxilio-judicial',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} reservadas para discapacidad).',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad}',
    porque: 'cupo DENTRO (RD 651/2025: «del total de estas plazas se reservan»); el paréntesis invitaba a sumar 468 donde hay 425',
  },
  {
    slug: 'auxiliar-administrativo-baleares',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} reservadas para discapacidad).',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad}',
    porque: 'cupo DENTRO; el paréntesis invitaba a sumar 136 donde hay 128',
  },
  {
    slug: 'auxiliar-administrativo-galicia',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} discapacidad) y {plazasPromocion} de promoción interna.',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad} A ellas se suman {plazasPromocion} de promoción interna.',
    porque: 'cupo DENTRO; además el turno de promoción pasa a frase propia para no encadenarse a la reserva',
  },
  {
    slug: 'auxiliar-administrativo-extremadura',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} reservadas para discapacidad).',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad}',
    porque: 'cupo APARTE: el paréntesis se leía como «de las cuales», que es justo lo contrario',
  },
  {
    slug: 'auxiliar-administrativo-canarias',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} reservadas para discapacidad) y {plazasPromocion} de promoción interna.',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad}',
    porque: 'cupo APARTE (el paréntesis se leía como «de las cuales»); y se cae la coletilla de promoción, que publicaba literalmente «y — de promoción interna» porque esa convocatoria tiene el turno a NULL',
  },
  {
    slug: 'auxiliar-administrativo-ayuntamiento-murcia',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre, más 2 reservadas para personas con discapacidad.',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre{reservaDiscapacidad}',
    porque: 'decía bien la relación pero con el «2» TECLEADO: el día que cambie el cupo, la frase miente sola',
  },
  {
    slug: 'auxiliar-administrativo-clm',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre ({plazasDiscapacidad} reservadas para discapacidad) para el Cuerpo Auxiliar de la Junta de Comunidades de Castilla-La Mancha.',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre para el Cuerpo Auxiliar de la Junta de Comunidades de Castilla-La Mancha.',
    porque: 'relación SIN DECLARAR: el paréntesis afirmaba una que no consta. Vuelve en cuanto se declare contra el boletín',
  },
  {
    slug: 'auxiliar-administrativo-valencia',
    antes: 'Se convocan {plazasLibres} plazas de acceso libre (incluyendo reservas de discapacidad) y {plazasPromocion} de promoción interna (OEP 2026, Decreto 16/2026).',
    despues: 'Se convocan {plazasLibres} plazas de acceso libre y {plazasPromocion} de promoción interna (OEP 2026, Decreto 16/2026).',
    porque: 'afirmaba «incluyendo» mientras la vista SUMA el cupo (dato sin declarar): la propia página se contradecía en el total',
  },
]

/** Resuelve las variables igual que el render de la landing, para poder ver la frase final. */
function resolver(texto: string, vars: Record<string, string>): string {
  return String(texto).replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : vars[k]))
}

type FilaFaq = {
  slug: string
  id: string
  plazas_libres: number | null
  plazas_promocion_interna: number | null
  plazas_discapacidad: number | null
  plazas_discapacidad_incluidas: boolean | null
  landing_faqs: Array<{ pregunta?: string; respuesta?: string }> | null
}

async function main() {
  const apply = process.argv.includes('--apply')
  const enEnv = fs.existsSync(path.join(REPO, '.env.local'))
    ? (fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m) || [])[1]
    : undefined
  const url = (process.env.DATABASE_URL || enEnv || '').trim().replace(/^["']|["']$/g, '')
  if (!url) { console.error('❌ sin DATABASE_URL (ni en el entorno ni en .env.local)'); process.exit(2) }
  const db = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await db.connect()

  const slugs = REESCRITURAS.map((r) => r.slug)
  const { rows } = await db.query(
    `SELECT o.slug, o.id, o.plazas_libres, o.plazas_promocion_interna, o.plazas_discapacidad,
            o.plazas_discapacidad_incluidas, o.landing_faqs
       FROM oposiciones_ssot o WHERE o.slug = ANY($1)`, [slugs])
  const porSlug = new Map((rows as FilaFaq[]).map((r) => [r.slug, r]))

  let ok = 0, saltadas = 0
  const escrituras: Array<{ id: string; slug: string; nuevas: unknown[]; antes: string }> = []
  for (const r of REESCRITURAS) {
    const fila = porSlug.get(r.slug)
    if (!fila) { console.log(`⏭️  ${r.slug}: no está o no es activa`); saltadas++; continue }
    const faqs = Array.isArray(fila.landing_faqs) ? fila.landing_faqs : null
    if (!faqs) { console.log(`⏭️  ${r.slug}: sin landing_faqs`); saltadas++; continue }
    const i = faqs.findIndex((f) => f && f.respuesta === r.antes)
    if (i === -1) {
      console.log(`⏭️  ${r.slug}: el texto ACTUAL ya no coincide con la guarda → no se pisa`)
      saltadas++
      continue
    }

    const vars = {
      plazasLibres: fmt(fila.plazas_libres),
      plazasPromocion: fmt(fila.plazas_promocion_interna),
      plazasDiscapacidad: fmt(fila.plazas_discapacidad),
      reservaDiscapacidad: fraseReserva(fila.plazas_discapacidad, fila.plazas_discapacidad_incluidas, fmt) ?? '.',
    }
    const hero = `Oposición con ${fmt(fila.plazas_libres)} plazas de acceso libre` +
      (fraseReserva(fila.plazas_discapacidad, fila.plazas_discapacidad_incluidas, fmt) ?? '.')

    console.log(`\n · ${r.slug}  (libres=${fila.plazas_libres} cupo=${fila.plazas_discapacidad} incluidas=${fila.plazas_discapacidad_incluidas})`)
    console.log(`   porqué:  ${r.porque}`)
    console.log(`   ANTES →  ${resolver(r.antes, vars)}`)
    console.log(`   AHORA →  ${resolver(r.despues, vars)}`)
    console.log(`   hero  →  ${hero}`)
    ok++

    const nuevas = faqs.map((f, k) => (k === i ? { ...f, respuesta: r.despues } : f))
    escrituras.push({ id: fila.id, slug: r.slug, nuevas, antes: r.antes })
  }

  console.log(`\n${ok} reescritura(s) listas · ${saltadas} saltada(s)`)
  if (!apply) { console.log('\n(simulación — ejecuta con --apply para escribir)'); await db.end(); return }

  // Transacción: o entran todas o ninguna. El UPDATE lleva la guarda del texto viejo DENTRO, así
  // que si otra sesión lo cambió entre el SELECT y aquí, esa fila no se escribe (0 filas) y se ve.
  await db.query('BEGIN')
  try {
    for (const e of escrituras) {
      // jsonb por parámetro, NUNCA `JSON.stringify(x)::jsonb` concatenado (gotcha del runbook).
      const res = await db.query(
        `UPDATE public.convocatorias c
            SET landing_faqs = $1::jsonb
          WHERE c.oposicion_id = $2 AND c.is_current
            AND c.landing_faqs @> $3::jsonb`,
        [JSON.stringify(e.nuevas), e.id, JSON.stringify([{ respuesta: e.antes }])])
      if (res.rowCount !== 1) {
        // La convocatoria vigente puede no llevar las FAQ (vienen del legacy `oposiciones`): se
        // escribe donde de verdad están, con la misma guarda.
        const leg = await db.query(
          `UPDATE public.oposiciones o
              SET landing_faqs = $1::jsonb
            WHERE o.id = $2 AND o.landing_faqs @> $3::jsonb`,
          [JSON.stringify(e.nuevas), e.id, JSON.stringify([{ respuesta: e.antes }])])
        console.log(`   ${leg.rowCount === 1 ? '✅' : '⚠️ '} ${e.slug} (${leg.rowCount === 1 ? 'oposiciones' : 'NO escrita'})`)
      } else {
        console.log(`   ✅ ${e.slug} (convocatorias)`)
      }
    }
    await db.query('COMMIT')
    console.log('\n✅ COMMIT. Recuerda purgar la caché de las landings tocadas.')
  } catch (e) {
    await db.query('ROLLBACK')
    console.error('❌ ROLLBACK:', (e as Error).message)
    process.exitCode = 1
  }
  await db.end()
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
