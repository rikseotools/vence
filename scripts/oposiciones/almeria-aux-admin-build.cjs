#!/usr/bin/env node
/**
 * BUILD (fase 1) — Auxiliar Administrativo de la Universidad de Almería (C2). Tarea T-044.
 *
 * Crea los 24 temas con su EPÍGRAFE LITERAL del Anexo II de la convocatoria oficial
 * (BOE-A-2026-14723, Resolución de 30/06/2026 del Rectorado; BOJA nº132 de 10/07/2026)
 * y engancha el `topic_scope` de todo lo que YA tenemos banco en BD.
 *
 * Los temas quedan `disponible=false` y la oposición sigue `is_active=false`: nada de esto
 * se ve en la web hasta que se cierren los huecos y se revise. Esta fase es additiva y
 * reversible (borrar los temas de este position_type).
 *
 * Reuso medido en RDS (20/07) — 15 de 24 temas quedan servidos desde el minuto uno:
 *   Bloque I entero (T1-T8): 39/2015 3.146 · 40/2015 1.493 · LO 3/2018 898 · EBEP 1.233 ·
 *   Ley 53/1984 49 · Ley 1/2014 Transparencia Andalucía 52 · LO 3/2007 800 · LPRL 52.
 *   Bloque II parcial: LOSU 198 · Ley 1/2026 LUA 18 · RD 822/2021 52 · RD 99/2011 53 ·
 *   RD 534/2024 23 · RD 1002/2010 54 · RD 22/2015 5 · RD 1125/2003 9.
 *   Bloque III: Word 365 995 + Excel 365 798.
 *
 * HUECOS (9 temas, quedan sin scope y marcados en la ficha del backlog):
 *   · T13 Ley 14/2011 de la Ciencia — norma estatal que NO está en BD: importar del BOE.
 *   · T11, T12, T14, T15, T18, T19, T22, T23 — normativa PROPIA de la UAL. En BD no hay
 *     NINGUNA norma de la Universidad de Almería: hay que importarlas de su fuente oficial
 *     (sede/BOUAL) antes de generar nada. Nunca inventar contenido normativo.
 *
 * Uso: node scripts/oposiciones/almeria-aux-admin-build.cjs [--dry-run]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const DRY = process.argv.includes('--dry-run')
const PT = 'auxiliar_administrativo_universidad_almeria'

// Epígrafes LITERALES del Anexo II (no parafrasear: es la referencia contra la que se
// verifica el scope). `leyes` = short_name en BD + artículos; null = toda la ley.
const TEMAS = [
  // ── Bloque I. Normativa general ──
  { n: 1, b: 1, t: 'Ley 39/2015 del Procedimiento Administrativo Común',
    e: 'La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas.',
    leyes: [{ ley: 'Ley 39/2015', arts: null }] },
  { n: 2, b: 1, t: 'Ley 40/2015: Título Preliminar',
    e: 'Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público: Título Preliminar. Disposiciones generales, principios de actuación y funcionamiento del sector público.',
    leyes: [{ ley: 'Ley 40/2015', arts: r(1, 53) }] },
  { n: 3, b: 1, t: 'Protección de Datos: LO 3/2018',
    e: 'Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales. Título I. Disposiciones generales. Título II. Principios de Protección de Datos. Título III. Derechos de las personas. Título V. Responsable y encargado del tratamiento. Título X. Garantía de los derechos digitales.',
    leyes: [{ ley: 'LO 3/2018', arts: [...r(1, 18), ...r(28, 43), ...r(79, 97)] }] },
  { n: 4, b: 1, t: 'Estatuto Básico del Empleado Público (TREBEP)',
    e: 'Real Decreto Legislativo 5/2015, de 30 de octubre, por el que se aprueba el texto refundido de la Ley del Estatuto Básico del Empleado Público.',
    leyes: [{ ley: 'RDL 5/2015', arts: null }] },
  { n: 5, b: 1, t: 'Incompatibilidades del personal al servicio de las AAPP',
    e: 'Ley 53/1984, de 26 de diciembre, de Incompatibilidades del personal al servicio de las Administraciones Públicas.',
    leyes: [{ ley: 'Ley 53/1984', arts: null }] },
  { n: 6, b: 1, t: 'Transparencia Pública de Andalucía',
    e: 'Ley 1/2014, de 24 de junio, de Transparencia Pública de Andalucía: Título I. Disposiciones Generales: Principios básicos, Derechos y Obligaciones. Título II. La Publicidad Activa. Título III. El Derecho de Acceso a la Información Pública: Normas generales.',
    leyes: [{ ley: 'Ley 1/2014 Transparencia Andalucía', arts: null }] },
  { n: 7, b: 1, t: 'Igualdad efectiva de mujeres y hombres',
    e: 'Ley Orgánica 3/2007 para la igualdad efectiva de mujeres y hombres. Título Preliminar: Objeto y ámbito de la ley. Título I: El principio de igualdad y la tutela contra la discriminación. Título II. Capítulo II: La igualdad en el ámbito de la educación superior. Título IV. Capítulo II: Igualdad y conciliación. Título V. El principio de igualdad en el empleo público: Capítulos I, II y III.',
    leyes: [{ ley: 'LO 3/2007', arts: [...r(1, 13), 25, ...r(44, 47), ...r(51, 64)] }] },
  { n: 8, b: 1, t: 'Prevención de Riesgos Laborales',
    e: 'La Ley 31/1995, de Prevención de Riesgos Laborales. Derechos y obligaciones. El Delegado de Prevención. El Comité de Seguridad y Salud. Normativa interna del Comité de Seguridad y Salud laboral de la Universidad de Almería.',
    leyes: [{ ley: 'Ley 31/1995 LPRL', arts: null }] },

  // ── Bloque II. Normativa universitaria ──
  { n: 9, b: 2, t: 'Ley Orgánica del Sistema Universitario (LOSU)',
    e: 'Ley Orgánica 2/2023, de 22 de marzo, del Sistema Universitario.',
    leyes: [{ ley: 'LOSU', arts: null }] },
  { n: 10, b: 2, t: 'Ley Universitaria para Andalucía: gobernanza',
    e: 'Ley 1/2026, de 20 de febrero, Universitaria para Andalucía. Título V: Gobernanza de las Universidades Públicas.',
    leyes: [{ ley: 'Ley 1/2026 LUA', arts: null }] },
  { n: 11, b: 2, t: 'Presupuesto 2026 de la UAL: bases de ejecución',
    e: 'El Presupuesto 2026 de la Universidad de Almería: Bases de ejecución presupuestaria.', leyes: [] },
  { n: 12, b: 2, t: 'PDI: concursos de acceso a cuerpos docentes (UAL)',
    e: 'El Personal Docente e Investigador: El Reglamento de la Universidad de Almería que regula el procedimiento de los concursos de acceso a los cuerpos docentes universitarios.', leyes: [] },
  { n: 13, b: 2, t: 'PDI: contratación de personal investigador (Ley de la Ciencia)',
    e: 'El personal Docente e Investigador: Ley 14/2011, de 1 de junio, de la Ciencia, la Tecnología y la Innovación: Sección 2.ª Contratación del personal investigador de carácter laboral.', leyes: [] },
  { n: 14, b: 2, t: 'PTGAS funcionario: provisión de puestos (UAL)',
    e: 'El Personal Técnico, de Gestión y de Administración y Servicios Funcionario: El Reglamento de provisión de puestos de trabajo del Personal Técnico, de Gestión y de Administración y Servicios de la Universidad de Almería.', leyes: [] },
  { n: 15, b: 2, t: 'Reglamento de Cartas de Servicio (UAL)',
    e: 'El Reglamento de Cartas de Servicio de la Universidad de Almería.', leyes: [] },
  { n: 16, b: 2, t: 'Organización de las enseñanzas universitarias y doctorado',
    e: 'Real Decreto 822/2021, de 28 de septiembre, por el que se establece la organización de las enseñanzas universitarias y del procedimiento de aseguramiento de su calidad: del Capítulo I al Capítulo VI y Capítulo VIII. Real Decreto 99/2011, de 28 enero, por el que se regulan las enseñanzas oficiales de doctorado.',
    leyes: [{ ley: 'RD 822/2021', arts: null }, { ley: 'RD 99/2011 Doctorado', arts: null }] },
  { n: 17, b: 2, t: 'Acceso y admisión a enseñanzas oficiales de Grado',
    e: 'Real Decreto 534/2024, de 11 de junio, por el que se regulan los requisitos de acceso a las enseñanzas universitarias oficiales de Grado, las características básicas de la prueba de acceso y la normativa básica de los procedimientos de admisión.',
    leyes: [{ ley: 'RD 534/2024', arts: null }] },
  { n: 18, b: 2, t: 'Matrícula en Grado, Máster y Doctorado (UAL)',
    e: 'Resolución sobre Matricula Oficial de los Estudios de Grado y Máster en la Universidad de Almería. Resolución sobre Matrícula en estudios de Doctorado en la Universidad de Almería. Resolución que regula los aspectos económicos de las matrículas en estudios oficiales en la Universidad de Almería.', leyes: [] },
  { n: 19, b: 2, t: 'Permanencia de estudiantes (UAL)',
    e: 'Normativa de permanencia de estudiantes en enseñanzas oficiales de la Universidad de Almería.', leyes: [] },
  { n: 20, b: 2, t: 'Expedición de títulos y Suplemento Europeo',
    e: 'Real Decreto 1002/2010, de 5 de agosto, sobre expedición de títulos Oficiales, Real Decreto 22/2015, de 23 de enero, por los que se establecen los requisitos de expedición por las Universidades del Suplemento Europeo al Título.',
    leyes: [{ ley: 'RD 1002/2010 Títulos', arts: null }, { ley: 'RD 22/2015', arts: null }] },
  { n: 21, b: 2, t: 'Créditos ECTS y sistema de calificaciones',
    e: 'Real Decreto 1125/2003, de 5 de septiembre, por el que se establece el sistema europeo de créditos y el sistema de calificaciones en las titulaciones universitarias de carácter oficial y validez en todo el territorio nacional.',
    leyes: [{ ley: 'RD 1125/2003', arts: null }] },
  { n: 22, b: 2, t: 'Política de Seguridad de la Información (UAL)',
    e: 'Protección de datos: Política de Seguridad de la Información en la Universidad de Almería (Aprobada en Consejo de Gobierno de 5 de noviembre de 2025). Normas de uso de los sistemas de información de la Universidad de Almería (Aprobada en Consejo de Gobierno de 15 de julio de 2024). Normas de información en materia de protección de datos en procesos de concurrencia competitiva de la Universidad de Almería (Aprobada en Consejo de Gobierno de 14 de febrero de 2023).', leyes: [] },
  { n: 23, b: 2, t: 'Reglamento de Administración Electrónica (UAL)',
    e: 'Reglamento de Administración Electrónica de la Universidad de Almería.', leyes: [] },

  // ── Bloque III. Informática ──
  { n: 24, b: 3, t: 'Microsoft 365: Excel y Word',
    e: 'Microsoft 365: Excel y Word.',
    leyes: [{ ley: 'Word 365', arts: null }, { ley: 'Excel 365', arts: null }] },
]

function r(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => String(a + i)) }

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    await c.query('BEGIN')
    const ya = await c.query('SELECT count(*)::int n FROM topics WHERE position_type=$1', [PT])
    if (ya.rows[0].n > 0) throw new Error(`ya hay ${ya.rows[0].n} temas para ${PT} — abortando para no duplicar`)

    // resolver law_id por short_name (exacto)
    const lawId = new Map()
    for (const row of (await c.query('SELECT id, short_name FROM laws')).rows) {
      if (!lawId.has(row.short_name)) lawId.set(row.short_name, row.id)
    }

    let conScope = 0, huecos = []
    for (const t of TEMAS) {
      const ins = await c.query(
        `INSERT INTO topics (position_type, topic_number, title, description, epigrafe,
                             descripcion_corta, bloque_number, display_number, is_active, disponible)
         VALUES ($1,$2,$3,$4,$4,$5,$6,$2,true,false) RETURNING id`,
        [PT, t.n, t.t, t.e, t.t, t.b])
      const topicId = ins.rows[0].id

      let enganchadas = 0
      for (const l of (t.leyes || [])) {
        const id = lawId.get(l.ley)
        if (!id) { console.log(`   ⚠️  T${t.n}: no encuentro la ley "${l.ley}" en BD`); continue }
        await c.query('INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES ($1,$2,$3,1.0)',
          [topicId, id, l.arts])
        enganchadas++
      }
      if (enganchadas) conScope++; else huecos.push(t.n)
      console.log(`· T${String(t.n).padStart(2)} [B${t.b}] ${enganchadas ? enganchadas + ' ley(es)' : '— HUECO'}  ${t.t}`)
    }

    console.log(`\nResumen: ${TEMAS.length} temas creados · ${conScope} con scope · ${huecos.length} huecos (T${huecos.join(', T')})`)
    console.log('Los temas quedan disponible=false y la oposición is_active=false: nada visible en web.')

    if (DRY) { await c.query('ROLLBACK'); console.log('\n--dry-run → ROLLBACK') }
    else { await c.query('COMMIT'); console.log('\n✅ COMMIT') }
  } catch (e) {
    await c.query('ROLLBACK'); console.error('❌ ROLLBACK:', e.message); process.exitCode = 1
  } finally { await c.end() }
}
main()
