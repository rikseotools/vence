require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Traer logs 5-10 de golpe para ir mas rapido
  const { data: logs } = await supabase
    .from("ai_chat_logs")
    .select("id, message, full_response, question_context_id, question_context_law, created_at, user_id, response_time_ms")
    .eq("suggestion_used", "explicar_respuesta")
    .order("created_at", { ascending: false })
    .range(4, 9);

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    console.log(`\n${"=".repeat(60)}`);
    console.log(`=== LOG #${i + 5} explicar_respuesta ===`);
    console.log("Fecha:", new Date(log.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }));
    console.log("Ley:", log.question_context_law);
    console.log("Tiempo:", log.response_time_ms + "ms");

    const match = log.message.match(/en la pregunta: "(.+)/s);
    const fragment = match ? match[1].substring(0, 60).replace(/[%_]/g, "") : null;

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
    if (!question) { console.log("PREGUNTA NO ENCONTRADA"); continue; }

    const letters = ["A", "B", "C", "D"];
    console.log("ID:", question.id);
    console.log("Pregunta:", question.question_text.substring(0, 120));
    console.log("Correcta:", letters[question.correct_option]);
    console.log("Dificultad:", question.difficulty);
    console.log("Oficial:", question.is_official_exam ? "SI" : "No");
    console.log("Explicacion largo:", (question.explanation || "").length, "chars");
    
    // Evaluar calidad
    const exp = question.explanation || "";
    const hasMarkdown = exp.includes("**") || exp.includes("##") || exp.includes("> ");
    const hasLineBreaks = (exp.match(/\n/g) || []).length >= 3;
    const explainsBadOptions = exp.includes("A)") || exp.includes("incorrecta") || exp.includes("las dem");
    const isShort = exp.length < 300;
    
    let quality = "BUENA";
    if (!exp) quality = "VACIA";
    else if (isShort && !explainsBadOptions) quality = "INSUFICIENTE";
    else if (!hasMarkdown && !hasLineBreaks) quality = "SIN FORMATO";
    else if (!explainsBadOptions) quality = "NO EXPLICA INCORRECTAS";
    
    console.log("CALIDAD:", quality);
    if (quality !== "BUENA") {
      console.log("EXPLICACION ACTUAL:");
      console.log(exp.substring(0, 400));
    }
  }
})();
