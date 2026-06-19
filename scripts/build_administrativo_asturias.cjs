// scripts/build_administrativo_asturias.cjs
// FASE 2 + FASE 3 del manual crear-nueva-oposicion: Cuerpo Administrativo (C1)
// de la Administración del Principado de Asturias.
// Fuente del programa: BOPA núm. 248, 24-XII-2024 (ref 2024-11213), Anexo I.
// Idempotente: borra topics/scope/bloques previos de la oposición y reinserta.
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const reuse = require('/tmp/asturias_c1_reuse.json')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const POS = 'administrativo_asturias'
const OPID = 'fae6282f-5796-4d63-bbbe-b7f2157aafb2'
const AUX = 'auxiliar_administrativo_asturias'
const EST = 'administrativo_estado'
const GAL = 'administrativo_galicia'

// Virtuales/explícitas resueltas por id
const LAW = {
  LEF: '5cea3473-4755-430b-9775-f521ac9ba3f4',
  WIN10: 'cb536623-fb75-429c-a839-0154b76ee27b',
  EXPWIN10: '9a4d819f-50d6-421b-b3ea-d66d72b8524b',
  WORD365: '86f671a9-4fd8-42e6-91db-694f27eb4292',
  EXCEL365: 'c7475712-5ae4-4bec-9bd5-ff646c378e33',
  OUTLOOK365: 'c9df042b-15df-4285-affb-6c93e2a71139',
  L40: null, // se resuelve abajo (para arts explícitos del sancionador)
}

// copia article_numbers de un tema fuente para una ley concreta
function from(pos, tn, lawShort) {
  const t = reuse[pos][String(tn)]
  if (!t) throw new Error(`fuente ${pos} T${tn} no existe`)
  const sc = t.scopes.find((x) => x.law === lawShort)
  if (!sc) throw new Error(`ley "${lawShort}" no está en ${pos} T${tn}`)
  return { law_id: sc.law_id, article_numbers: sc.arts }
}
function lit(law_id, article_numbers) { return { law_id, article_numbers } }

// ── ESPECIFICACIÓN DE LOS 38 TEMAS (epígrafes literales BOPA Anexo I) ──
const TOPICS = [
  // BLOQUE I — Derecho Constitucional y Organización Administrativa
  { tn: 1, b: 1, title: 'La Constitución Española de 1978 (I)',
    epi: 'La Constitución española de 1978 (I): Título Preliminar; De los derechos y deberes fundamentales (Título I).',
    scope: [() => from(AUX, 1, 'CE')] },
  { tn: 2, b: 1, title: 'La Constitución Española de 1978 (II)',
    epi: 'La Constitución española de 1978 (II): De la Corona (Título II); De las Cortes Generales (Título III); Del Gobierno y de la Administración (Título IV); De las relaciones entre el Gobierno y las Cortes Generales (Título V).',
    scope: [() => from(AUX, 2, 'CE')] },
  { tn: 3, b: 1, title: 'La Constitución Española de 1978 (III)',
    epi: 'La Constitución española de 1978 (III): Del Poder Judicial (Título VI). De la organización territorial del Estado (Título VIII). Del Tribunal Constitucional (Título IX); De la reforma constitucional (Título X).',
    scope: [() => from(AUX, 3, 'CE')] },
  { tn: 4, b: 1, title: 'La Administración General del Estado',
    epi: 'La regulación de la Administración General del Estado en la Ley 40/2015, de Régimen Jurídico del Sector Público: Organización administrativa; Los Ministerios y su estructura interna; Órganos territoriales; De la Administración General del Estado en el exterior (Título I).',
    scope: [() => from(AUX, 4, 'Ley 40/2015')] },
  { tn: 5, b: 1, title: 'El Estatuto de Autonomía del Principado de Asturias',
    epi: 'El Estatuto de Autonomía del Principado de Asturias: Título Preliminar; competencias (Título I); órganos institucionales (Título II); órganos auxiliares (Título II.bis); Administración de Justicia (Título III); Hacienda y Economía (Título IV); control sobre la actividad de los órganos del Principado (Título V); reforma del Estatuto (Título VI).',
    scope: [() => from(AUX, 5, 'LO 7/1981 Estatuto Asturias')] },
  { tn: 6, b: 1, title: 'El Presidente, el Consejo de Gobierno y la Organización de la Administración del Principado',
    epi: 'La Ley del Principado de Asturias 6/1984, de 5 de julio, del Presidente y del Consejo de Gobierno. La Ley del Principado de Asturias 8/1991, de 30 de julio, de Organización de la Administración.',
    scope: [() => from(AUX, 6, 'Ley 6/1984 Asturias'), () => from(AUX, 6, 'Ley 8/1991 Asturias')] },
  { tn: 7, b: 1, title: 'La Administración Local',
    epi: 'La Ley 7/1985, de 2 de abril, reguladora de las Bases del Régimen Local (Títulos I a IV). La Administración Local en Asturias: Concejos, Comarcas, Mancomunidades y Parroquias.',
    scope: [() => from(EST, 10, 'Ley 7/1985')] },

  // BLOQUE II — Derecho Administrativo y Comunitario
  { tn: 201, b: 2, title: 'La Unión Europea: instituciones y fuentes del derecho comunitario',
    epi: 'El Tratado de la Unión Europea: Disposiciones sobre las instituciones (Título III). Efectos de las fuentes del derecho comunitario: Tratados, Reglamentos, Directivas y Decisiones.',
    scope: [() => from(EST, 11, 'TUE')] },
  { tn: 202, b: 2, title: 'Las fuentes del derecho administrativo',
    epi: 'Fuentes del derecho administrativo: La Constitución como norma jurídica. Leyes orgánicas y ordinarias. El decreto legislativo. El decreto-ley. El Reglamento: concepto, clases y límites.',
    scope: [() => from(EST, 301, 'CE')] },
  { tn: 203, b: 2, title: 'La Ley 39/2015, del Procedimiento Administrativo Común',
    epi: 'La Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común de las Administraciones Públicas (Títulos Preliminar a V).',
    scope: [() => from(AUX, 7, 'Ley 39/2015')] },
  { tn: 204, b: 2, title: 'La Ley 40/2015, de Régimen Jurídico del Sector Público',
    epi: 'La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público: Disposiciones generales; órganos; funcionamiento electrónico; relaciones interadministrativas.',
    scope: [() => from(AUX, 8, 'Ley 40/2015')] },
  { tn: 205, b: 2, title: 'El Régimen Jurídico de la Administración del Principado de Asturias',
    epi: 'La Ley 2/1995, de 13 de marzo, sobre Régimen Jurídico de la Administración del Principado de Asturias.',
    scope: [() => from(AUX, 9, 'Ley 2/1995 Asturias')] },
  { tn: 206, b: 2, title: 'Los Contratos del Sector Público',
    epi: 'Legislación sobre Contratos del Sector Público: objeto y ámbito; tipos contractuales; configuración general y elementos; partes del contrato; objeto, presupuesto y precio; procedimientos de adjudicación (abierto, restringido, con negociación).',
    scope: [() => from(EST, 304, 'Ley 9/2017')] },
  { tn: 207, b: 2, title: 'Las formas de la actividad administrativa. Las subvenciones',
    epi: 'Formas de la actividad administrativa: policía, fomento y servicio público. La Ley 38/2003, de 17 de noviembre, General de Subvenciones (Títulos preliminar y I). El Decreto 71/1992 del Principado de Asturias.',
    scope: [() => from(EST, 305, 'Ley 40/2015'), () => from(EST, 305, 'Ley 38/2003')] },
  { tn: 208, b: 2, title: 'La potestad sancionadora de la Administración',
    epi: 'La potestad sancionadora de la Administración: principios en la Ley 40/2015. El Reglamento del procedimiento sancionador general en la Administración del Principado de Asturias.',
    scope: [() => lit(LAW.L40, ['25', '26', '27', '28', '29', '30', '31'])] },
  { tn: 209, b: 2, title: 'La responsabilidad patrimonial de las Administraciones Públicas',
    epi: 'La responsabilidad patrimonial de las Administraciones Públicas: encuadre constitucional y regulación en la Ley 40/2015.',
    scope: [() => from(EST, 306, 'Ley 40/2015'), () => from(EST, 306, 'Ley 39/2015')] },
  { tn: 210, b: 2, title: 'La expropiación forzosa',
    epi: 'La Ley de Expropiación Forzosa: Principios Generales (Título I) y Procedimiento general (Título II).',
    scope: [() => lit(LAW.LEF, null)] },
  { tn: 211, b: 2, title: 'La documentación administrativa',
    epi: 'La documentación administrativa. El Decreto 21/1996 (archivos administrativos); el Decreto 89/2017 (Título II); el Decreto 111/2005 (registro telemático).',
    scope: [
      () => from(AUX, 18, 'D 21/1996 Asturias Archivos'),
      () => from(AUX, 18, 'D 89/2017 Asturias Atención Ciudadana'),
      () => from(AUX, 18, 'D 111/2005 Asturias Registro Telemático'),
    ] },
  { tn: 212, b: 2, title: 'El Servicio de Atención Ciudadana del Principado de Asturias',
    epi: 'El Servicio de Atención Ciudadana de la Administración del Principado de Asturias. El Decreto 89/2017 (Título I); información general y particular (Cap. I del RD 208/1996); el Decreto 61/2014 (cartas de servicios).',
    scope: [
      () => from(AUX, 17, 'D 89/2017 Asturias Atención Ciudadana'),
      () => from(AUX, 17, 'RD 208/1996'),
      () => from(AUX, 17, 'D 61/2014 Asturias Cartas Servicios'),
    ] },
  { tn: 213, b: 2, title: 'La protección de datos de carácter personal',
    epi: 'La protección de datos de carácter personal: previsión constitucional. La Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (Títulos I a IV, Cap. I) y el Reglamento (UE) 2016/679.',
    scope: [() => from(EST, 204, 'LO 3/2018'), () => from(EST, 204, 'RGPD UE 2016/679')] },
  { tn: 214, b: 2, title: 'La transparencia, acceso a la información pública y buen gobierno',
    epi: 'La Ley 19/2013, de 9 de diciembre, de transparencia, acceso a la información pública y buen gobierno (Títulos I y II).',
    scope: [() => from(EST, 7, 'Ley 19/2013')] },
  { tn: 215, b: 2, title: 'Políticas de igualdad de género y contra la violencia de género',
    epi: 'La Ley Orgánica 3/2007 para la igualdad efectiva de mujeres y hombres. La Ley Orgánica 1/2004 contra la Violencia de Género (principios rectores). La Ley del Principado de Asturias 2/2011 (Títulos Preliminar a III).',
    scope: [
      () => from(EST, 307, 'LO 3/2007'),
      () => from(EST, 307, 'LO 1/2004'),
      () => from(AUX, 20, 'Ley 2/2011 Asturias Igualdad'),
    ] },
  { tn: 216, b: 2, title: 'Discapacidad y dependencia',
    epi: 'El texto refundido de la Ley general de derechos de las personas con discapacidad y de su inclusión social. La Ley 39/2006 de dependencia (Título Preliminar).',
    scope: [() => from(GAL, 15, 'RDL 1/2013'), () => from(EST, 307, 'Ley 39/2006')] },

  // BLOQUE III — Gestión de Recursos Humanos
  { tn: 301, b: 3, title: 'El Estatuto Básico del Empleado Público (TREBEP)',
    epi: 'El texto refundido del Estatuto Básico del Empleado Público (TREBEP): ámbito; personal (Tít. II); derechos, deberes y código de conducta (Tít. III); adquisición y pérdida de la relación de servicio (Tít. IV); ordenación profesional (Tít. V); situaciones administrativas (Tít. VI); régimen disciplinario (Tít. VII).',
    scope: [() => from(AUX, 10, 'RDL 5/2015')] },
  { tn: 302, b: 3, title: 'El Empleo Público del Principado de Asturias',
    epi: 'La Ley del Principado de Asturias 2/2023, de 15 de marzo, de Empleo Público (Títulos II, IV a IX). El Reglamento de jornada, horario, vacaciones y permisos de los funcionarios del Principado.',
    scope: [() => from(AUX, 11, 'Ley 2/2023 Asturias'), () => from(AUX, 12, 'D 72/2013 Asturias Reglamento Jornada')] },
  { tn: 303, b: 3, title: 'El Convenio Colectivo del personal laboral del Principado',
    epi: 'El V Convenio Colectivo para el personal laboral de la Administración del Principado de Asturias (Capítulos I, IV a X).',
    scope: [() => from(AUX, 13, 'V Convenio Colectivo PL Asturias')] },
  { tn: 304, b: 3, title: 'Las retribuciones del personal. Las nóminas',
    epi: 'Las retribuciones de los funcionarios y del personal laboral del Principado. Nóminas: estructura. Retribuciones básicas y complementarias. Devengo y liquidación.',
    scope: [() => from(EST, 504, 'RDL 5/2015')] },
  { tn: 305, b: 3, title: 'La Ley General de la Seguridad Social (I)',
    epi: 'El texto refundido de la Ley General de la Seguridad Social (I): normas preliminares; campo de aplicación; afiliación y cotización; acción protectora.',
    scope: [() => from(AUX, 15, 'RDL 8/2015')] },
  { tn: 306, b: 3, title: 'La Ley General de la Seguridad Social (II)',
    epi: 'El texto refundido de la Ley General de la Seguridad Social (II): Régimen General; prestaciones (incapacidad temporal, nacimiento y cuidado de menor, riesgo durante el embarazo y la lactancia, incapacidad permanente, jubilación, muerte y supervivencia, protección a la familia).',
    scope: [() => from(AUX, 16, 'RDL 8/2015')] },

  // BLOQUE IV — Gestión Financiera (Hacienda del Principado)
  { tn: 401, b: 4, title: 'El presupuesto y la Hacienda del Principado de Asturias',
    epi: 'El presupuesto: concepto, naturaleza y clases. El texto refundido del régimen económico y presupuestario del Principado de Asturias (I): La Hacienda del Principado.',
    scope: [
      () => from(AUX, 14, 'DL 2/1998 Asturias'),
      () => from(AUX, 14, 'D 70/2004 Asturias Control Interno'),
      () => from(AUX, 14, 'R 16/05/2005 Asturias Sist. Contable'),
    ] },
  { tn: 402, b: 4, title: 'El presupuesto: los créditos y sus modificaciones', avail: false,
    epi: 'El texto refundido del régimen económico y presupuestario del Principado (II): El presupuesto. Los créditos y sus modificaciones.', scope: [] },
  { tn: 403, b: 4, title: 'La ejecución del presupuesto. Documentos contables', avail: false,
    epi: 'La ejecución del presupuesto. Documentos contables. Liquidación y cierre del ejercicio.', scope: [] },
  { tn: 404, b: 4, title: 'Gastos por operaciones corrientes, de capital y financieras', avail: false,
    epi: 'Gastos por operaciones corrientes, de capital y financieras.', scope: [] },
  { tn: 405, b: 4, title: 'El control del gasto público', avail: false,
    epi: 'El control del gasto público. Control parlamentario. Control externo: la Ley 3/2003 de la Sindicatura de Cuentas. Control interno: la Intervención del Principado de Asturias.', scope: [] },

  // BLOQUE V — Ofimática (Windows 10 Pro + Microsoft 365 versión web)
  { tn: 501, b: 5, title: 'Sistema operativo Windows 10',
    epi: 'Sistema operativo Windows 10 Pro: entorno gráfico, escritorio, menú inicio, explorador de archivos, gestión de carpetas y archivos, búsqueda, "Este equipo" y "Acceso rápido", accesorios y panel de control.',
    scope: [() => lit(LAW.WIN10, null), () => lit(LAW.EXPWIN10, null)] },
  { tn: 502, b: 5, title: 'Procesador de texto: Word 365',
    epi: 'Procesador de texto: Word 365 (interfaz, formato, tablas, referencias, revisión y coautoría, diseño de página, plantillas, impresión y exportación).',
    scope: [() => lit(LAW.WORD365, null)] },
  { tn: 503, b: 5, title: 'Hoja de cálculo: Excel 365',
    epi: 'Hoja de cálculo: Excel 365 (interfaz, formato de celdas, fórmulas y funciones, gráficos y tablas dinámicas, gestión de datos, impresión y exportación).',
    scope: [() => lit(LAW.EXCEL365, null)] },
  { tn: 504, b: 5, title: 'Correo electrónico: Outlook 365',
    epi: 'Correo electrónico: Outlook 365 (gestión de correos, reglas y alertas, calendario, contactos y tareas).',
    scope: [() => lit(LAW.OUTLOOK365, null)] },
]

const BLOQUES = [
  { n: 1, titulo: 'Bloque I: Derecho Constitucional y Organización Administrativa', icon: '🏛️' },
  { n: 2, titulo: 'Bloque II: Derecho Administrativo y Comunitario', icon: '⚖️' },
  { n: 3, titulo: 'Bloque III: Gestión de Recursos Humanos', icon: '👥' },
  { n: 4, titulo: 'Bloque IV: Gestión Financiera', icon: '💶' },
  { n: 5, titulo: 'Bloque V: Ofimática', icon: '💻' },
]

;(async () => {
  // resolver Ley 40/2015 id (para arts explícitos del sancionador)
  const { data: l40 } = await s.from('laws').select('id').eq('short_name', 'Ley 40/2015').single()
  LAW.L40 = l40.id

  // ── limpieza idempotente ──
  const { data: oldTopics } = await s.from('topics').select('id').eq('position_type', POS)
  if (oldTopics && oldTopics.length) {
    await s.from('topic_scope').delete().in('topic_id', oldTopics.map((t) => t.id))
    await s.from('topics').delete().eq('position_type', POS)
  }
  await s.from('oposicion_bloques').delete().eq('position_type', POS)

  // ── FASE 2a: actualizar fila oposiciones ──
  const { error: eOp } = await s.from('oposiciones').update({
    short_name: 'Administrativo Asturias',
    grupo: 'C',
    subgrupo: 'C1',
    categoria: 'C1',
    temas_count: 38,
    bloques_count: 5,
    titulo_requerido: 'Bachiller o Técnico (o equivalente)',
    diario_oficial: 'BOPA',
    diario_referencia: 'BOPA-2024-11213',
    programa_url: 'https://miprincipado.asturias.es/bopa/2024/12/24/2024-11213.pdf',
    estado_proceso: 'oep_aprobada',
    oep_decreto: 'OEP 2024 Principado de Asturias (144 plazas C1: 33 libre + 111 promoción interna)',
    oep_fecha: '2024-12-27',
    plazas_libres: 33,
    exam_date: null,
    color_primario: 'cyan',
    seo_title: 'Administrativo (C1) Principado de Asturias 2026 | Temario y Tests | Vence',
    seo_description: 'Prepara el Cuerpo Administrativo (C1) del Principado de Asturias: temario oficial del BOPA y miles de tests por tema. OEP 2024: 144 plazas pendientes de convocatoria.',
  }).eq('id', OPID)
  if (eOp) throw eOp
  console.log('✅ oposiciones actualizada')

  // ── FASE 2b: bloques ──
  const { error: eB } = await s.from('oposicion_bloques').insert(
    BLOQUES.map((b) => ({ position_type: POS, bloque_number: b.n, titulo: b.titulo, icon: b.icon, sort_order: b.n }))
  )
  if (eB) throw eB
  console.log('✅ 5 bloques insertados')

  // ── FASE 2b: topics ──
  const topicRows = TOPICS.map((t) => ({
    position_type: POS,
    topic_number: t.tn,
    title: t.title,
    description: t.epi,
    epigrafe: t.epi,
    descripcion_corta: t.title,
    bloque_number: t.b,
    difficulty: 'medium',
    estimated_hours: 10,
    disponible: t.avail === false ? false : true,
    is_active: true,
  }))
  const { data: insertedTopics, error: eT } = await s.from('topics').insert(topicRows).select('id,topic_number')
  if (eT) throw eT
  const topicIdByTn = {}
  for (const r of insertedTopics) topicIdByTn[r.topic_number] = r.id
  console.log(`✅ ${insertedTopics.length} topics insertados`)

  // ── FASE 3: topic_scope ──
  const scopeRows = []
  for (const t of TOPICS) {
    for (const fn of t.scope) {
      const sc = fn()
      scopeRows.push({ topic_id: topicIdByTn[t.tn], law_id: sc.law_id, article_numbers: sc.article_numbers })
    }
  }
  if (scopeRows.length) {
    const { error: eS } = await s.from('topic_scope').insert(scopeRows)
    if (eS) throw eS
  }
  console.log(`✅ ${scopeRows.length} filas de topic_scope insertadas`)
  console.log('\n🎯 FASE 2+3 completadas.')
})().catch((e) => { console.error('❌', e.message || e); process.exit(1) })
