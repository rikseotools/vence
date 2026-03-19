require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: logs } = await supabase
    .from("ai_chat_logs")
    .select("id, message, full_response, question_context_id, question_context_law, created_at, user_id, response_time_ms")
    .eq("suggestion_used", "explicar_respuesta")
    .order("created_at", { ascending: false })
    .range(3, 3);

  if (!logs || logs.length === 0) { console.log("No hay mas logs"); return; }

  const log = logs[0];
  console.log("=== LOG #4 explicar_respuesta ===");
  console.log("Fecha:", new Date(log.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }));
  console.log("Ley:", log.question_context_law);
  console.log("Tiempo:", log.response_time_ms + "ms");
  console.log("Question context ID:", log.question_context_id || "NO TIENE");

  const match = log.message.match(/en la pregunta: "(.+)/s);
  const fragment = match ? match[1].substring(0, 60).replace(/[%_]/g, "") : null;
  console.log("\nMensaje:", log.message.substring(0, 200));

  let question = null;
  if (log.question_context_id) {
    const { data } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, is_official_exam, exam_source, difficulty")
      .eq("id", log.question_context_id)
      .single();
    question = data;
  }
  if (!question && fragment) {
    const { data } = await supabase
      .from("questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, is_official_exam, exam_source, difficulty")
      .ilike("question_text", "%" + fragment + "%")
      .limit(1);
    question = data?.[0];
  }
  if (!question) { console.log("\nPREGUNTA NO ENCONTRADA EN BD"); return; }

  const letters = ["A", "B", "C", "D"];
  console.log("\n=== PREGUNTA EN BD ===");
  console.log("ID:", question.id);
  console.log("Texto:", question.question_text);
  console.log("A)", question.option_a);
  console.log("B)", question.option_b);
  console.log("C)", question.option_c);
  console.log("D)", question.option_d);
  console.log("Correcta:", letters[question.correct_option]);
  console.log("Dificultad:", question.difficulty);
  console.log("Oficial:", question.is_official_exam ? "SI - " + question.exam_source : "No");
  console.log("\nEXPLICACION (" + (question.explanation || "").length + " chars):");
  console.log(question.explanation || "(VACIA)");

  if (question.primary_article_id) {
    const { data: article } = await supabase
      .from("articles")
      .select("id, article_number, title, content, law_id")
      .eq("id", question.primary_article_id)
      .single();
    if (article) {
      const { data: law } = await supabase.from("laws").select("short_name, name").eq("id", article.law_id).single();
      console.log("\n=== ARTICULO ===");
      console.log("Ley:", law?.short_name || law?.name);
      console.log("Art:", article.article_number);
      console.log("Contenido:", (article.content || "").substring(0, 500));
    }
  }

  console.log("\n=== RESPUESTA IA ===");
  console.log((log.full_response || "(no guardada)").substring(0, 800));
})();
