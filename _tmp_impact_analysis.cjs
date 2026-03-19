require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get Tema 1 scope
  const { data: t1 } = await supabase.from("topics")
    .select("id").eq("topic_number", 1).eq("position_type", "auxiliar_administrativo").single();

  const { data: t1Scope } = await supabase.from("topic_scope")
    .select("id, law_id, article_numbers")
    .eq("topic_id", t1.id);

  // CE law ID
  const { data: ceLaw } = await supabase.from("laws").select("id").eq("short_name", "CE").single();
  const ceScope = t1Scope.find(s => s.law_id === ceLaw.id);
  const currentArts = ceScope.article_numbers || [];

  // Articles to remove
  const toRemove = ["56", "68", "87", "117", "128", "137", "159", "160", "161", "162", "164", "165", "166", "167", "168", "169"];
  const newArts = currentArts.filter(a => !toRemove.includes(a));

  console.log("=== SCOPE ACTUAL TEMA 1 (CE) ===");
  console.log("Artículos actuales:", currentArts.length, "→", currentArts.sort((a,b) => Number(a)-Number(b)).join(", "));
  console.log("\nArtículos a eliminar:", toRemove.join(", "));
  console.log("Artículos que quedarían:", newArts.length, "→", newArts.sort((a,b) => Number(a)-Number(b)).join(", "));

  // Count questions currently in Tema 1 scope (CE only for now)
  // Get all articles for CE with these article_numbers
  const { data: currentCeArticles } = await supabase.from("articles")
    .select("id, article_number")
    .eq("law_id", ceLaw.id)
    .in("article_number", currentArts);

  const currentArtIds = currentCeArticles.map(a => a.id);

  const { data: currentQuestions, count: currentCount } = await supabase.from("questions")
    .select("id", { count: "exact" })
    .in("primary_article_id", currentArtIds)
    .eq("is_active", true);

  console.log("\n=== PREGUNTAS ACTUALES TEMA 1 (solo CE) ===");
  console.log("Total preguntas activas:", currentCount);

  // Count questions that would remain
  const { data: newCeArticles } = await supabase.from("articles")
    .select("id, article_number")
    .eq("law_id", ceLaw.id)
    .in("article_number", newArts);

  const newArtIds = newCeArticles.map(a => a.id);

  const { count: newCount } = await supabase.from("questions")
    .select("id", { count: "exact" })
    .in("primary_article_id", newArtIds)
    .eq("is_active", true);

  console.log("Preguntas que quedarían:", newCount);
  console.log("Preguntas que se quitarían:", currentCount - newCount);

  // Now count how many questions are in each removed article
  console.log("\n=== PREGUNTAS POR ARTÍCULO ELIMINADO ===");
  for (const artNum of toRemove) {
    const { data: artRows } = await supabase.from("articles")
      .select("id")
      .eq("law_id", ceLaw.id)
      .eq("article_number", artNum);

    if (artRows && artRows.length > 0) {
      const artId = artRows[0].id;
      const { count } = await supabase.from("questions")
        .select("id", { count: "exact" })
        .eq("primary_article_id", artId)
        .eq("is_active", true);
      console.log("  CE art." + artNum + ":", count, "preguntas");
    } else {
      console.log("  CE art." + artNum + ": artículo no existe en BD");
    }
  }

  // Now verify these articles are covered in their correct temas
  console.log("\n=== VERIFICACIÓN: ¿ESTÁN CUBIERTOS EN SUS TEMAS? ===\n");

  const artToTema = {
    "56": 2, "68": 3, "87": 3, "117": 4,
    "128": null, "137": 9,
    "159": 2, "160": 2, "161": 2, "162": 2, "164": 2, "165": 2,
    "166": 2, "167": 2, "168": 2, "169": 2
  };

  const temasToCheck = [...new Set(Object.values(artToTema).filter(Boolean))]; // [2, 3, 4, 9]

  for (const temaNum of temasToCheck) {
    const { data: tema } = await supabase.from("topics")
      .select("id, title")
      .eq("topic_number", temaNum)
      .eq("position_type", "auxiliar_administrativo")
      .single();

    if (!tema) { console.log("Tema " + temaNum + ": NO ENCONTRADO"); continue; }

    const { data: scope } = await supabase.from("topic_scope")
      .select("law_id, article_numbers")
      .eq("topic_id", tema.id);

    const ceEntry = scope.find(s => s.law_id === ceLaw.id);
    const temaArts = ceEntry ? (ceEntry.article_numbers || []) : [];

    // Which of our removed articles should be in this tema?
    const expectedArts = Object.entries(artToTema)
      .filter(([_, t]) => t === temaNum)
      .map(([a, _]) => a);

    console.log("Tema " + temaNum + " (" + tema.title + "):");
    console.log("  CE arts en scope:", temaArts.sort((a,b) => Number(a)-Number(b)).join(", "));
    
    for (const expArt of expectedArts) {
      const inScope = temaArts.includes(expArt);
      console.log("  Art. " + expArt + ": " + (inScope ? "✅ YA ESTÁ en Tema " + temaNum : "❌ FALTA en Tema " + temaNum));
    }
    console.log();
  }

  // Check art 128 specifically
  console.log("Art. 128 (Economía) - no asignado a ningún tema específico:");
  for (const tNum of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]) {
    const { data: t } = await supabase.from("topics")
      .select("id")
      .eq("topic_number", tNum)
      .eq("position_type", "auxiliar_administrativo")
      .single();
    if (!t) continue;
    const { data: sc } = await supabase.from("topic_scope")
      .select("law_id, article_numbers")
      .eq("topic_id", t.id);
    const ce = sc.find(s => s.law_id === ceLaw.id);
    if (ce && ce.article_numbers && ce.article_numbers.includes("128")) {
      console.log("  ✅ Encontrado en Tema " + tNum);
    }
  }
})();
