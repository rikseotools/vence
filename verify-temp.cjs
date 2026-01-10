const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyQuestion(questionId, articleId, isArticleOk, isAnswerOk, isExplanationOk, explanation, quote, status, suggestion = null) {
  // Eliminar verificación existente si hay
  await supabase.from("ai_verification_results").delete().eq("question_id", questionId);

  const insertData = {
    question_id: questionId,
    article_id: articleId,
    article_ok: isArticleOk,
    answer_ok: isAnswerOk,
    explanation_ok: isExplanationOk,
    confidence: "alta",
    explanation: explanation,
    article_quote: quote,
    ai_provider: "claude_code",
    ai_model: "claude-opus-4-5",
    verified_at: new Date().toISOString()
  };

  if (suggestion) {
    insertData.correct_article_suggestion = suggestion;
  }

  const { error: insertError } = await supabase.from("ai_verification_results").insert(insertData);

  if (insertError) {
    console.error("Error inserting:", insertError);
    return false;
  }

  const verificationStatus = (isArticleOk !== false && isAnswerOk && isExplanationOk) ? "ok" : "problem";

  const { error: qError } = await supabase
    .from("questions")
    .update({
      verification_status: verificationStatus,
      topic_review_status: status,
      verified_at: new Date().toISOString()
    })
    .eq("id", questionId);

  if (qError) {
    console.error("Error updating question:", qError);
    return false;
  }

  return true;
}

async function getNextPending() {
  const { data, error, count } = await supabase
    .from("questions")
    .select("id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id", { count: "exact" })
    .is("topic_review_status", null)
    .eq("is_active", true)
    .not("primary_article_id", "is", null)
    .limit(1)
    .single();

  return { question: data, error, totalPending: count };
}

async function getArticle(articleId) {
  const { data, error } = await supabase
    .from("articles")
    .select("id, article_number, title, content, law_id, laws(name, short_name)")
    .eq("id", articleId)
    .single();

  return { article: data, error };
}

async function main() {
  // Verificar pregunta Ley 39/2015 art. 16 - Asientos registro - PERFECT (ÚLTIMA)
  const savedQ1 = await verifyQuestion(
    "a924fea6-e714-40d6-97bc-e1bf839ff104",
    "14a310a8-f6b0-42e9-81be-7816cd1f543e",
    true, true, true,
    "PERFECT: Art. 16.2 Ley 39/2015: A es cita exacta. B incorrecto (dice 'deberán' pero es 'podrán'), C incorrecto (dice '3 días hábiles' pero es 'sin dilación'), D incorrecto (cada Admin tiene su propio registro).",
    "Art. 16.2: Los asientos se anotarán respetando el orden temporal de recepción o salida de los documentos, e indicarán la fecha del día en que se produzcan",
    "perfect"
  );

  if (savedQ1) {
    console.log("✅ PERFECT: Ley 39/2015 art. 16 - Asientos registro (ÚLTIMA PREGUNTA)");
  }

  // Obtener siguiente pregunta
  const { question, error, totalPending } = await getNextPending();

  if (error || !question) {
    console.log("No hay más preguntas pendientes o error:", error);
    return;
  }

  console.log("\n📊 Quedan", totalPending, "preguntas pendientes");
  console.log("\n📋 SIGUIENTE PREGUNTA:");
  console.log("ID:", question.id);
  console.log("Pregunta:", question.question_text);
  console.log("A:", question.option_a);
  console.log("B:", question.option_b);
  console.log("C:", question.option_c);
  console.log("D:", question.option_d);
  console.log("Correcta:", ["A", "B", "C", "D"][question.correct_option]);
  console.log("Explicación:", question.explanation);

  // Obtener artículo
  const { article, error: artError } = await getArticle(question.primary_article_id);

  if (artError || !article) {
    console.log("Error obteniendo artículo:", artError);
    return;
  }

  console.log("\n📖 ARTÍCULO VINCULADO:");
  console.log("Ley:", article.laws?.short_name || article.laws?.name);
  console.log("Artículo:", article.article_number);
  console.log("Título:", article.title);
  console.log("Contenido:", article.content);
}

main();
