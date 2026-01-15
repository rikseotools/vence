const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: all, error: err1 } = await supabase
    .from("questions")
    .select("id, question_text, correct_option, primary_article_id, explanation")
    .ilike("exam_source", "%Auxilio Judicial%")
    .order("id", { ascending: true });
  
  console.log("Total preguntas Auxilio Judicial:", all?.length || 0);
  
  const conArticulo = all?.filter(q => q.primary_article_id) || [];
  const conExplicacion = all?.filter(q => q.explanation) || [];
  const completas = all?.filter(q => q.primary_article_id && q.explanation) || [];
  const pendientes = all?.filter(q => !q.primary_article_id || !q.explanation) || [];
  
  console.log("\nEstadísticas:");
  console.log("- Con primary_article_id:", conArticulo.length);
  console.log("- Con explanation:", conExplicacion.length);
  console.log("- Completas (ambos):", completas.length);
  console.log("- Pendientes (falta alguno):", pendientes.length);
  
  if (pendientes.length > 0) {
    console.log("\nPrimeras 10 pendientes:");
    pendientes.slice(0, 10).forEach((q, i) => {
      console.log("\n" + (i+1) + ". ID " + q.id + ": " + (q.question_text?.substring(0, 120) || ""));
      console.log("   article_id: " + (q.primary_article_id || "NULL") + ", explanation: " + (q.explanation ? "Sí" : "NULL"));
    });
  }
})();
