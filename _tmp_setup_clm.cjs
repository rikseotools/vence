// _tmp_setup_clm.cjs - Setup completo de Auxiliar Administrativo CLM
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const { createClient } = require('/home/manuel/Documentos/github/vence/node_modules/@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function setup() {
  console.log('🚀 Setting up Auxiliar Administrativo CLM...\n')

  // 1. INSERT oposicion
  console.log('1️⃣ Insertando oposición...')
  const { data: opo, error: opoErr } = await supabase
    .from('oposiciones')
    .insert({
      slug: 'auxiliar-administrativo-clm',
      nombre: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
      short_name: 'Aux. CLM',
      grupo: 'C2',
      administracion: 'autonomica',
      tipo_acceso: 'libre',
      temas_count: 24,
      bloques_count: 2,
      titulo_requerido: 'Graduado en ESO',
      is_active: true,
      is_convocatoria_activa: true,
      plazas_libres: 234,
      plazas_discapacidad: 15,
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
      plazas_convocadas: 249,
      boe_fecha: '2024-12-18',
      boletin_oficial_url: 'https://docm.jccm.es/portaldocm/descargarArchivo.do?ruta=2024/12/18/pdf/2024_9911.pdf',
      pagina_informacion_url: 'https://empleopublico.castillalamancha.es/procesos-selectivos/abiertos/turno-libre/2023-2024-cuerpo-auxiliar-auxiliar-turno-libre',
      tipo_examen: 'test',
      fecha_examen: '2025-10-11',
      observaciones: 'Concurso-oposición (75+25 pts). Ejercicio único: 100 preguntas (50 org admin + 50 ofimática). DOCM 18/12/2024. Examen celebrado 11/10/2025.',
    })
    .select()

  if (convErr) console.error('⚠️ Error convocatoria:', convErr.message)
  else console.log('✅ Convocatoria creada:', conv[0]?.id)

  // 3. INSERT 24 topics
  console.log('\n3️⃣ Insertando 24 topics...')
  const topics = [
    { topic_number: 1, title: 'La Constitución Española de 1978', description: 'Estructura y contenido. Los principios constitucionales. Derechos y deberes fundamentales. La Corona. Las Cortes Generales. El Gobierno y la Administración. El Poder Judicial. El Tribunal Constitucional. La organización territorial del Estado.' },
    { topic_number: 2, title: 'Ley 39/2015 del Procedimiento Administrativo Común (I)', description: 'Disposiciones generales. Los interesados en el procedimiento. La actividad de las Administraciones Públicas. De los actos administrativos. Disposiciones sobre el procedimiento administrativo común. De la revisión de los actos en vía administrativa.' },
    { topic_number: 3, title: 'Ley 40/2015 de Régimen Jurídico del Sector Público (I)', description: 'Disposiciones generales. De los órganos de las Administraciones Públicas. De los principios de la potestad sancionadora. De la responsabilidad patrimonial de las Administraciones Públicas. Del funcionamiento electrónico del sector público. De los convenios.' },
    { topic_number: 4, title: 'Ley 40/2015 de Régimen Jurídico del Sector Público (II)', description: 'Relaciones interadministrativas. De las relaciones electrónicas entre las Administraciones. Principios de las relaciones interadministrativas. Deber de colaboración. Relaciones de cooperación.' },
    { topic_number: 5, title: 'Calidad de los servicios públicos en la JCCM', description: 'Calidad de los servicios públicos en la Junta de Comunidades de Castilla-La Mancha. Cartas de Servicios. Quejas y sugerencias.' },
    { topic_number: 6, title: 'Transparencia en la JCCM', description: 'Transparencia en la Junta de Comunidades de Castilla-La Mancha. Publicidad activa. Los archivos de Castilla-La Mancha.' },
    { topic_number: 7, title: 'Seguridad de la información y protección de datos', description: 'Seguridad de la información en soporte digital. La protección de datos de carácter personal. Régimen jurídico. Principios de la protección de datos. Derechos de las personas.' },
    { topic_number: 8, title: 'Personal al servicio de la JCCM', description: 'El personal al servicio de la Junta de Comunidades de Castilla-La Mancha. El Estatuto Básico del Empleado Público. Ley de Empleo Público de Castilla-La Mancha. Clases de personal. Derechos y deberes.' },
    { topic_number: 9, title: 'El presupuesto de la JCCM', description: 'El presupuesto de la Junta de Comunidades de Castilla-La Mancha. Ejecución del presupuesto de gastos. Las subvenciones públicas: concepto y tipos.' },
    { topic_number: 10, title: 'Estatuto de Autonomía de Castilla-La Mancha', description: 'El Estatuto de Autonomía de Castilla-La Mancha. La organización territorial de Castilla-La Mancha. La Administración Local. El Gobierno y la Administración regional.' },
    { topic_number: 11, title: 'CLM: características históricas, geográficas, culturales y económicas', description: 'Castilla-La Mancha: características históricas, geográficas, sociales, culturales y económicas.' },
    { topic_number: 12, title: 'Igualdad efectiva de mujeres y hombres', description: 'La igualdad efectiva de mujeres y hombres. Políticas públicas de igualdad.' },
    { topic_number: 13, title: 'Informática básica', description: 'Informática básica: conceptos fundamentales sobre el hardware y el software. Almacenamiento de datos. Sistemas operativos. Nociones básicas de seguridad informática.' },
    { topic_number: 14, title: 'Windows 10: entorno gráfico', description: 'Introducción al sistema operativo Windows 10. El entorno gráfico. Ventanas. El escritorio. El menú de Inicio. Configuración del sistema.' },
    { topic_number: 15, title: 'El Explorador de Windows', description: 'El Explorador de Windows. Carpetas y archivos. Búsqueda de archivos. Gestión de impresoras. Accesorios del sistema.' },
    { topic_number: 16, title: 'Word 2019 (I)', description: 'Procesadores de texto: Word 2019. Descripción del entorno de trabajo. Creación y gestión de documentos. Gestión de texto. Herramientas de escritura. Impresión de documentos. Gestión de archivos.' },
    { topic_number: 17, title: 'Word 2019 (II)', description: 'Procesadores de texto: Word 2019. Composición de un documento. Inserción de elementos. Combinación de correspondencia. Esquemas y tablas de contenido. Gráficos e imágenes.' },
    { topic_number: 18, title: 'Word 2019 (III)', description: 'Procesadores de texto: Word 2019. Personalización del entorno de trabajo. Configuración de opciones. Descripción de menús y funciones.' },
    { topic_number: 19, title: 'Excel 2019 (I)', description: 'Hojas de cálculo: Excel 2019. Descripción del entorno de trabajo. Libros y hojas. Celdas. Introducción y edición de datos. Formatos de datos y celdas. Fórmulas y funciones. Vínculos.' },
    { topic_number: 20, title: 'Excel 2019 (II)', description: 'Hojas de cálculo: Excel 2019. Gráficos. Gestión de datos. Análisis de datos.' },
    { topic_number: 21, title: 'Excel 2019 (III)', description: 'Hojas de cálculo: Excel 2019. Personalización del entorno de trabajo. Configuración de opciones. Descripción de menús y funciones.' },
    { topic_number: 22, title: 'Internet: protocolos y servicios', description: 'Internet: conceptos elementales sobre protocolos y servicios en Internet. Navegador Microsoft Edge 101. Navegador Google Chrome 105.' },
    { topic_number: 23, title: 'Outlook 2019', description: 'Correo electrónico: Outlook 2019. Mensajes. Administración y gestión de mensajes. Reglas de mensajes. Libreta de direcciones. Agenda y calendario.' },
    { topic_number: 24, title: 'OneDrive y Microsoft Teams', description: 'OneDrive y Microsoft Teams. Gestión de archivos. Trabajo colaborativo.' },
  ]

  for (const t of topics) {
    const { error } = await supabase
      .from('topics')
      .upsert({
        ...t,
        position_type: 'auxiliar_administrativo_clm',
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
    .eq('position_type', 'auxiliar_administrativo_clm')
    .order('topic_number')

  const topicMap = {}
  for (const t of dbTopics) topicMap[t.topic_number] = t.id

  const CE = '6ad91a6c-41ec-431f-9c80-5f5566834941'
  const LEY_39_2015 = '218452f5-b9f6-48f0-a25b-26df9cb19644'
  const LEY_40_2015 = '95680d57-feb1-41c0-bb27-236024815feb'
  const TREBEP = 'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0'
  const LEY_19_2013 = 'a7bd0e06-7dcb-4a25-911b-e16f6e5e0798'
  const LO_3_2018 = '146b7e50-e089-44a6-932c-773954f8d96b'
  const LO_3_2007 = '6e59eacd-9298-4164-9d78-9e9343d9a900'
  const LO_1_2004 = 'f5c17b23-2547-43d2-800c-39f5ea925c2f'
  const LEY_38_2003 = '09c18214-a630-4ae8-9f63-a742919f7f4c'

  const scopeEntries = [
    { topic_id: topicMap[1], law_id: CE, article_numbers: Array.from({length: 169}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[2], law_id: LEY_39_2015, article_numbers: Array.from({length: 133}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[3], law_id: LEY_40_2015, article_numbers: Array.from({length: 53}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[4], law_id: LEY_40_2015, article_numbers: Array.from({length: 19}, (_, i) => String(140 + i)) },
    { topic_id: topicMap[6], law_id: LEY_19_2013, article_numbers: Array.from({length: 40}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[7], law_id: LO_3_2018, article_numbers: Array.from({length: 97}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[8], law_id: TREBEP, article_numbers: Array.from({length: 100}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[9], law_id: LEY_38_2003, article_numbers: Array.from({length: 69}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[12], law_id: LO_3_2007, article_numbers: Array.from({length: 78}, (_, i) => String(i + 1)) },
    { topic_id: topicMap[12], law_id: LO_1_2004, article_numbers: Array.from({length: 72}, (_, i) => String(i + 1)) },
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

  console.log('\n🎉 Setup CLM completado!')
  console.log(`   - Oposición: ${opoId}`)
  console.log(`   - Topics: ${topics.length}`)
  console.log(`   - Topic scopes: ${scopeEntries.length}`)
}

setup().catch(console.error)
