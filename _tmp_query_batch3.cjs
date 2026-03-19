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
    .range(20, 29);

  const seen = new Set();
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    const match = log.message.match(/en la pregunta: "(.+)/s);
    const fragment = match ? match[1].substring(0, 60).replace(/[%_]/g, "") : null;

    let question = null;
    if (log.question_context_id) {
      const { data } = await supabase
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty")
        .eq("id", log.question_context_id)
        .single();
      question = data;
    }
    if (!question && fragment) {
      const { data } = await supabase
        .from("questions")
        .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty")
        .ilike("question_text", "%" + fragment + "%")
        .limit(1);
      question = data?.[0];
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`LOG #${i + 21}`);
    console.log("Fecha:", new Date(log.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }));
    console.log("Ley:", log.question_context_law);

    if (!question) { console.log("PREGUNTA NO ENCONTRADA"); continue; }
    if (seen.has(question.id)) { console.log("DUPLICADA - ya vista"); continue; }
    seen.add(question.id);

    const letters = ["A", "B", "C", "D"];
    console.log("ID:", question.id);
    console.log("Pregunta:", question.question_text.substring(0, 130));
    console.log("Correcta:", letters[question.correct_option]);
    console.log("Dificultad:", question.difficulty);
    console.log("Explicacion:", (question.explanation || "").length, "chars");

    const exp = question.explanation || "";
    const hasMarkdown = exp.includes("**") || exp.includes("##") || exp.includes("> ");
    const hasLineBreaks = (exp.match(/\n/g) || []).length >= 3;
    const explainsBadOptions = exp.includes("A)") || exp.includes("incorrecta") || exp.includes("las dem") || exp.includes("Por qu");
    const isShort = exp.length < 300;

    let quality = "BUENA";
    if (!exp) quality = "VACIA";
    else if (isShort && !explainsBadOptions) quality = "INSUFICIENTE";
    else if (!hasMarkdown && !hasLineBreaks && exp.length < 500) quality = "SIN FORMATO";
    else if (!explainsBadOptions && exp.length < 600) quality = "NO EXPLICA INCORRECTAS";

    console.log("CALIDAD:", quality);
    if (quality !== "BUENA") {
      console.log("A)", question.option_a);
      console.log("B)", question.option_b);
      console.log("C)", question.option_c);
      console.log("D)", question.option_d);
      console.log("EXPLICACION:", exp.substring(0, 400));
    }
  }
})();
