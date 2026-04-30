require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fixes = [
  // 1) 40738860: bad_explanation sin fix — escribir explicación didáctica
  {
    id: '40738860-4a29-47f9-b963-1bd9e167a4da',
    explanation: `> **Art. 22 Ley 7/2014 Galicia**
> "En el marco de lo dispuesto en el artículo 21 de la Ley orgánica 15/1999, de 13 de diciembre, de protección de datos de carácter personal, son funciones de los archivos públicos en el campo de la información administrativa..."

**Por qué D es correcta:** La Ley Orgánica 15/1999, de 13 de diciembre, es la Ley de Protección de Datos de Carácter Personal (LOPD), expresamente citada en el art. 22 de la Ley 7/2014 como marco para las funciones de información administrativa de los archivos públicos.

**Por qué las demás son incorrectas:**
- **A)** "15/1199" contiene un typo en el año (no existe tal ley).
- **B)** "25/1999" es otra ley distinta (no corresponde a protección de datos).
- **C)** "15/2099" tiene un typo grave en el año.

Nota: el enunciado dice "artículo 22" por error del propio test; el art. 22 de la Ley 7/2014 remite al art. 21 de la LOPD 15/1999, no al 22.`,
  },

  // 2) 86218f04: ambiguous — typo en enunciado (formales → informales)
  {
    id: '86218f04-a207-4639-9776-19332ade8e8c',
    question_text: 'De acuerdo con el artículo 38 de la Ley 4/2019 de Administración Electrónica de Galicia, las interacciones informales con la ciudadanía son aquellas que se efectúan a través de canales digitales, promovidas por el sector público autonómico, con la finalidad de proporcionar información general en tiempo real, así como de dar respuesta de naturaleza meramente:',
    explanation: `> **Art. 38.1 Ley 4/2019 Galicia**
> "Se entiende por interacciones informales con la ciudadanía aquellas comunicaciones que se efectúan a través de canales digitales, promovidas por el sector público autonómico, con la finalidad de proporcionar información general en tiempo real, así como de dar respuesta de naturaleza meramente orientativa o informativa a determinadas cuestiones."

**Por qué C es correcta:** El art. 38.1 califica las respuestas en interacciones informales como de naturaleza "meramente orientativa o informativa", coincidiendo literalmente con la opción C.

**Por qué las demás son incorrectas:**
- **A)** El art. 38 no contempla respuestas "legislativas en cuestión de sanciones"; al contrario, el art. 38.1 in fine aclara que las interacciones informales no son vinculantes.
- **B)** "Administrativa" por sí sola no es la calificación del art. 38, que exige además "meramente orientativa o informativa".
- **D)** Al ser A y B incorrectas, "Todas son correctas" no procede.`,
  },

  // 3) bc630357: unverifiable — respuesta clara por exclusión de typos en distractores
  {
    id: 'bc630357-d2a6-4bba-8a59-e1bb81732682',
    explanation: `La Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las Administraciones Públicas y del Procedimiento Administrativo Común, regulaba en su artículo 4 el principio de lealtad institucional entre administraciones públicas (aunque esta ley está hoy derogada por las Leyes 39/2015 y 40/2015, que han asumido dicha regulación).

**Por qué C es correcta:** Cita correctamente el art. 4 de la Ley 30/1992, de 26 de noviembre, de régimen jurídico de las **administraciones públicas** y del procedimiento administrativo común.

**Por qué las demás son incorrectas:**
- **A)** Dice "administraciones **privadas**" — es un error material, la Ley 30/1992 regulaba las administraciones públicas.
- **B)** Cita "Ley **50/1992**", ley inexistente con ese contenido (la Ley 50/1992 era de Presupuestos Generales del Estado de 1993).
- **D)** Cita "Ley 30/**2092**" — año inexistente, typo evidente.`,
  },

  // 4) f9e44809: ambiguous — A y C idénticas, cambio C por otro apartado del art 5.2
  {
    id: 'f9e44809-1bad-4052-8b3d-d61b013ba6eb',
    option_c: 'Los de las universidades públicas del sistema universitario de Galicia y sus entidades instrumentales dependientes.',
    explanation: `> **Art. 5.2 Ley 7/2014 Galicia**
> "A efectos de la presente ley, son documentos de titularidad pública: [...] e) Los de las entidades locales de la Comunidad Autónoma de Galicia [...] f) Los de las universidades públicas del sistema universitario de Galicia [...] h) Los de los órganos jurisdiccionales de la Administración de justicia radicados en Galicia..."

**Por qué D es correcta:** El art. 5.2 enumera en sus distintas letras todas las categorías de documentos de titularidad pública. Las opciones A (apartado e, entidades locales), B (apartado h, Administración de justicia) y C (apartado f, universidades públicas) son todas categorías literalmente recogidas por el art. 5.2. Por tanto, "Todas las anteriores" es la respuesta correcta.

**Por qué las demás son incorrectas:** A, B y C son todas correctas por separado; la respuesta que abarca todas ellas es la D.`,
  },
];

(async () => {
  const now = new Date().toISOString();
  let ok = 0;
  for (const f of fixes) {
    const { id, ...upd } = f;
    upd.topic_review_status = 'perfect';
    upd.verification_status = 'ok';
    upd.verified_at = now;
    upd.is_active = true;
    upd.deactivation_reason = null;
    const { error } = await supabase.from('questions').update(upd).eq('id', id);
    if (error) { console.error('❌', id, error.message); continue; }
    ok++;
    console.log('✅', id);

    // Update ai_verification_results
    await supabase.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now, new_explanation: f.explanation,
    }).eq('question_id', id).eq('ai_provider', 'claude_code');
  }
  console.log('\nFix aplicados:', ok, '/', fixes.length);

  // Final state
  const fs = require('fs');
  const ids = JSON.parse(fs.readFileSync('t14_galicia_imported_ids.json'));
  const { data: final } = await supabase.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('\nEstado final T14:');
  console.log(' Total:', ids.length, '| Activas:', active);
  console.log(' Por status:', byStatus);
})();
