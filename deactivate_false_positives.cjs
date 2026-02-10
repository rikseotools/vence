require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IDs de los falsos positivos a desactivar (segundo de cada par)
const toDeactivate = [
  // CASO 1: Entidades privadas Ley 19/2013
  { id: '67c32f1a-ed57-473d-85b1-74b7748ac553', keepId: '51423e12-501b-45aa-b5ce-201cfc58b4a6', reason: 'Duplicado de 51423e12' },

  // CASO 2: Iniciativa proceso autonómico - mantener OFICIAL
  { id: 'c4afcb8c-0a44-4206-9451-26a943fd28a5', keepId: 'de18c5e6-f6c3-4390-ada4-8c55b303b891', reason: 'Duplicado de oficial de18c5e6' },

  // CASO 3: Presidencia Foro Gobierno Abierto
  { id: 'f425728b-e736-440b-814a-cdef79e35ee0', keepId: '704bc8f7-ff3d-4f2e-99ed-86d477c8d8b7', reason: 'Duplicado de 704bc8f7' },

  // CASO 5: Velocidad microprocesador
  { id: '568fab12-53a1-4c92-9f6e-cb98595ec71b', keepId: '1b5b619f-8e22-4f6d-9086-32587e165af0', reason: 'Duplicado de 1b5b619f' },

  // CASO 9: Hardware almacenar temporalmente (Memoria RAM)
  { id: 'a5b10688-20cb-4865-a0b9-bcb922c3c7da', keepId: '9b996bb4-13c8-429b-bc90-9c5ad2ed5b02', reason: 'Duplicado de 9b996bb4' },

  // CASO 10: Derechos estado alarma
  { id: 'e8486e35-9b75-456a-842d-e1f7c063fefc', keepId: 'ab6f3ca1-a092-4217-a20d-282c14da9605', reason: 'Duplicado de ab6f3ca1' },

  // CASO 12: Elementos EDS 2030
  { id: '0a311c33-dafd-48ea-b721-fa7eda220660', keepId: '5e3c0b1d-3819-4bc8-a183-5a277dd0b33d', reason: 'Duplicado de 5e3c0b1d' },

  // CASO 13: ODS 8
  { id: '12e2319f-c23e-47ce-9a0b-478f3832062f', keepId: 'fb1def08-d2a9-4b0f-9f5a-670ca3482bfa', reason: 'Duplicado de fb1def08' },

  // CASO 14: Pestañas comentarios Word
  { id: '97e28b03-10ff-4f4b-afb1-aa6383241b6c', keepId: '126e7b0d-546a-4a4c-8dd5-bf11cf5accf5', reason: 'Duplicado de 126e7b0d' },

  // CASO 15: Tercera reforma CE
  { id: '03dc1fc1-c177-4bd5-b8e2-3c4675bc71d7', keepId: 'adca1ea9-1a50-460e-be02-cb942416ebac', reason: 'Duplicado de adca1ea9' },
];

(async () => {
  console.log('=== DESACTIVANDO FALSOS POSITIVOS ===\n');

  let success = 0;
  let failed = 0;

  for (const item of toDeactivate) {
    // Get current tags
    const { data: current } = await supabase
      .from('questions')
      .select('tags')
      .eq('id', item.id)
      .single();

    const currentTags = current?.tags || [];
    const newTags = [...currentTags, 'DESACTIVADA: ' + item.reason];

    const { error } = await supabase
      .from('questions')
      .update({
        is_active: false,
        tags: newTags
      })
      .eq('id', item.id);

    if (error) {
      console.log('❌ Error:', item.id.substring(0, 8), '-', error.message);
      failed++;
    } else {
      console.log('✅ Desactivada:', item.id.substring(0, 8) + '...', '-', item.reason);
      success++;
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Desactivadas:', success);
  console.log('Errores:', failed);
})();
