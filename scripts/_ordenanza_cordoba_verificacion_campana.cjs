#!/usr/bin/env node
/**
 * _ordenanza_cordoba_verificacion_campana.cjs — correcciones de la landing de
 * `ordenanza-ayuntamiento-cordoba` verificadas contra FUENTE PRIMARIA antes de mandarle
 * la campaña de inscripción abierta (T-110). **Dry-run por defecto.**
 *
 * FUENTES LEÍDAS (27/07/2026), todas clonadas ya en el hub de provenance:
 *  · BOE-A-2026-15802 (BOE núm. 175, 20/07/2026) — «Veintitrés plazas de Ordenanza,
 *    pertenecientes a la escala de Administración General, subescala Subalterna, por el
 *    sistema de oposición, en turno libre» y «veinte días hábiles».
 *  · BOP Córdoba núm. 218, 13/11/2025 (BOP-A-2025-3950) — acumula 2 plazas de la OEP 2020
 *    con 21 de la OEP 2023-2024: de ahí salen las 23.
 *  · BOP Córdoba núm. 99, 23/05/2025 (BOP-A-2025-1439) — bases + ANEXO I (temario) +
 *    sistema de selección (base Decimosegunda) + requisitos (base Segunda).
 *  · Sede electrónica del Ayuntamiento («Convocatorias abiertas», RHU01-2026-09):
 *    plazo del 21/07/2026 00:00 al 17/08/2026 23:59 — cuadra con los 20 días hábiles.
 *
 * QUÉ CORRIGE (y por qué era un problema para la campaña):
 *  1. `boe_reference`/`diario_referencia`: el subtítulo del botón oficial anunciaba el BOE
 *     mientras el enlace (`programa_url`) lleva a las BASES del BOP — que además hablan de
 *     21 plazas, no de 23. Se reescribe para que nombre los dos documentos por lo que son.
 *     (No se repunta `programa_url`: es también la fuente del temario que hashea el Sistema 2
 *     de literalidad de epígrafe, y el extracto del BOE no lleva temario.)
 *  2. FAQ del examen: decía «ejercicios eliminatorios» sin un solo dato. Ahora lleva la
 *     estructura real de la base Decimosegunda.
 *  3. FAQ nueva 21 vs 23: quien abra las bases va a leer «21 plazas» y pensar que mentimos.
 *  4. `examen_config`: mismos datos, para las superficies que lo leen.
 *  5. `landing_description` no estaba propagada a la convocatoria (dual-write incompleto).
 *
 * Orden de escritura: SSOT (`convocatorias`) primero y legacy (`oposiciones`) después, igual
 * que `dual-write-adjudicar.cjs` — si algo peta a mitad, los lectores (vista `oposiciones_ssot`)
 * ya ven el dato bueno. Gotcha jsonb: se escribe con `sql.json(...)`, nunca `JSON.stringify(x)::jsonb`.
 */
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')

const APPLY = process.argv.includes('--apply')
const SLUG = 'ordenanza-ayuntamiento-cordoba'

const REFERENCIA =
  'Convocatoria: BOE-A-2026-15802 (BOE núm. 175, 20/07/2026) · Bases y temario: BOP Córdoba núm. 99 (23/05/2025), acumuladas por el BOP núm. 218 (13/11/2025)'

const FAQ_EXAMEN =
  'Dos ejercicios, ambos eliminatorios. El primero es un test de 45 preguntas con 4 respuestas alternativas (más 5 de reserva) y 60 minutos como máximo: hay que acertar al menos 27 para obtener un 5. El segundo consiste en uno o varios supuestos o pruebas prácticas sobre los temas específicos del Anexo I, con un máximo de 2 horas. Cada ejercicio puntúa hasta 10 y queda eliminado quien no llegue a 5 (base Decimosegunda, BOP Córdoba núm. 99 de 23/05/2025).'

const FAQ_21_VS_23 = {
  pregunta: '¿Por qué las bases hablan de 21 plazas y aquí pone 23?',
  respuesta:
    'Porque las 23 salen de dos procesos que el Ayuntamiento unió en uno solo: 21 plazas de la Oferta de Empleo Público 2023-2024 (bases del BOP núm. 99, de 23/05/2025) y 2 plazas de la OEP 2020, acumuladas por la resolución del BOP núm. 218, de 13/11/2025. El anuncio del BOE de 20/07/2026 ya convoca las 23 juntas, con el mismo temario y el mismo examen.',
}

const EXAMEN_CONFIG = {
  tipo: 'oposición',
  ejercicios: [
    { numero: 1, formato: 'test', preguntas: 45, reserva: 5, opciones: 4, minutos: 60, aciertos_para_5: 27, eliminatorio: true },
    { numero: 2, formato: 'supuesto_practico', minutos: 120, eliminatorio: true, notas: 'Uno o varios supuestos o pruebas prácticas sobre los temas específicos del Anexo I, sorteados antes de la prueba.' },
  ],
  notas:
    'Estructura de la base Decimosegunda de las bases (BOP Córdoba núm. 99, de 23/05/2025), aplicables al proceso acumulado de 23 plazas (BOP núm. 218, de 13/11/2025).',
}

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
  try {
    const [o] = await sql`
      SELECT o.id, o.slug, o.boe_reference, o.diario_referencia, o.landing_description, o.landing_faqs,
             v.id AS conv_id, v.landing_description AS conv_desc, v.landing_faqs AS conv_faqs
      FROM oposiciones o
      JOIN convocatorias v ON v.oposicion_id = o.id AND v.is_current AND v.archived_at IS NULL
      WHERE o.slug = ${SLUG}`
    if (!o) throw new Error(`no existe ${SLUG} con convocatoria vigente`)

    const faqs = (o.landing_faqs || []).map((f) =>
      /cómo es el examen/i.test(f.pregunta) ? { ...f, respuesta: FAQ_EXAMEN } : f)
    if (!faqs.some((f) => /21 plazas/i.test(f.pregunta))) {
      // Justo detrás de la de plazas, que es donde nace la duda.
      const i = faqs.findIndex((f) => /cuántas plazas/i.test(f.pregunta))
      faqs.splice(i >= 0 ? i + 1 : faqs.length, 0, FAQ_21_VS_23)
    }

    console.log(`\n── ${SLUG}`)
    console.log(`  referencia ANTES : ${o.boe_reference}`)
    console.log(`  referencia AHORA : ${REFERENCIA}`)
    console.log(`  FAQs             : ${(o.landing_faqs || []).length} → ${faqs.length}`)
    console.log(`  dual-write desc  : convocatoria ${o.conv_desc ? 'ya tiene' : 'VACÍA → se propaga'} (${(o.landing_description || '').length} chars)`)
    console.log(`  examen_config    : ${EXAMEN_CONFIG.ejercicios.length} ejercicios con cifras de las bases`)

    if (!APPLY) { console.log('\n(dry-run — repite con --apply)\n'); return }

    await sql.begin(async (tx) => {
      // 1) SSOT primero
      await tx`
        UPDATE convocatorias
           SET landing_description = ${o.landing_description},
               landing_faqs = ${sql.json(faqs)},
               examen_config = ${sql.json(EXAMEN_CONFIG)},
               boe_reference = ${REFERENCIA},
               updated_at = NOW()
         WHERE id = ${o.conv_id}`
      // 2) legacy después
      await tx`
        UPDATE oposiciones
           SET landing_faqs = ${sql.json(faqs)},
               examen_config = ${sql.json(EXAMEN_CONFIG)},
               boe_reference = ${REFERENCIA},
               diario_referencia = ${REFERENCIA}
         WHERE id = ${o.id}`
    })
    console.log('\n✅ aplicado (SSOT + legacy)\n')
  } finally {
    await sql.end()
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
