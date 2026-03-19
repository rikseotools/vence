// _tmp_setup_ext.cjs - Setup completo de Auxiliar Administrativo Extremadura
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setup() {
  console.log('🚀 Setting up Auxiliar Administrativo Extremadura...\n')

  // 1. INSERT oposicion
  console.log('1️⃣ Insertando oposición...')
  const { data: opo, error: opoErr } = await supabase
    .from('oposiciones')
    .insert({
      slug: 'auxiliar-administrativo-extremadura',
      nombre: 'Auxiliar Administrativo Junta de Extremadura',
      short_name: 'Aux. Extremadura',
      grupo: 'C2',
      administracion: 'autonomica',
      tipo_acceso: 'libre',
      temas_count: 25,
      bloques_count: 2,
      titulo_requerido: 'Graduado en ESO',
      is_active: true,
      is_convocatoria_activa: true,
      plazas_libres: 126,
      plazas_discapacidad: 20,
    })
    .select()

  if (opoErr) { console.error('❌ Error oposición:', opoErr.message); return }
  const opoId = opo[0].id
  console.log('✅ Oposición creada:', opoId)

  // 2. INSERT convocatoria
  console.log('\n2️⃣ Insertando convocatoria...')
  const { data: conv, error: convErr } = await supabase
    .from('convocatorias')
    .insert({
      oposicion_id: opoId,
      año: 2024,
      plazas_convocadas: 146,
      boe_fecha: '2024-12-27',
      boletin_oficial_url: 'https://doe.juntaex.es/pdfs/doe/2024/2500o/24050213.pdf',
      pagina_informacion_url: 'https://www.juntaex.es/temas/trabajo-y-empleo/empleo-publico/buscador-de-empleo-publico/-/convocatoria/1519',
      tipo_examen: 'test',
      observaciones: 'Concurso-oposición (10+3 pts). Ejercicio único teórico-práctico: 43 preguntas (35 teóricas + 8 prácticas ofimática), 85 min. DOE 250 27/12/2024 (bases). DOE 244 19/12/2025 (acumulación OEP 2021+2022+2023). 146 plazas (126 libre + 20 discapacidad).',
    })
    .select()

  if (convErr) console.error('⚠️ Error convocatoria:', convErr.message)
  else console.log('✅ Convocatoria creada:', conv[0]?.id)

  // 3. INSERT 25 topics
  console.log('\n3️⃣ Insertando 25 topics...')
  const topics = [
    { topic_number: 1, title: 'Gobierno y Administración de la CAE (I)', description: 'Estructura del Estatuto de Autonomía de Extremadura. Título Preliminar: Disposiciones generales. El Presidente de la Junta de Extremadura. La Junta de Extremadura.' },
    { topic_number: 2, title: 'Gobierno y Administración de la CAE (II)', description: 'Los miembros de la Junta de Extremadura. Las relaciones entre la Asamblea y la Junta de Extremadura. Principios generales de la Administración Pública de la Comunidad Autónoma de Extremadura. Los órganos administrativos de la CAE. Las oficinas de registro y atención al ciudadano.' },
    { topic_number: 3, title: 'TREBEP', description: 'Objeto y ámbito de aplicación. Clases de personal al servicio de las Administraciones Públicas. Derechos individuales. Derecho a la carrera profesional y a la promoción interna. La evaluación del desempeño. Derechos retributivos.' },
    { topic_number: 4, title: 'Función Pública de Extremadura (I)', description: 'Objeto, principios informadores y ámbito de aplicación. Órganos superiores en materia de función pública. Personal al servicio de la Administración de la CAE. Ordenación de los recursos humanos.' },
    { topic_number: 5, title: 'Función Pública de Extremadura (II)', description: 'Adquisición y pérdida de la condición de funcionario. Acceso al empleo público. Situaciones administrativas.' },
    { topic_number: 6, title: 'Función Pública de Extremadura (III)', description: 'Derechos de los funcionarios. Jornada de trabajo, permisos y vacaciones.' },
    { topic_number: 7, title: 'Función Pública de Extremadura (IV)', description: 'Promoción profesional y evaluación del desempeño. Provisión de puestos de trabajo y movilidad.' },
    { topic_number: 8, title: 'Función Pública de Extremadura (V)', description: 'Retribuciones. Deberes de los funcionarios. Código de conducta. Incompatibilidades.' },
    { topic_number: 9, title: 'Función Pública de Extremadura (VI)', description: 'La formación en la Administración Pública. Régimen disciplinario.' },
    { topic_number: 10, title: 'Personal Laboral - Convenio Colectivo (I)', description: 'Ámbito de aplicación. Organización del trabajo. Clasificación del personal. Retribuciones.' },
    { topic_number: 11, title: 'Personal Laboral - Convenio Colectivo (II)', description: 'Movilidad. Puestos de trabajo. Permutas. Provisión de puestos. Jornada de trabajo.' },
    { topic_number: 12, title: 'Personal Laboral - Convenio Colectivo (III)', description: 'Horas extraordinarias. Vacaciones. Permisos y licencias. Conciliación de la vida familiar y laboral. Régimen disciplinario.' },
    { topic_number: 13, title: 'Prevención de riesgos laborales', description: 'Objeto, ámbito de aplicación y definiciones. Derechos y obligaciones.' },
    { topic_number: 14, title: 'Igualdad y violencia de género en Extremadura', description: 'Igualdad efectiva de mujeres y hombres. Medidas contra la violencia de género en Extremadura.' },
    { topic_number: 15, title: 'Régimen Jurídico del Sector Público (I)', description: 'Disposiciones generales. De los órganos de las Administraciones Públicas. De los convenios. De las relaciones interadministrativas.' },
    { topic_number: 16, title: 'Régimen Jurídico del Sector Público (II)', description: 'De los principios de la potestad sancionadora. De la responsabilidad patrimonial de las Administraciones Públicas.' },
    { topic_number: 17, title: 'LPAC (I)', description: 'Disposiciones generales. De los interesados en el procedimiento.' },
    { topic_number: 18, title: 'LPAC (II)', description: 'De la actividad de las Administraciones Públicas. De los actos administrativos.' },
    { topic_number: 19, title: 'LPAC (III)', description: 'Disposiciones sobre el procedimiento administrativo común. De la revisión de los actos en vía administrativa. De la iniciativa legislativa y de la potestad para dictar reglamentos y otras disposiciones.' },
    { topic_number: 20, title: 'Contratación del Sector Público', description: 'Disposiciones generales. Tipos de contratos del sector público.' },
    { topic_number: 21, title: 'Documento, registro y archivo', description: 'Funciones del registro de entrada y salida de documentos. Clases de documentos. Gestión de archivos. Nuevas tecnologías aplicadas a la gestión documental.' },
    { topic_number: 22, title: 'Administración electrónica de Extremadura (I)', description: 'Disposiciones generales. Puntos de acceso electrónico. Registro electrónico.' },
    { topic_number: 23, title: 'Administración electrónica de Extremadura (II)', description: 'Expediente electrónico. Comunicaciones y notificaciones electrónicas.' },
    { topic_number: 24, title: 'Windows 10', description: 'Entorno de trabajo. Explorador de archivos. Gestión de carpetas y archivos. Correo electrónico. Seguridad informática básica.' },
    { topic_number: 25, title: 'Office 365: Word y Excel', description: 'Procesador de textos Word. Hoja de cálculo Excel. Funciones básicas y avanzadas.' },
  ]

  for (const t of topics) {
    const { error } = await supabase
      .from('topics')
      .upsert({
        ...t,
        position_type: 'auxiliar_administrativo_extremadura',
        is_active: true,
      }, { onConflict: 'position_type,topic_number' })

    if (error) console.error(`❌ Error topic ${t.topic_number}:`, error.message)
    else console.log(`  ✅ Topic ${t.topic_number}: ${t.title}`)
  }

  // 4. INSERT topic_scope
  console.log('\n4️⃣ Insertando topic_scope...')

  const { data: dbTopics } = await supabase
    .from('topics')
    .select('id, topic_number')
    .eq('position_type', 'auxiliar_administrativo_extremadura')
    .order('topic_number')

  const topicMap = {}
  for (const t of dbTopics) topicMap[t.topic_number] = t.id

  // Law IDs
  const TREBEP = 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0'
  const LPRL = '8b1ae300-4ed3-4019-876c-780ea40ebbfe'
  const LEY_39_2015 = '218452f5-b9f6-48f0-a25b-26df9cb19644'
  const LEY_40_2015 = '95680d57-feb1-41c0-bb27-236024815feb'
  const LEY_9_2017 = '4f605392-8137-4962-9e66-ca5f275e93ee'
  const INFORMATICA_BASICA = '82fd3977-ecf7-4f36-a6df-95c41445d3c2'
  const WINDOWS_11 = '932efcfb-5dce-4bcc-9c6c-55eab19752b0'
  const EXPLORADOR = '9c0b25a4-c819-478c-972f-ee462d724a40'
  const WORD = '86f671a9-4fd8-42e6-91db-694f27eb4292'
  const EXCEL = 'c7475712-5ae4-4bec-9bd5-ff646c378e33'
  const CORREO = 'c9df042b-15df-4285-affb-6c93e2a71139'

  const scopeEntries = [
    // T3: TREBEP arts 1-12, 14-30
    { topic_id: topicMap[3], law_id: TREBEP, article_numbers: [...Array.from({length: 12}, (_, i) => String(i + 1)), ...Array.from({length: 17}, (_, i) => String(i + 14))] },
    // T13: LPRL arts 1-4, 14-29
    { topic_id: topicMap[13], law_id: LPRL, article_numbers: [...Array.from({length: 4}, (_, i) => String(i + 1)), ...Array.from({length: 16}, (_, i) => String(i + 14))] },
    // T15: Ley 40/2015 arts 1-22, 47-53, 140-158
    { topic_id: topicMap[15], law_id: LEY_40_2015, article_numbers: [...Array.from({length: 22}, (_, i) => String(i + 1)), ...Array.from({length: 7}, (_, i) => String(i + 47)), ...Array.from({length: 19}, (_, i) => String(i + 140))] },
    // T16: Ley 40/2015 arts 25-37
    { topic_id: topicMap[16], law_id: LEY_40_2015, article_numbers: Array.from({length: 13}, (_, i) => String(i + 25)) },
    // T17: Ley 39/2015 arts 1-12
    { topic_id: topicMap[17], law_id: LEY_39_2015, article_numbers: Array.from({length: 12}, (_, i) => String(i + 1)) },
    // T18: Ley 39/2015 arts 13-52
    { topic_id: topicMap[18], law_id: LEY_39_2015, article_numbers: Array.from({length: 40}, (_, i) => String(i + 13)) },
    // T19: Ley 39/2015 arts 53-95, 106-133
    { topic_id: topicMap[19], law_id: LEY_39_2015, article_numbers: [...Array.from({length: 43}, (_, i) => String(i + 53)), ...Array.from({length: 28}, (_, i) => String(i + 106))] },
    // T20: Ley 9/2017 arts 1-38
    { topic_id: topicMap[20], law_id: LEY_9_2017, article_numbers: Array.from({length: 38}, (_, i) => String(i + 1)) },
    // T24: Windows 11, Explorador, Correo, Informática Básica (virtual laws, no articles)
    { topic_id: topicMap[24], law_id: WINDOWS_11, article_numbers: null },
    { topic_id: topicMap[24], law_id: EXPLORADOR, article_numbers: null },
    { topic_id: topicMap[24], law_id: CORREO, article_numbers: null },
    { topic_id: topicMap[24], law_id: INFORMATICA_BASICA, article_numbers: null },
    // T25: Word, Excel (virtual laws, no articles)
    { topic_id: topicMap[25], law_id: WORD, article_numbers: null },
    { topic_id: topicMap[25], law_id: EXCEL, article_numbers: null },
  ]

  for (const scope of scopeEntries) {
    if (!scope.topic_id) {
      console.error('❌ topic_id missing for scope entry')
      continue
    }
    const { error } = await supabase
      .from('topic_scope')
      .upsert(scope, { onConflict: 'topic_id,law_id' })

    if (error) console.error(`❌ Error scope:`, error.message)
    else {
      const tn = Object.entries(topicMap).find(([k,v]) => v === scope.topic_id)?.[0]
      console.log(`  ✅ Scope: topic ${tn} → law ${scope.law_id.substring(0,8)}...`)
    }
  }

  console.log('\n🎉 Setup Extremadura completado!')
  console.log(`   - Oposición: ${opoId}`)
  console.log(`   - Topics: ${topics.length}`)
  console.log(`   - Topic scopes: ${scopeEntries.length}`)
}

setup().catch(console.error)
