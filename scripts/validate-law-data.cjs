#!/usr/bin/env node
/**
 * Script de Validación de Datos de Leyes
 *
 * Ejecutar: node scripts/validate-law-data.cjs
 *
 * Este script valida que los datos en la BD coincidan con las leyes oficiales.
 * Útil para:
 * - Ejecutar en CI/CD antes de deployar
 * - Ejecutar después de importar datos
 * - Detectar errores de integridad
 *
 * Exit codes:
 * - 0: Todo correcto
 * - 1: Errores encontrados
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// CONFIGURACIÓN OFICIAL DE LEYES (según BOE)
// ============================================
// IMPORTANTE: Actualizar cuando cambien las leyes

const LEYES_OFICIALES = {
  'RDL 5/2015': {
    nombre: 'Estatuto Básico del Empleado Público (EBEP)',
    articuloMax: 100, // El EBEP tiene artículos del 1 al 100
    articulosEspeciales: ['47bis'], // Artículos con formato especial permitidos
    articulosProhibidos: ['101', '149'], // Artículos que NO deben existir
  },
  'CE': {
    nombre: 'Constitución Española',
    articuloMax: 169,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 39/2015': {
    nombre: 'Ley del Procedimiento Administrativo Común',
    articuloMax: 133,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
  'Ley 40/2015': {
    nombre: 'Ley de Régimen Jurídico del Sector Público',
    articuloMax: 158,
    articulosEspeciales: [],
    articulosProhibidos: [],
  },
};

// ============================================
// FUNCIONES DE VALIDACIÓN
// ============================================

const errors = [];
const warnings = [];

function logError(msg) {
  errors.push(msg);
  console.log('❌ ERROR:', msg);
}

function logWarning(msg) {
  warnings.push(msg);
  console.log('⚠️ WARN:', msg);
}

function logSuccess(msg) {
  console.log('✅', msg);
}

async function validateLaw(shortName, config) {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📚 Validando: ${shortName} (${config.nombre})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Buscar la ley
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .eq('short_name', shortName)
    .single();

  if (lawError || !law) {
    logWarning(`Ley ${shortName} no encontrada en la BD`);
    return;
  }

  // 2. Obtener artículos
  const { data: articles } = await supabase
    .from('articles')
    .select('id, article_number, title, is_active')
    .eq('law_id', law.id);

  const activeArticles = articles?.filter(a => a.is_active) || [];
  console.log(`   Total artículos: ${articles?.length || 0} (${activeArticles.length} activos)`);

  // 3. Validar artículos fuera de rango
  const numericArticles = activeArticles.filter(a => /^\d+$/.test(a.article_number));

  for (const article of numericArticles) {
    const num = parseInt(article.article_number);
    if (num > config.articuloMax) {
      logError(`${shortName}: Artículo ${num} fuera de rango (máx: ${config.articuloMax}) - "${article.title}"`);
    }
  }

  // 4. Validar artículos prohibidos
  for (const prohibido of config.articulosProhibidos) {
    const found = activeArticles.find(a => a.article_number === prohibido);
    if (found) {
      logError(`${shortName}: Artículo ${prohibido} NO debe existir - "${found.title}"`);
    }
  }

  // 5. Validar duplicados
  const normalizedNumbers = activeArticles.map(a =>
    a.article_number.toLowerCase().replace(/\s+/g, '')
  );

  const seen = new Set();
  const duplicates = [];

  for (const num of normalizedNumbers) {
    if (seen.has(num)) {
      duplicates.push(num);
    }
    seen.add(num);
  }

  if (duplicates.length > 0) {
    logError(`${shortName}: Artículos duplicados: ${[...new Set(duplicates)].join(', ')}`);
  }

  // 6. Validar artículos especiales existen una sola vez
  for (const especial of config.articulosEspeciales) {
    const matches = activeArticles.filter(a =>
      a.article_number.toLowerCase().replace(/\s+/g, '') === especial.toLowerCase()
    );

    if (matches.length === 0) {
      logWarning(`${shortName}: Artículo especial ${especial} no encontrado`);
    } else if (matches.length > 1) {
      logError(`${shortName}: Artículo especial ${especial} duplicado (${matches.length} veces)`);
    }
  }

  // 7. Validar topic_scope no referencia artículos prohibidos
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, topic_id')
    .eq('law_id', law.id);

  for (const scope of scopes || []) {
    for (const prohibido of config.articulosProhibidos) {
      if (scope.article_numbers?.includes(prohibido)) {
        logError(`${shortName}: topic_scope ${scope.id.substring(0, 8)} referencia artículo prohibido ${prohibido}`);
      }
    }
  }

  if (errors.length === 0 || errors.every(e => !e.includes(shortName))) {
    logSuccess(`${shortName}: Validación completa sin errores`);
  }
}

async function validateTopicScopeReferences() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔗 Validando referencias de topic_scope');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Obtener todos los topic_scope con info de ley
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('id, law_id, article_numbers, laws(short_name)');

  let invalidCount = 0;

  for (const scope of scopes || []) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;

    // Obtener artículos activos de esta ley
    const { data: articles } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', scope.law_id)
      .eq('is_active', true);

    const validNumbers = new Set(articles?.map(a => a.article_number) || []);

    for (const artNum of scope.article_numbers) {
      if (!validNumbers.has(artNum)) {
        logError(`topic_scope ${scope.id.substring(0, 8)} (${scope.laws?.short_name}): referencia artículo inexistente "${artNum}"`);
        invalidCount++;
      }
    }
  }

  if (invalidCount === 0) {
    logSuccess('Todas las referencias de topic_scope son válidas');
  }
}

// ============================================
// EJECUCIÓN PRINCIPAL
// ============================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     VALIDACIÓN DE INTEGRIDAD DE DATOS DE LEYES            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Validar cada ley configurada
  for (const [shortName, config] of Object.entries(LEYES_OFICIALES)) {
    await validateLaw(shortName, config);
  }

  // Validar referencias de topic_scope
  await validateTopicScopeReferences();

  // Resumen final
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      RESUMEN FINAL                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  if (errors.length === 0) {
    console.log('✅ VALIDACIÓN EXITOSA - No se encontraron errores');
    console.log('');
    process.exit(0);
  } else {
    console.log(`❌ VALIDACIÓN FALLIDA - ${errors.length} error(es) encontrado(s):`);
    console.log('');
    errors.forEach((e, i) => console.log(`   ${i + 1}. ${e}`));
    console.log('');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
