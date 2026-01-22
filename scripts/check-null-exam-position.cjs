const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  console.log("🔍 Preguntas oficiales con exam_position NULL...\n");

  const { data, error } = await supabase
    .from("questions")
    .select("id, exam_source, exam_date, exam_entity")
    .eq("is_official_exam", true)
    .eq("is_active", true)
    .is("exam_position", null)
    .not("exam_source", "is", null);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total: ${data.length}\n`);

  data.forEach((q, i) => {
    console.log(`${i + 1}. ${q.exam_source}`);
    console.log(`   Fecha: ${q.exam_date || "N/A"}, Entidad: ${q.exam_entity || "N/A"}`);
    console.log(`   ID: ${q.id}\n`);
  });
})();
