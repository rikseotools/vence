const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROBLEMS_FILE = "/tmp/verification_problems.json";

function loadProblems() {
  try {
    if (fs.existsSync(PROBLEMS_FILE)) {
      return JSON.parse(fs.readFileSync(PROBLEMS_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function saveProblems(problems) {
  fs.writeFileSync(PROBLEMS_FILE, JSON.stringify(problems, null, 2));
}

async function saveVerification(questionId, result) {
  const { data: q } = await supabase
    .from("questions")
    .select(`
      id,
      question_text,
      primary_article_id,
      articles!questions_primary_article_id_fkey (
        id,
        law_id
      )
    `)
    .eq("id", questionId)
    .single();

  if (!q) {
    console.log("Pregunta no encontrada:", questionId);
    return false;
  }

  const verification = {
    question_id: q.id,
    article_id: q.articles?.id,
    law_id: q.articles?.law_id,
    is_correct: result.answerOk,
    confidence: "alta",
    explanation: result.reasoning,
    article_quote: result.articleQuote || null,
    suggested_fix: result.suggestedFix || null,
    correct_option_should_be: result.correctOptionShouldBe || null,
    ai_provider: "anthropic",
    ai_model: "claude-opus-4-5-real",
    verified_at: new Date().toISOString(),
    article_ok: result.articleOk,
    answer_ok: result.answerOk,
    explanation_ok: result.explanationOk,
    correct_article_suggestion: result.correctArticleSuggestion || null,
    explanation_fix: result.explanationFix || null
  };

  const { error } = await supabase
    .from("ai_verification_results")
    .insert(verification);

  if (error) {
    console.error("Error saving verification:", error);
    return false;
  }

  const status = result.articleOk && result.answerOk && result.explanationOk ? "ok" : "problem";
  const reviewStatus = result.status;

  await supabase
    .from("questions")
    .update({
      verification_status: status,
      topic_review_status: reviewStatus,
      verified_at: new Date().toISOString()
    })
    .eq("id", q.id);

  if (status === "problem") {
    const problems = loadProblems();
    problems.push({
      questionId: q.id,
      questionText: q.question_text,
      status: reviewStatus,
      articleOk: result.articleOk,
      answerOk: result.answerOk,
      explanationOk: result.explanationOk,
      reasoning: result.reasoning,
      suggestedFix: result.suggestedFix,
      correctOptionShouldBe: result.correctOptionShouldBe,
      explanationFix: result.explanationFix,
      timestamp: new Date().toISOString()
    });
    saveProblems(problems);
  }

  return true;
}

async function getPendingQuestions(limit = 30) {
  // Get verified with real model
  let realSet = new Set();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("ai_verification_results")
      .select("question_id")
      .eq("ai_model", "claude-opus-4-5-real")
      .range(offset, offset + 999);

    if (!data || data.length === 0) break;
    data.forEach(v => realSet.add(v.question_id));
    offset += 1000;
    if (data.length < 1000) break;
  }

  // Get active questions with articles
  let activeQuestions = [];
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from("questions")
      .select(`
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation,
        primary_article_id,
        is_official_exam,
        articles!questions_primary_article_id_fkey (
          id,
          article_number,
          content,
          law_id,
          laws (
            id,
            name,
            short_name
          )
        )
      `)
      .eq("is_active", true)
      .not("primary_article_id", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);

    if (!data || data.length === 0) break;
    activeQuestions.push(...data);
    offset += 1000;
    if (data.length < 1000) break;
  }

  // Filter pending
  const pending = activeQuestions.filter(q => !realSet.has(q.id));
  return pending.slice(0, limit);
}

(async () => {
  const pending = await getPendingQuestions(30);
  console.log("Preguntas pendientes obtenidas:", pending.length);

  pending.forEach((q, i) => {
    console.log("\n=== PREGUNTA " + (i+1) + " ===");
    console.log("ID:", q.id);
    console.log("Pregunta:", q.question_text);
    console.log("A:", q.option_a);
    console.log("B:", q.option_b);
    console.log("C:", q.option_c);
    console.log("D:", q.option_d);
    console.log("Respuesta:", q.correct_option, "(" + ["A","B","C","D"][q.correct_option] + ")");
    console.log("Explicacion:", q.explanation);
    console.log("Art:", q.articles?.article_number, "-", q.articles?.laws?.short_name || q.articles?.laws?.name);
    console.log("Contenido:", q.articles?.content);
  });
})();

module.exports = { saveVerification, getPendingQuestions };
