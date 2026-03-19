require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  for (let i = 0; i < disputes.length; i++) {
    const d = disputes[i];
    const { data: q } = await supabase.from("questions")
      .select("question_text, option_a, option_b, option_c, option_d, correct_option, primary_article_id, tags")
      .eq("id", d.question_id).single();

    if (!q) { console.log("#" + (i+1) + " | PREGUNTA NO ENCONTRADA: " + d.question_id); continue; }

    let artStr = "SIN ARTÍCULO";
    let linkedNum = "";
    if (q.primary_article_id) {
      const { data: a } = await supabase.from("articles").select("article_number, display_number, title, law_id").eq("id", q.primary_article_id).single();
      if (a) {
        const { data: l } = await supabase.from("laws").select("short_name").eq("id", a.law_id).single();
        artStr = (l ? l.short_name : "?") + " art." + (a.display_number || a.article_number);
        linkedNum = a.article_number;
      }
    }

    // Does question text mention a specific article number?
    const artMatch = q.question_text.match(/art[íi]culo\s+(\d+[\.\d]*)/i);
    const artMatch2 = q.question_text.match(/art\.\s*(\d+[\.\d]*)/i);
    const mentioned = artMatch ? artMatch[1] : (artMatch2 ? artMatch2[1] : null);

    const coincide = mentioned && linkedNum && mentioned === linkedNum;
    const status = !mentioned ? "?" : (coincide ? "OK" : "MISMATCH");

    console.log("#" + (i+1) + " [" + status + "] Vinculada: " + artStr + (mentioned ? " | Menciona: art." + mentioned : ""));
    console.log("  Q: " + q.question_text.substring(0, 120));
    console.log("  R: " + ["A","B","C","D"][q.correct_option] + ") " + [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]);
    console.log("  Tags: " + JSON.stringify(q.tags));
    console.log();
  }
})();
