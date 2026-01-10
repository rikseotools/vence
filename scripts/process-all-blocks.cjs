const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mapeo de directorios a tags y bloques
const DIR_TO_TAG = {
  // Bloque II
  'Tema_1,_Atención_al_público': { tag: 'T201', bloque: 'Bloque II' },
  'Tema_2,_Documento,_registro_y_archivo': { tag: 'T202', bloque: 'Bloque II' },
  'Tema_3,_Administración_Electrónica': { tag: 'T203', bloque: 'Bloque II' },
  // T204 ya procesado

  // Bloque III
  // T301, T302, T305 ya procesados
  'Tema_3,_Ley_392015,_Ley_402015_y_jurisdicción_contencioso-administrativa': { tag: 'T303', bloque: 'Bloque III' },
  'Tema_4,_Contratos_del_sector_público': { tag: 'T304', bloque: 'Bloque III' },
  'Tema_6,_La_responsabilidad_patrimonial_de_las_Administraciones_públicas': { tag: 'T306', bloque: 'Bloque III' },
  'Tema_7,_Políticas_de_igualdad_y_contra_la_violencia_de_género_y_discapacidad_y_dependencia': { tag: 'T307', bloque: 'Bloque III' },

  // Bloque IV - Personal
  'Tema_1,_El_personal_al_servicio_de_las_Administraciones_públicas': { tag: 'T401', bloque: 'Bloque IV' },
  'Tema_2,_Selección_de_personal': { tag: 'T402', bloque: 'Bloque IV' },
  'Tema_3,_El_personal_funcionario_al_servicio_de_las_Administraciones_públicas': { tag: 'T403', bloque: 'Bloque IV' },
  'Tema_4,_Adquisición_y_pérdida_de_la_condición_de_funcionario': { tag: 'T404', bloque: 'Bloque IV' },
  'Tema_5,_Provisión_de_puestos_de_trabajo_en_la_función_pública': { tag: 'T405', bloque: 'Bloque IV' },
  'Tema_6,_Las_incompatibilidades_y_régimen_disciplinario': { tag: 'T406', bloque: 'Bloque IV' },
  'Tema_7,_El_régimen_de_la_Seguridad_Social_de_los_funcionarios': { tag: 'T407', bloque: 'Bloque IV' },
  'Tema_8,_El_personal_laboral_al_servicio_de_las_Administraciones_públicas': { tag: 'T408', bloque: 'Bloque IV' },
  'Tema_9,_El_régimen_de_la_Seguridad_Social_del_personal_laboral': { tag: 'T409', bloque: 'Bloque IV' },

  // Bloque V - Presupuestos
  'Tema_1,_Concepto_y_aspectos_generales_del_presupuesto': { tag: 'T501', bloque: 'Bloque V' },
  'Tema_2,_El_presupuesto_del_Estado_en_España,_créditos_presupuestarios_y_sus_modificaciones': { tag: 'T502', bloque: 'Bloque V' },
  'Tema_3,_El_procedimiento_administrativo_de_ejecución_del_presupuesto_de_gasto': { tag: 'T503', bloque: 'Bloque V' },
  'Tema_4,_Las_retribuciones_de_los_funcionarios_públicos_y_del_personal_laboral_al_servicio_de_la_Admi': { tag: 'T504', bloque: 'Bloque V' },
  'Tema_5,_Gastos_para_la_compra_de_bienes_y_servicios,_de_inversión,_de_transferencias_y_pagos': { tag: 'T505', bloque: 'Bloque V' },
  'Tema_6,_Gestión_económica_y_financiera_de_los_contratos_del_sector_público_y_de_las_subvenciones': { tag: 'T506', bloque: 'Bloque V' },

  // Bloque VI - Informática
  'Tema_1._Informática_básica': { tag: 'T601', bloque: 'Bloque VI' },
  'Tema_4._Procesadores_de_texto': { tag: 'T604', bloque: 'Bloque VI' },
  'Tema_5._Hojas_de_cálculo': { tag: 'T605', bloque: 'Bloque VI' },
  'Tema_6._Bases_de_datos': { tag: 'T606', bloque: 'Bloque VI' },
  'Tema_7._Correo_electrónico': { tag: 'T607', bloque: 'Bloque VI' },
  'Tema_8._La_Red_Internet': { tag: 'T608', bloque: 'Bloque VI' }
};

function tagToTopicNumber(tag) {
  const match = tag.match(/T(\d)(\d{2})/);
  if (!match) return null;
  const bloque = parseInt(match[1]);
  const tema = parseInt(match[2]);
  if (bloque === 1) return tema;
  return bloque * 100 + tema;
}

async function loadTopics() {
  const { data } = await supabase
    .from('topics')
    .select('id, topic_number')
    .eq('position_type', 'administrativo');

  const topics = {};
  for (const t of data || []) {
    topics[t.topic_number] = t.id;
  }
  return topics;
}

async function ensureInScope(topicId, lawId, articleNumber) {
  if (!topicId || !lawId) return 'skip';

  const { data: existing } = await supabase
    .from('topic_scope')
    .select('id, article_numbers')
    .eq('topic_id', topicId)
    .eq('law_id', lawId)
    .single();

  if (existing) {
    const articles = existing.article_numbers || [];
    if (!articles.includes(articleNumber)) {
      await supabase.from('topic_scope').update({ article_numbers: [...articles, articleNumber] }).eq('id', existing.id);
      return 'added';
    }
    return 'exists';
  } else {
    await supabase.from('topic_scope').insert({ topic_id: topicId, law_id: lawId, article_numbers: [articleNumber], weight: 0.5 });
    return 'created';
  }
}

async function processDir(dirName, tag, bloque, TOPICS) {
  const dirPath = `/home/manuel/Documentos/github/vence/preguntas-para-subir/${dirName}`;

  if (!fs.existsSync(dirPath)) {
    return { updated: 0, scopeUpdates: 0, notFound: true };
  }

  const topicNumber = tagToTopicNumber(tag);
  const topicId = TOPICS[topicNumber];

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  let updated = 0, scopeUpdates = 0;

  for (const fileName of files) {
    const content = fs.readFileSync(path.join(dirPath, fileName), 'utf8');
    const data = JSON.parse(content);

    for (const q of data.questions) {
      const { data: existing } = await supabase
        .from('questions')
        .select('id, tags, primary_article_id, articles!primary_article_id(article_number, law_id)')
        .eq('question_text', q.question)
        .single();

      if (!existing) continue;

      // Actualizar tags si no tiene el tag del tema
      const currentTags = existing.tags || [];
      if (!currentTags.includes(tag)) {
        const newTags = [...new Set([...currentTags, tag, bloque])];
        await supabase.from('questions').update({ tags: newTags }).eq('id', existing.id);
        updated++;
      }

      // Actualizar scope si tiene artículo vinculado
      if (existing.articles && topicId) {
        const result = await ensureInScope(topicId, existing.articles.law_id, existing.articles.article_number);
        if (result === 'added' || result === 'created') {
          scopeUpdates++;
        }
      }
    }
  }

  return { updated, scopeUpdates, notFound: false };
}

(async () => {
  console.log('=== Procesando todos los bloques ===\n');

  const TOPICS = await loadTopics();
  console.log('Topics cargados:', Object.keys(TOPICS).length, '\n');

  let totalUpdated = 0, totalScope = 0;
  let currentBloque = '';

  for (const [dirName, config] of Object.entries(DIR_TO_TAG)) {
    if (config.bloque !== currentBloque) {
      currentBloque = config.bloque;
      console.log(`\n=== ${currentBloque} ===`);
    }

    const result = await processDir(dirName, config.tag, config.bloque, TOPICS);

    if (result.notFound) {
      console.log(`${config.tag}: directorio no encontrado`);
      continue;
    }

    totalUpdated += result.updated;
    totalScope += result.scopeUpdates;

    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .contains('tags', [config.tag])
      .eq('is_active', true);

    console.log(`${config.tag}: +${result.updated} tags, +${result.scopeUpdates} scope, total: ${count}`);
  }

  console.log(`\n📊 Resumen total:`);
  console.log(`   Tags actualizados: ${totalUpdated}`);
  console.log(`   Artículos añadidos a scope: ${totalScope}`);
})();
