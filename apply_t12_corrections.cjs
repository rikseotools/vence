const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// FALSOS POSITIVOS (20): Marcar como 'perfect'
// Batch 1: 9857d4e8, 34efdef1, c63e76a1, 60bbf4d1, 828e694b
// Batch 2: 08faf005, 061004c8, a18b2c99, 0abb7ee9, 32dd2375,
//          48001f52, c6a73875, 1340ca36, 37a55534
// Batch 3: ec349e6f, 9ca093c6, 3830eca3, 8ab5799e, d9f5a780, f6ca2391
// ============================================================
const FALSE_POSITIVES = [
  '9857d4e8-a4b3-41cd-8a10-f0333e6374b2',
  '34efdef1-d08c-4e97-9fa6-c750d80cce34',
  'c63e76a1-6409-41af-a7d2-b289d7928973',
  '60bbf4d1-b4bf-4979-aa63-c227c9b0a1ec',
  '828e694b-f0f2-45d5-9ac7-b569dba652cc',
  '08faf005-528b-457d-a3b4-3832e669d6d6',
  '061004c8-3f7d-48b2-ab96-b0452f99bc0a',
  'a18b2c99-baef-4f70-8dd2-f40d50e4b9a8',
  '0abb7ee9-a37b-487d-8077-459b6e47fdba',
  '32dd2375-9f4e-42a2-acdb-512bf723f1f2',
  '48001f52-4d70-4d58-a522-0f2449dd221f',
  'c6a73875-4fa4-4ad6-8f31-fb35a81db3cb',
  '1340ca36-a6e3-4f57-8b6f-54138b50e821',
  '37a55534-8443-4a3a-8a37-5bf46f74d00b',
  'ec349e6f-f7cb-4da8-99b5-9a771f05b8f7',
  '9ca093c6-96cf-487d-9003-07aafca2e76d',
  '3830eca3-3bed-4ffb-a417-694264af1c40',
  '8ab5799e-9f3e-4308-80e8-c940cb5599f0',
  'd9f5a780-7fb6-41a3-a097-15b9ec326403',
  'f6ca2391-27fa-469a-8418-d6c243807a85',
];

// ============================================================
// CORRECCIONES (5)
// ============================================================
const CORRECTIONS = [
  // ---- CORRECTION 1: Q2 (5c1bd852) - Explicación con letras A/C/D intercambiadas ----
  // Option A = rectificación (art 16), Option C = portabilidad (art 20), Option D = limitación (art 18)
  // La explicación actual dice A=limitación, C=rectificación, D=portabilidad (todo al revés)
  {
    id: '5c1bd852-da7f-4ad8-b787-cfbd3e7a949e',
    updates: {
      explanation: `**Respuesta correcta: B) Es el que tiene toda persona a obtener, sin dilación indebida del responsable del tratamiento, la supresión de datos personales que le conciernan, cuando concurran determinadas circunstancias contenidas en su artículo 17.**

El artículo 17 del RGPD (Reglamento 2016/679) regula el **"Derecho de supresión (derecho al olvido)"**:

> "El interesado tendrá derecho a obtener sin dilación indebida del responsable del tratamiento la supresión de los datos personales que le conciernan, cuando concurra alguna de las circunstancias siguientes..."

**Circunstancias que permiten ejercer el derecho al olvido (Art. 17.1):**
- Los datos ya no son necesarios para los fines recogidos
- El interesado retira el consentimiento
- El interesado se opone al tratamiento
- Los datos han sido tratados ilícitamente
- Deben suprimirse por obligación legal

**Por qué las otras opciones son incorrectas:**

- A) Rectificación de datos personales inexactos → Es el derecho del Art. 16 RGPD (derecho de rectificación)
- C) Recibir datos y transmitirlos a otro responsable → Es el derecho de **portabilidad** del Art. 20 RGPD
- D) Limitación del tratamiento → Es el derecho del Art. 18 RGPD`,
      topic_review_status: 'perfect',
    },
    description: 'Corregir letras A/C/D en explicación (estaban intercambiadas)',
  },

  // ---- CORRECTION 2: Q3 (499ad8fc) - Artículo vinculado debería ser DF 1ª, pero no existe en BD ----
  // La DF 1ª no existe como artículo en la BD de LOPDGDD. La respuesta C y explicación son correctas.
  // Solo marcar como perfect ya que no podemos reasignar artículo.
  {
    id: '499ad8fc-1c7b-4700-8426-f5cc9b0796b7',
    updates: {
      topic_review_status: 'perfect',
    },
    description: 'Respuesta y explicación correctas. DF 1ª no existe en BD, se mantiene vinculado a art. 1.',
  },

  // ---- CORRECTION 3: Q6 (14095591) - Artículo vinculado es art 2 RGPD pero debería ser art 9 ----
  {
    id: '14095591-0d25-4abf-8ae1-05f9d3db189c',
    updates: {
      primary_article_id: 'a7167f09-8672-4245-9831-cf9c95ac4387', // art 9 RGPD
      topic_review_status: 'perfect',
    },
    description: 'Cambiar artículo de art 2 a art 9 RGPD (categorías especiales de datos)',
  },

  // ---- CORRECTION 4: Q7 (e573ff0d) - Artículo vinculado debería ser DF 1ª (no existe en BD) ----
  // Igual que Q3: la DF 1ª no existe como artículo en la BD. Respuesta y explicación correctas.
  {
    id: 'e573ff0d-bc0c-4a87-8765-d7e90117ea04',
    updates: {
      topic_review_status: 'perfect',
    },
    description: 'Respuesta y explicación correctas. DF 1ª no existe en BD, se mantiene vinculado a art. 1.',
  },

  // ---- CORRECTION 5: Q6 batch3 (e8211275) - Explicación inventa letra e) del art 4.2 ----
  {
    id: 'e8211275-e7f5-44f3-9c55-85f4b3fe76d2',
    updates: {
      explanation: `**Respuesta correcta: C) Cuando hayan sido obtenidos de una materia clasificada.**

El artículo 4.2 de la LO 3/2018 (LOPDGDD) establece cuándo **NO será imputable** al responsable la inexactitud de los datos obtenidos por él:

> "No será imputable al responsable del tratamiento [...] la inexactitud de los datos personales [...] cuando los datos inexactos:
> a) Hubiesen sido obtenidos directamente del afectado.
> b) De un mediador o intermediario.
> c) De otro responsable en ejercicio del derecho de portabilidad.
> d) De un registro público."

**Análisis de las opciones:**

- **A) Obtenidos de un Registro Público** → Art. 4.2.d): NO imputable al responsable.
- **B) Recibidos por portabilidad** → Art. 4.2.c): NO imputable al responsable.
- **C) Obtenidos de materia clasificada** → **NO está en la lista de excepciones del art. 4.2**, por tanto SÍ sería imputable al responsable.
- **D) Obtenidos directamente del afectado** → Art. 4.2.a): NO imputable al responsable.

**Conclusión:** La opción C no encaja en ninguna de las excepciones del art. 4.2, por lo que en ese supuesto la inexactitud SÍ sería imputable al responsable del tratamiento.`,
      topic_review_status: 'perfect',
    },
    description: 'Eliminar letra e) inventada del art 4.2 LOPDGDD (solo tiene letras a-d)',
  },
];

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== EXECUTING ===');
  console.log(`False positives: ${FALSE_POSITIVES.length}`);
  console.log(`Corrections: ${CORRECTIONS.length}`);
  console.log(`Total: ${FALSE_POSITIVES.length + CORRECTIONS.length}`);

  // 1. Mark false positives as 'perfect'
  let fpOk = 0, fpFail = 0;
  for (const id of FALSE_POSITIVES) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would mark ${id.substring(0, 8)} as perfect`);
      fpOk++;
    } else {
      const { error } = await supabase.from('questions')
        .update({ topic_review_status: 'perfect' })
        .eq('id', id);
      if (error) {
        console.error(`  FAIL ${id.substring(0, 8)}: ${error.message}`);
        fpFail++;
      } else {
        fpOk++;
      }
    }
  }
  console.log(`\nFalse positives: ${fpOk} OK, ${fpFail} FAIL`);

  // 2. Apply corrections
  let corrOk = 0, corrFail = 0;
  for (const corr of CORRECTIONS) {
    if (DRY_RUN) {
      console.log(`  [DRY] Would update ${corr.id.substring(0, 8)}: ${corr.description}`);
      corrOk++;
    } else {
      const { error } = await supabase.from('questions')
        .update(corr.updates)
        .eq('id', corr.id);
      if (error) {
        console.error(`  FAIL ${corr.id.substring(0, 8)}: ${error.message}`);
        corrFail++;
      } else {
        console.log(`  OK ${corr.id.substring(0, 8)}: ${corr.description}`);
        corrOk++;
      }
    }
  }
  console.log(`\nCorrections: ${corrOk} OK, ${corrFail} FAIL`);

  // 3. Verify
  if (!DRY_RUN) {
    const allIds = [...FALSE_POSITIVES, ...CORRECTIONS.map(c => c.id)];
    const { data: check } = await supabase.from('questions')
      .select('id, topic_review_status')
      .in('id', allIds);

    const perfectCount = check.filter(q => q.topic_review_status === 'perfect').length;
    console.log(`\nVerification: ${perfectCount}/${allIds.length} marked as perfect`);
  }
}

main().catch(console.error);
