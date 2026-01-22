const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log("🔧 Clasificando preguntas con NULL basándose en exam_entity...\n");

  // Buscar preguntas con exam_position NULL pero con exam_entity
  const { data: nullQuestions, error: findError } = await supabase
    .from("questions")
    .select("id, exam_source, exam_entity")
    .eq("is_official_exam", true)
    .is("exam_position", null)
    .not("exam_entity", "is", null);

  if (findError) {
    console.error("❌ Error buscando:", findError);
    return;
  }

  console.log(`📊 Encontradas ${nullQuestions.length} preguntas con exam_entity pero sin exam_position\n`);

  // Agrupar por exam_entity
  const byEntity = {};
  nullQuestions.forEach(q => {
    const entity = q.exam_entity;
    if (!byEntity[entity]) byEntity[entity] = [];
    byEntity[entity].push(q);
  });

  // Mapeo de exam_entity → exam_position
  const ENTITY_MAP = {
    "Auxiliar Administrativo Estado": "auxiliar_administrativo_estado",
    "Auxiliar Administrativo del Estado": "auxiliar_administrativo_estado",
    "AGE": "auxiliar_administrativo_estado", // Asumir que AGE sin más especificación es Auxiliar
    "Administrativo Estado": "administrativo",
    "Administrativo del Estado": "administrativo",
    "Tramitación Procesal": "tramitacion_procesal",
    "Auxilio Judicial": "auxilio_judicial",
  };

  for (const [entity, questions] of Object.entries(byEntity)) {
    const newPosition = ENTITY_MAP[entity];

    console.log(`\n📝 exam_entity = "${entity}" (${questions.length} preguntas)`);

    if (!newPosition) {
      console.log(`   ⚠️  No hay mapeo definido, saltando...`);
      continue;
    }

    console.log(`   → Asignando exam_position = "${newPosition}"`);

    const ids = questions.map(q => q.id);
    const { data: updated, error: updateError } = await supabase
      .from("questions")
      .update({ exam_position: newPosition })
      .in("id", ids)
      .select("id");

    if (updateError) {
      console.error(`   ❌ Error:`, updateError);
    } else {
      console.log(`   ✅ Actualizadas ${updated.length} preguntas`);
    }
  }

  console.log("\n✅ Proceso completado");
})();
