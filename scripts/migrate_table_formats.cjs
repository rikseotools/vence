// scripts/migrate_table_formats.cjs
// Migrates all psychometric questions to use consistent 'tables' array format

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrateTableDataFormat() {
  console.log('🔄 Migrando preguntas con formato table_data...\n');

  const { data, error } = await supabase
    .from('psychometric_questions')
    .select('id, content_data')
    .eq('is_official_exam', true)
    .eq('is_active', true)
    .not('content_data->table_data', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Preguntas a migrar:', data.length);

  let migrated = 0;
  let errors = 0;

  for (const q of data) {
    const cd = q.content_data;
    const tableData = cd.table_data;
    const tableName = cd.table_title || cd.table_name || 'Tabla';

    if (!tableData || !tableData.headers || !tableData.rows) {
      console.log('⚠️ Skip (no headers/rows):', q.id);
      continue;
    }

    // Convert to new format
    const newContentData = {
      ...cd,
      tables: [{
        title: tableName,
        headers: tableData.headers,
        rows: tableData.rows
      }]
    };

    // Remove old fields
    delete newContentData.table_data;
    delete newContentData.table_name;
    delete newContentData.table_title;
    delete newContentData.table_type;

    // Update in database
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: newContentData })
      .eq('id', q.id);

    if (updateError) {
      console.error('❌ Error updating', q.id, updateError);
      errors++;
    } else {
      console.log('✅ Migrated:', q.id);
      migrated++;
    }
  }

  console.log('\n=== RESUMEN table_data ===');
  console.log('Migradas:', migrated);
  console.log('Errores:', errors);

  return { migrated, errors };
}

async function migrateMainTableFormat() {
  console.log('\n🔄 Migrando preguntas con formato main_table/characteristics_table...\n');

  const { data, error } = await supabase
    .from('psychometric_questions')
    .select('id, content_data')
    .eq('is_official_exam', true)
    .eq('is_active', true)
    .not('content_data->main_table', 'is', null);

  if (error) {
    console.error('Error:', error);
    return { migrated: 0, errors: 0 };
  }

  console.log('Preguntas a migrar:', data.length);

  let migrated = 0;
  let errors = 0;

  for (const q of data) {
    const cd = q.content_data;
    const mainTable = cd.main_table;
    const charTable = cd.characteristics_table;

    const tables = [];

    if (mainTable && mainTable.headers && mainTable.rows) {
      tables.push({
        title: 'Tabla Principal',
        headers: mainTable.headers,
        rows: mainTable.rows
      });
    }

    if (charTable && charTable.headers && charTable.rows) {
      tables.push({
        title: 'Tabla de Características',
        headers: charTable.headers,
        rows: charTable.rows
      });
    }

    if (tables.length === 0) {
      console.log('⚠️ Skip (no tables found):', q.id);
      continue;
    }

    // Convert to new format
    const newContentData = {
      ...cd,
      tables
    };

    // Remove old fields
    delete newContentData.main_table;
    delete newContentData.characteristics_table;

    // Update in database
    const { error: updateError } = await supabase
      .from('psychometric_questions')
      .update({ content_data: newContentData })
      .eq('id', q.id);

    if (updateError) {
      console.error('❌ Error updating', q.id, updateError);
      errors++;
    } else {
      console.log('✅ Migrated:', q.id);
      migrated++;
    }
  }

  console.log('\n=== RESUMEN main_table ===');
  console.log('Migradas:', migrated);
  console.log('Errores:', errors);

  return { migrated, errors };
}

async function verifyMigration() {
  console.log('\n🔍 Verificando migración...\n');

  const { data, error } = await supabase
    .from('psychometric_questions')
    .select('id, question_subtype, content_data')
    .eq('is_official_exam', true)
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const formats = {
    'tables (array)': 0,
    'table_data (object)': 0,
    'main_table + characteristics_table': 0,
    'no tables': 0
  };

  for (const q of data) {
    const cd = q.content_data;
    if (!cd) {
      formats['no tables']++;
    } else if (cd.tables && Array.isArray(cd.tables)) {
      formats['tables (array)']++;
    } else if (cd.table_data) {
      formats['table_data (object)']++;
    } else if (cd.main_table || cd.characteristics_table) {
      formats['main_table + characteristics_table']++;
    } else {
      formats['no tables']++;
    }
  }

  console.log('=== FORMATOS DESPUÉS DE MIGRACIÓN ===');
  for (const [format, count] of Object.entries(formats)) {
    console.log(`${format}: ${count}`);
  }
}

async function main() {
  const result1 = await migrateTableDataFormat();
  const result2 = await migrateMainTableFormat();
  await verifyMigration();

  console.log('\n=== TOTAL ===');
  console.log('Total migradas:', (result1?.migrated || 0) + (result2?.migrated || 0));
  console.log('Total errores:', (result1?.errors || 0) + (result2?.errors || 0));
}

main().catch(console.error);
