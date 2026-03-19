// _tmp_setup_gva.cjs - Setup completo de Auxiliar Administrativo Generalitat Valenciana
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper to generate article number ranges
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => String(start + i))
}

async function setup() {
  console.log('Setting up Auxiliar Administrativo Generalitat Valenciana...\n')

  // 0. Check if oposicion already exists
  const { data: existing } = await supabase
    .from('oposiciones')
    .select('id')
    .eq('slug', 'auxiliar-administrativo-valencia')
    .maybeSingle()

  if (existing) {
    console.log('Oposicion already exists with id:', existing.id)
    console.log('Aborting to avoid duplicates. Delete it first if you want to re-create.')
    return
  }

  // 1. INSERT oposicion
  console.log('1. Insertando oposicion...')
  const { data: opo, error: opoErr } = await supabase
    .from('oposiciones')
    .insert({
      slug: 'auxiliar-administrativo-valencia',
      nombre: 'Auxiliar Administrativo Generalitat Valenciana',
      short_name: 'Aux. Valencia',
      grupo: 'C2',
      administracion: 'autonomica',
      tipo_acceso: 'libre',
      temas_count: 24,
      bloques_count: 2,
      titulo_requerido: 'Graduado en ESO',
      is_active: true,
      is_convocatoria_activa: true,
      plazas_libres: 245,
    })
    .select()

  if (opoErr) {
    console.error('Error oposicion:', opoErr.message)
    return
  }
  const opoId = opo[0].id
  console.log('  Oposicion creada:', opoId)

  // 2. INSERT convocatoria
  console.log('\n2. Insertando convocatoria...')
  const { data: conv, error: convErr } = await supabase
    .from('convocatorias')
    .insert({
      oposicion_id: opoId,
      año: 2026,
      plazas_convocadas: 245,
      boletin_oficial_url: 'https://dogv.gva.es/datos/2025/04/15/pdf/2025_11825_es.pdf',
      pagina_informacion_url: 'https://sede.gva.es/es/detall-ocupacio-publica?id_emp=93025',
      tipo_examen: 'ordinaria',
      observaciones: 'OPE 2026 - Auxiliar Administrativo Generalitat Valenciana. 245 plazas.',
    })
    .select()

  if (convErr) console.error('  Error convocatoria:', convErr.message)
  else console.log('  Convocatoria creada:', conv[0]?.id)

  // 3. INSERT 24 topics
  console.log('\n3. Insertando 24 topics...')
  const topics = [
    { topic_number: 1, title: 'CE: Titulo Preliminar, Titulo I Derechos y Deberes, Titulo X Reforma', description: 'Constitucion Espanola: Titulo Preliminar, Titulo I Derechos y deberes fundamentales, Titulo X Reforma constitucional.' },
    { topic_number: 2, title: 'CE: Titulo II Corona, Titulo III Cortes Generales (Cap. I-II)', description: 'Constitucion Espanola: Titulo II De la Corona, Titulo III De las Cortes Generales (Capitulos I y II).' },
    { topic_number: 3, title: 'CE: Titulo IV Gobierno y Administracion, Titulo V Relaciones Gobierno-Cortes', description: 'Constitucion Espanola: Titulo IV Del Gobierno y de la Administracion, Titulo V De las relaciones entre el Gobierno y las Cortes Generales.' },
    { topic_number: 4, title: 'CE: Titulo VI Poder Judicial, Titulo IX Tribunal Constitucional', description: 'Constitucion Espanola: Titulo VI Del Poder Judicial, Titulo IX Del Tribunal Constitucional.' },
    { topic_number: 5, title: 'CE: Titulo VIII Organizacion territorial del Estado', description: 'Constitucion Espanola: Titulo VIII De la organizacion territorial del Estado.' },
    { topic_number: 6, title: 'Estatuto de Autonomia de la Comunitat Valenciana', description: 'Estatuto de Autonomia de la Comunitat Valenciana (Ley Organica 5/1982).' },
    { topic_number: 7, title: 'Ley 5/1983 del Consell (I): President, composicion, atribuciones', description: 'Ley 5/1983 de 30 de diciembre, del Consell. Parte I: El President de la Generalitat, composicion y atribuciones del Consell.' },
    { topic_number: 8, title: 'Ley 5/1983 del Consell (II): Consellerias, estatuto personal', description: 'Ley 5/1983 de 30 de diciembre, del Consell. Parte II: Las Consellerias, estatuto personal de los miembros del Consell.' },
    { topic_number: 9, title: 'Derecho de la UE: Primario y Derivado', description: 'Derecho de la Union Europea: Derecho primario (Tratados) y Derecho derivado (Reglamentos, Directivas, Decisiones).' },
    { topic_number: 10, title: 'Igualdad: LO 3/2007, Ley 9/2003 GVA, LO 1/2004 violencia genero', description: 'LO 3/2007 para la igualdad efectiva de mujeres y hombres, Ley 9/2003 de la Generalitat Valenciana para la igualdad, LO 1/2004 de violencia de genero.' },
    { topic_number: 11, title: 'Ley 39/2015 (I): Disposiciones generales, interesados, actividad AAPP', description: 'Ley 39/2015 del Procedimiento Administrativo Comun. Parte I: Disposiciones generales, los interesados, la actividad de las AAPP.' },
    { topic_number: 12, title: 'Ley 39/2015 (II): Actos administrativos', description: 'Ley 39/2015 del Procedimiento Administrativo Comun. Parte II: De los actos administrativos (requisitos, eficacia, nulidad, anulabilidad). Disposiciones sobre el procedimiento (garantias, tramites, finalizacion, ejecucion).' },
    { topic_number: 13, title: 'Ley 39/2015 (III): Nulidad y anulabilidad', description: 'Ley 39/2015 del Procedimiento Administrativo Comun. Parte III: Nulidad y anulabilidad de los actos administrativos.' },
    { topic_number: 14, title: 'Ley 39/2015 (IV): Procedimiento administrativo comun', description: 'Ley 39/2015 del Procedimiento Administrativo Comun. Parte IV: Disposiciones sobre el procedimiento administrativo comun (garantias, ordenacion, instruccion, finalizacion, ejecucion).' },
    { topic_number: 15, title: 'Ley 39/2015 (V): Revision en via administrativa', description: 'Ley 39/2015 del Procedimiento Administrativo Comun. Parte V: De la revision de los actos en via administrativa (revision de oficio, recursos administrativos).' },
    { topic_number: 16, title: 'Organos AAPP: competencia, delegacion, desconcentracion, avocacion', description: 'Ley 40/2015 de Regimen Juridico del Sector Publico. Organos administrativos: competencia, abstención, recusacion, delegacion, desconcentracion, avocacion.' },
    { topic_number: 17, title: 'Contratos del Sector Publico: tipos, partes, objeto, precio', description: 'Ley 9/2017 de Contratos del Sector Publico. Tipos de contratos, partes, objeto, precio y cuantia.' },
    { topic_number: 18, title: 'Admin electronica CV + Proteccion de datos (RGPD, LOPDGDD)', description: 'Administracion electronica en la Comunitat Valenciana. Proteccion de datos personales: RGPD y LO 3/2018 LOPDGDD.' },
    { topic_number: 19, title: 'Funcion Publica Valenciana (I): Ley 4/2021', description: 'Ley 4/2021 de la Funcion Publica Valenciana. Parte I: Disposiciones generales, clases de personal, acceso al empleo publico.' },
    { topic_number: 20, title: 'Funcion Publica Valenciana (II): Situaciones, derechos, deberes', description: 'Ley 4/2021 de la Funcion Publica Valenciana. Parte II: Situaciones administrativas, derechos y deberes de los empleados publicos.' },
    { topic_number: 21, title: 'Presupuestos: concepto, principios, ciclo', description: 'Los presupuestos: concepto, principios presupuestarios, ciclo presupuestario.' },
    { topic_number: 22, title: 'Ejecucion presupuestaria: fases gasto, ordenacion pagos', description: 'Ejecucion presupuestaria: fases del procedimiento de gasto, ordenacion de pagos.' },
    { topic_number: 23, title: 'Gestion presupuestaria GVA', description: 'Gestion presupuestaria de la Generalitat Valenciana.' },
    { topic_number: 24, title: 'LibreOffice 6.1: Writer, Calc, Base para Windows 10', description: 'LibreOffice 6.1: Writer, Calc y Base. Entorno de trabajo en Windows 10.' },
  ]

  for (const t of topics) {
    const { error } = await supabase
      .from('topics')
      .upsert({
        ...t,
        position_type: 'auxiliar_administrativo_valencia',
        is_active: true,
      }, { onConflict: 'position_type,topic_number' })

    if (error) console.error(`  Error topic ${t.topic_number}:`, error.message)
    else console.log(`  Topic ${t.topic_number}: ${t.title}`)
  }

  // 4. INSERT topic_scope
  console.log('\n4. Insertando topic_scope...')

  // Fetch the newly created topics to get their IDs
  const { data: dbTopics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, topic_number')
    .eq('position_type', 'auxiliar_administrativo_valencia')
    .order('topic_number')

  if (topicsErr) {
    console.error('  Error fetching topics:', topicsErr.message)
    return
  }

  const topicMap = {}
  for (const t of dbTopics) topicMap[t.topic_number] = t.id

  // Law IDs
  const CE = '6ad91a6c-41ec-431f-9c80-5f5566834941'
  const LO_3_2007 = '6e59eacd-9298-4164-9d78-9e9343d9a900'
  const LO_1_2004 = 'f5c17b23-2547-43d2-800c-39f5ea925c2f'
  const LEY_39_2015 = '218452f5-b9f6-48f0-a25b-26df9cb19644'
  const LEY_40_2015 = '95680d57-feb1-41c0-bb27-236024815feb'
  const LEY_9_2017 = '4f605392-8137-4962-9e66-ca5f275e93ee'
  const LO_3_2018 = '146b7e50-e089-44a6-932c-773954f8d96b'

  const scopeEntries = [
    // Topic 1: CE arts 1-55, 166-169
    { topic_id: topicMap[1], law_id: CE, article_numbers: [...range(1, 55), ...range(166, 169)] },
    // Topic 2: CE arts 56-92
    { topic_id: topicMap[2], law_id: CE, article_numbers: range(56, 92) },
    // Topic 3: CE arts 97-116
    { topic_id: topicMap[3], law_id: CE, article_numbers: range(97, 116) },
    // Topic 4: CE arts 117-127, 159-165
    { topic_id: topicMap[4], law_id: CE, article_numbers: [...range(117, 127), ...range(159, 165)] },
    // Topic 5: CE arts 137-158
    { topic_id: topicMap[5], law_id: CE, article_numbers: range(137, 158) },
    // Topic 10: LO 3/2007 arts 1-14
    { topic_id: topicMap[10], law_id: LO_3_2007, article_numbers: range(1, 14) },
    // Topic 10: LO 1/2004 arts 1-3
    { topic_id: topicMap[10], law_id: LO_1_2004, article_numbers: range(1, 3) },
    // Topic 11: Ley 39/2015 arts 1-33
    { topic_id: topicMap[11], law_id: LEY_39_2015, article_numbers: range(1, 33) },
    // Topic 12: Ley 39/2015 arts 34-52, 97-105
    { topic_id: topicMap[12], law_id: LEY_39_2015, article_numbers: [...range(34, 52), ...range(97, 105)] },
    // Topic 13: Ley 39/2015 arts 47-52
    { topic_id: topicMap[13], law_id: LEY_39_2015, article_numbers: range(47, 52) },
    // Topic 14: Ley 39/2015 arts 53-95
    { topic_id: topicMap[14], law_id: LEY_39_2015, article_numbers: range(53, 95) },
    // Topic 15: Ley 39/2015 arts 106-126
    { topic_id: topicMap[15], law_id: LEY_39_2015, article_numbers: range(106, 126) },
    // Topic 16: Ley 40/2015 arts 1-24
    { topic_id: topicMap[16], law_id: LEY_40_2015, article_numbers: range(1, 24) },
    // Topic 17: Ley 9/2017 arts 1-38
    { topic_id: topicMap[17], law_id: LEY_9_2017, article_numbers: range(1, 38) },
    // Topic 18: LO 3/2018 arts 1-18
    { topic_id: topicMap[18], law_id: LO_3_2018, article_numbers: range(1, 18) },
  ]

  for (const scope of scopeEntries) {
    if (!scope.topic_id) {
      console.error('  Error: topic_id missing for scope entry (law:', scope.law_id, ')')
      continue
    }
    const { error } = await supabase
      .from('topic_scope')
      .insert(scope)

    if (error) console.error(`  Error scope:`, error.message)
    else {
      const tn = Object.entries(topicMap).find(([k, v]) => v === scope.topic_id)?.[0]
      console.log(`  Scope: topic ${tn} -> law ${scope.law_id.substring(0, 8)}... (${scope.article_numbers ? scope.article_numbers.length + ' arts' : 'full'})`)
    }
  }

  // 5. Summary
  console.log('\n--- Setup completado ---')
  console.log(`  Oposicion ID: ${opoId}`)
  console.log(`  Topics insertados: ${topics.length}`)
  console.log(`  Topic scopes insertados: ${scopeEntries.length}`)
  console.log(`  Topics sin scope (6,7,8,9,19,20,21,22,23,24): leyes autonómicas/específicas pendientes de alta en DB`)
}

setup().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
