require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Continuo desde rango 50+ pero saltando la que ya arregle
  const { data: logs } = await supabase
    .from("ai_chat_logs")
    .select("id, message, question_context_id, question_context_law, created_at")
    .eq("suggestion_used", "explicar_respuesta")
    .order("created_at", { ascending: false })
    .range(50, 90);

  const fixed = new Set(["9553bc73-95cc-4913-a17a-d6bec1c30c4e"]);
  const seen = new Set();

  for (const log of logs) {
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
    if (!question || seen.has(question.id) || fixed.has(question.id)) continue;
    seen.add(question.id);

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

    if (quality !== "BUENA") {
      const letters = ["A","B","C","D"];
      console.log("=== SIGUIENTE A MEJORAR ===");
      console.log("Fecha log:", new Date(log.created_at).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }));
      console.log("Ley:", log.question_context_law);
      console.log("ID:", question.id);
      console.log("Pregunta:", question.question_text);
      console.log("A)", question.option_a);
      console.log("B)", question.option_b);
      console.log("C)", question.option_c);
      console.log("D)", question.option_d);
      console.log("Correcta:", letters[question.correct_option]);
      console.log("Dificultad:", question.difficulty);
      console.log("Calidad:", quality);
      console.log("Explicacion actual (" + exp.length + " chars):");
      console.log(exp);

      if (question.primary_article_id) {
        const { data: a } = await supabase.from("articles").select("article_number, content, law_id").eq("id", question.primary_article_id).single();
        if (a) {
          const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
          console.log("\n=== ARTICULO VINCULADO ===");
          console.log(l?.short_name, "art.", a.article_number);
          console.log(a.content);
        }
      }
      return;
    }
  }
  console.log("Todas las preguntas en este rango tienen explicacion BUENA");
})();
