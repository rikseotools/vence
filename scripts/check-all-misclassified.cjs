const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Mapeo de patrones en exam_source → exam_position correcto
const EXPECTED_MAPPING = {
  "Auxiliar Administrativo": "auxiliar_administrativo_estado",
  "Cuerpo General Auxiliar": "auxiliar_administrativo_estado",
  "AUX-L": "auxiliar_administrativo_estado",
  "AUX-PI": "auxiliar_administrativo_estado",
  "Tramitación Procesal": "tramitacion_procesal",
  "Tramitaci": "tramitacion_procesal",
  "Auxilio Judicial": "auxilio_judicial",
  "Gestión Procesal": "gestion_procesal",
  "Cuerpo de Gestión": "cuerpo_gestion_administracion_civil",
  "Gestión de la Administración Civil": "cuerpo_gestion_administracion_civil",
  "Administrativo del Estado": "administrativo",
  "Cuerpo General Administrativo": "administrativo",
  "ADM-L": "administrativo",
  "ADM-PI": "administrativo",
};

(async () => {
  console.log("🔍 Buscando preguntas oficiales mal clasificadas...\n");

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, exam_source, exam_position")
    .eq("is_official_exam", true)
    .eq("is_active", true)
    .not("exam_source", "is", null);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total preguntas oficiales con exam_source: ${questions.length}\n`);

  const misclassified = [];

  questions.forEach(q => {
    const examSource = q.exam_source || "";
    const currentPosition = q.exam_position;

    // Determinar posición esperada basada en exam_source
    let expectedPosition = null;
    for (const [pattern, position] of Object.entries(EXPECTED_MAPPING)) {
      if (examSource.toLowerCase().includes(pattern.toLowerCase())) {
        expectedPosition = position;
        break;
      }
    }

    if (expectedPosition && currentPosition && currentPosition !== expectedPosition) {
      misclassified.push({
        id: q.id,
        exam_source: examSource,
        current: currentPosition,
        expected: expectedPosition,
      });
    }
  });

  if (misclassified.length === 0) {
    console.log("✅ No se encontraron preguntas mal clasificadas");
  } else {
    console.log(`⚠️  Encontradas ${misclassified.length} preguntas mal clasificadas:\n`);

    // Agrupar por tipo de error
    const byError = {};
    misclassified.forEach(q => {
      const key = `${q.current} → ${q.expected}`;
      if (!byError[key]) byError[key] = [];
      byError[key].push(q);
    });

    Object.entries(byError).forEach(([errorType, questions]) => {
      console.log(`\n📝 ${errorType} (${questions.length} preguntas)`);
      questions.slice(0, 3).forEach(q => {
        console.log(`   - ${q.exam_source.substring(0, 60)}...`);
      });
      if (questions.length > 3) console.log(`   ... y ${questions.length - 3} más`);
    });
  }

  // También buscar preguntas con exam_position NULL que podrían clasificarse
  const { data: nullPositions } = await supabase
    .from("questions")
    .select("id, exam_source")
    .eq("is_official_exam", true)
    .eq("is_active", true)
    .is("exam_position", null)
    .not("exam_source", "is", null);

  if (nullPositions && nullPositions.length > 0) {
    console.log(`\n\n📊 Preguntas con exam_position NULL que podrían clasificarse: ${nullPositions.length}`);

    const bySource = {};
    nullPositions.forEach(q => {
      const source = q.exam_source.substring(0, 50);
      bySource[source] = (bySource[source] || 0) + 1;
    });

    Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([source, count]) => {
        console.log(`   - "${source}...": ${count}`);
      });
  }
})();
