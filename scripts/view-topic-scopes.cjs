const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ver topics con sus scopes y leyes
  const { data, error } = await supabase
    .from("topic_scope")
    .select(`
      topic_id,
      topics!inner(topic_number, title, position_type),
      law_id,
      laws!inner(name, short_name),
      article_numbers
    `)
    .eq("topics.position_type", "auxiliar_administrativo")
    .order("topics(topic_number)");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("=== TOPIC SCOPES AUXILIAR ADMINISTRATIVO ===\n");

  // Agrupar por topic
  const byTopic = {};
  data.forEach(d => {
    const key = d.topics.topic_number;
    if (!byTopic[key]) {
      byTopic[key] = { title: d.topics.title, laws: [] };
    }
    byTopic[key].laws.push({
      law: d.laws.short_name || d.laws.name,
      articles: d.article_numbers
    });
  });

  Object.keys(byTopic).sort((a,b) => a-b).forEach(num => {
    const t = byTopic[num];
    console.log("TEMA " + num + ": " + t.title);
    t.laws.forEach(l => {
      const arts = l.articles ? l.articles.slice(0, 15).join(", ") + (l.articles.length > 15 ? "..." : "") : "todos";
      console.log("  - " + l.law + ": arts " + arts);
    });
    console.log("");
  });
})();
