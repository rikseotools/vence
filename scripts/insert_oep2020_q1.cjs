// scripts/insert_oep2020_q1.cjs
// Insert question 1 from OEP 2020 exam

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertQuestion() {
  const explanation = `**Respuesta correcta: B) Por el Gobierno, mediante decreto acordado en Consejo de Ministros y por un plazo máximo de 15 días, dando cuenta al Congreso de los Diputados y sin cuya autorización no podrá ser prorrogado dicho plazo.**

El artículo 116.2 de la Constitución Española establece literalmente:

> "El estado de alarma será declarado por el Gobierno mediante decreto acordado en Consejo de Ministros por un plazo máximo de quince días, dando cuenta al Congreso de los Diputados, reunido inmediatamente al efecto y sin cuya autorización no podrá ser prorrogado dicho plazo."

**Puntos clave:**
- Lo declara el **Gobierno** (no el Congreso)
- Mediante **decreto acordado en Consejo de Ministros**
- Plazo máximo: **15 días**
- Debe dar cuenta al Congreso
- Para **prorrogarlo** necesita autorización del Congreso

**Por qué las otras opciones son incorrectas:**
- A) y C) Incorrectas: El Congreso no declara el estado de alarma, lo hace el Gobierno
- D) Incorrecta: El Senado no interviene en la declaración del estado de alarma`;

  const { data, error } = await supabase
    .from('questions')
    .insert({
      question_text: 'De conformidad con el artículo 116 de la Constitución Española (en adelante CE), el estado de alarma será declarado:',
      option_a: 'Por mayoría absoluta del Congreso por un plazo máximo de 15 días, sin perjuicio de su posible prórroga.',
      option_b: 'Por el Gobierno, mediante decreto acordado en Consejo de Ministros y por un plazo máximo de 15 días, dando cuenta al Congreso de los Diputados y sin cuya autorización no podrá ser prorrogado dicho plazo.',
      option_c: 'Por mayoría simple del Congreso por un plazo máximo de 15 días, sin perjuicio de su posible prórroga.',
      option_d: 'Por mayoría simple del Congreso y ratificado por el Senado por el periodo que se determine.',
      correct_option: 1, // B = 1
      explanation: explanation,
      primary_article_id: 'a5b3c115-1ada-4436-90ba-b0584dec15d4', // Art. 116 CE
      is_active: true,
      is_official_exam: true,
      exam_source: 'Examen Auxiliar Administrativo Estado - OEP 2020 - Convocatoria 26 mayo 2021 - Primera parte',
      exam_date: '2021-05-26',
      difficulty: 'medium'
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Pregunta 1 insertada - ID:', data.id);
  }
}

insertQuestion();
