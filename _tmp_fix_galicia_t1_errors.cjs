require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ART_53  = '27623efc-f09a-40ce-a5cc-4d5b7fe800d8';
const ART_55  = '261550f9-6c09-4588-80c9-bead0b12a167';
const ART_148 = '65d0dbf4-6459-469a-a067-1391a133eb4c';

const now = new Date().toISOString();

// Each fix: full update to a questions row.
// After fix, the question should become 'perfect' and be reactivated.
// Exception: #17 c5a5e1d4 stays inactive (out of scope).
const fixes = [
  // #1 06f3f629 — art 157 — bad_explanation
  {
    id: '06f3f629-21c8-4194-8ac6-f2efdcdb409e',
    explanation: "La opción D es incorrecta porque dice \"Fondo de Compensación territorial\" cuando el art. 157.1.c) CE establece \"Fondo de Compensación interterritorial\". Dicho Fondo sí figura entre los recursos de las Comunidades Autónomas recogidos en el art. 157.1, junto con impuestos cedidos y recargos (a), tributos propios (b), rendimientos patrimoniales (d) y el producto de operaciones de crédito (e).",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #2 14bf7d68 — art 99 — bad_explanation
  {
    id: '14bf7d68-207c-4272-85fb-523aacacd9ed',
    explanation: "Según el artículo 99.5 CE: \"Si transcurrido el plazo de dos meses, a partir de la primera votación de investidura, ningún candidato hubiere obtenido la confianza del Congreso, el Rey disolverá ambas Cámaras y convocará nuevas elecciones con el refrendo del Presidente del Congreso.\" La opción C reproduce literalmente este precepto.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #3 304a6721 — wrong_article 17→55 + bad_explanation
  {
    id: '304a6721-bdf9-4e41-a43a-bdbacc5c2857',
    primary_article_id: ART_55,
    explanation: "Según el art. 55.1 CE, los derechos del art. 17 (apartados 2 y 3) pueden suspenderse al declararse los estados de excepción o de sitio, pero se exceptúa expresamente el apartado 3 del art. 17 para el estado de excepción. Por tanto, el derecho del detenido a ser informado de sus derechos y a la asistencia de abogado (art. 17.3) solo puede suspenderse en estado de sitio. La respuesta correcta es la B.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #4 382f42ed — art 55 — bad_explanation
  {
    id: '382f42ed-185b-47f8-9caa-6b222a44cbe6',
    explanation: "El art. 55.1 CE enumera los derechos suspendibles cuando se acuerda la declaración del estado de excepción o de sitio, entre los que se incluye el del art. 37.2 (derecho de trabajadores y empresarios a adoptar medidas de conflicto colectivo). La respuesta correcta es la D. Nota: el art. 17.3 figura en la lista general pero está expresamente exceptuado del estado de excepción, solo puede suspenderse en estado de sitio.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #5 43f9b73d — estructura — bad_explanation
  {
    id: '43f9b73d-8845-4c5c-82a6-8893a3f4629a',
    explanation: "La Constitución Española ha sido reformada tres veces: en 1992 (art. 13.2, sufragio pasivo de extranjeros en elecciones municipales), en 2011 (art. 135, estabilidad presupuestaria) y en 2024 (art. 49, personas con discapacidad). Las tres reformas se tramitaron por el procedimiento ordinario del art. 167 CE. La respuesta correcta es la D.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #6 643fb4c4 — wrong_article 28→55
  {
    id: '643fb4c4-dd81-41d8-b5f7-16b4190ed2da',
    primary_article_id: ART_55,
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #7 64609f63 — wrong_article 14→53
  {
    id: '64609f63-9630-4623-8cfe-b19c2a3b5a0c',
    primary_article_id: ART_53,
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #8 68826a7a — art 13 — pregunta corrupta (opción D + explicación "Pendiente")
  {
    id: '68826a7a-14ce-4184-8c4e-3e9e256ca02c',
    option_d: "La extradición sólo se concederá en cumplimiento de un tratado o de la ley, atendiendo al principio de reciprocidad. Quedan excluidos de la extradición los delitos políticos, no considerándose como tales los actos de terrorismo.",
    explanation: "La opción D reproduce literalmente el art. 13.3 CE sobre la extradición. Las demás son falsas: la A es incorrecta porque la nacionalidad se regula por ley (art. 11 CE), no por disposiciones reglamentarias; la B es incorrecta porque la mayoría de edad es a los dieciocho años (art. 12 CE); la C es incorrecta porque el derecho de asilo se regula por ley, no por normas reglamentarias (art. 13.4 CE).",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #9 7ae4929f — Cap III Tit VIII — bad_explanation
  {
    id: '7ae4929f-88f1-41fd-a262-5fdaab4d99de',
    explanation: "El Capítulo III del Título VIII de la CE, titulado \"De las Comunidades Autónomas\", comprende los artículos 143 a 158. Los arts. 156-158 regulan específicamente la autonomía financiera de las CCAA dentro de ese capítulo, pero no constituyen el capítulo completo. La respuesta correcta es la C.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #10 b40a8f48 — art 153 — bad_explanation
  {
    id: 'b40a8f48-c904-48d5-9d68-c703986af838',
    explanation: "Según el art. 153.c) CE, el control de la actividad de la administración autónoma y sus normas reglamentarias corresponde a la jurisdicción contencioso-administrativa. El apartado b) se refiere al control por el Gobierno, previo dictamen del Consejo de Estado, del ejercicio de funciones delegadas del art. 150.2. La respuesta correcta es la D.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #11 b9962e61 — art 29 — bad_explanation
  {
    id: 'b9962e61-b330-427e-b618-3f7e6448df06',
    explanation: "Según el art. 29.2 CE: \"Los miembros de las Fuerzas o Institutos armados o de los Cuerpos sometidos a disciplina militar podrán ejercer este derecho sólo individualmente y con arreglo a lo dispuesto en su legislación específica.\" El derecho general de petición (individual y colectivo) se reconoce en el art. 29.1 para todos los españoles; la limitación a los militares está en el 29.2. La respuesta correcta es la B.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #12 edf50161 — wrong_article 149→148
  {
    id: 'edf50161-35c1-4c18-bdc7-fe6c453d76b9',
    primary_article_id: ART_148,
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #13 fd16a084 — art 29 — bad_explanation
  {
    id: 'fd16a084-c8a5-4c72-adc7-5397955dbecc',
    explanation: "Según el art. 29.1 CE: \"Todos los españoles tendrán el derecho de petición individual y colectiva, por escrito, en la forma y con los efectos que determine la ley.\" La opción D reproduce este precepto. La limitación a los miembros de las Fuerzas Armadas (solo individualmente) se recoge en el art. 29.2.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #14 24b6a041 — art 26 — opción C mal formulada
  {
    id: '24b6a041-99f8-46d9-ae66-4e8be5b37c3a',
    option_c: "Se prohíben en el ámbito de la Administración civil y de las organizaciones profesionales.",
    explanation: "El art. 26 CE establece: \"Se prohíben los Tribunales de Honor en el ámbito de la Administración civil y de las organizaciones profesionales.\" La opción C reproduce literalmente el precepto. Las demás son falsas: la A atribuye la prohibición al art. 25.4 (incorrecto); la B habla de la Administración Militar, que no aparece en el artículo; la D afirma su vigencia, contradiciendo la prohibición constitucional.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #15 84957d1a — art 110 — opción C mal redactada
  {
    id: '84957d1a-5b56-4403-83dd-f3fa0f3d486c',
    option_c: "Podrán solicitar que funcionarios de sus Departamentos informen ante las Cámaras y sus Comisiones.",
    explanation: "El art. 110.2 CE establece que los miembros del Gobierno (a) tienen acceso a las sesiones de las Cámaras y sus Comisiones, (b) tienen la facultad de hacerse oír en ellas y (c) podrán solicitar que informen ante las mismas funcionarios de sus Departamentos. Las tres facultades son correctas, por lo que la respuesta es la D.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #16 ec3b9dbf — art 56 — falso positivo del agente, literalizo la cita y marco perfect
  {
    id: 'ec3b9dbf-9e99-4360-8b11-a5bd92d60beb',
    explanation: "Según el art. 56.1 CE, el Rey \"asume la más alta representación del Estado español en las relaciones internacionales, especialmente con las naciones de su comunidad histórica\". La respuesta correcta es la B.",
    topic_review_status: 'perfect', is_active: true, deactivation_reason: null, verification_status: 'ok',
  },
  // #17 c5a5e1d4 — art 111 — FUERA DE SCOPE: la pregunta no corresponde a CE
  // Dejar inactiva con deactivation_reason específico
  {
    id: 'c5a5e1d4-0482-4c30-b781-cbe4f301cf85',
    topic_review_status: 'wrong_article',
    is_active: false,
    deactivation_reason: 'Fuera del scope del Tema 1: la "moción de urgencia sobre asuntos no incluidos en el orden del día" no corresponde al art. 111 CE ni a ningún otro artículo del temario constitucional. Pertenece al reglamento parlamentario o al ROF de la Administración Local.',
    verification_status: 'problem',
  },
];

(async () => {
  console.log('Aplicando', fixes.length, 'correcciones...\n');
  let ok = 0, fail = 0;
  for (const f of fixes) {
    const { id, ...updates } = f;
    updates.verified_at = now;
    const { error } = await supabase.from('questions').update(updates).eq('id', id);
    if (error) {
      console.error(`❌ ${id}:`, error.message);
      fail++;
    } else {
      const summary = [];
      if (updates.primary_article_id) summary.push('article');
      if (updates.option_c) summary.push('option_c');
      if (updates.option_d) summary.push('option_d');
      if (updates.explanation) summary.push('explanation');
      summary.push(updates.is_active ? 'active=true' : 'active=false');
      summary.push(`status=${updates.topic_review_status}`);
      console.log(`✅ ${id}: ${summary.join(', ')}`);
      ok++;
    }
  }
  console.log(`\nTotal: ${ok} OK, ${fail} fallos`);

  // Final verification
  const ids = fixes.map(f => f.id);
  const { data: finalState } = await supabase.from('questions')
    .select('id, is_active, topic_review_status, verification_status')
    .in('id', ids);
  const active = finalState.filter(q => q.is_active).length;
  const inactive = finalState.filter(q => !q.is_active).length;
  console.log(`\nEstado final: ${active} activas, ${inactive} inactivas`);

  // Overall state of all 366
  const allConsolidated = require('./galicia_t1_consolidated.json');
  const allIds = allConsolidated.map(r => r.id);
  const { count: totalActive } = await supabase.from('questions')
    .select('*', { count: 'exact', head: true })
    .in('id', allIds).eq('is_active', true);
  console.log(`\nTotal T1 Galicia activas: ${totalActive} / ${allIds.length}`);
})();
