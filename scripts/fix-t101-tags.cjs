const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/*
 * SCOPES OFICIALES (auxiliar_administrativo):
 *
 * T1: La Constitución Española de 1978. Características. Los principios constitucionales
 *     y los valores superiores. Derechos y deberes fundamentales. Su garantía y suspensión.
 *
 * T2: El Tribunal Constitucional. La reforma de la Constitución. La Corona.
 *     Funciones constitucionales del Rey. Sucesión y regencia.
 *
 * T3: Las Cortes Generales. Composición, atribuciones y funcionamiento del
 *     Congreso de los Diputados y del Senado. El Defensor del Pueblo.
 *
 * T4: Poder Judicial (Arts. 117-127 CE), LOPJ, Ministerio Fiscal
 *
 * T5: El Gobierno: Presidente, Consejo de Ministros. Designación, cese, responsabilidad.
 */

function determinarTema(texto, explicacion) {
  const t = (texto + " " + (explicacion || "")).toLowerCase();

  // ==================== T2: TC + REFORMA + CORONA ====================
  // Tribunal Constitucional
  if (t.includes("tribunal constitucional")) return "T2";
  if (t.includes("lotc") || t.includes("ley orgánica 2/1979") || t.includes("ley orgánica del tribunal constitucional")) return "T2";
  if (t.includes("magistrado") && t.includes("constitucional")) return "T2";
  if (t.includes("recurso de inconstitucionalidad") || t.includes("cuestión de inconstitucionalidad")) return "T2";
  if (t.includes("recurso de amparo")) return "T2"; // El amparo es competencia del TC

  // Reforma de la Constitución (Arts. 166-169 CE)
  if (t.includes("reforma constitucional") || t.includes("reforma de la constitución")) return "T2";
  if (t.includes("artículo 166") || t.includes("artículo 167") || t.includes("artículo 168") || t.includes("artículo 169")) return "T2";

  // La Corona (Arts. 56-65 CE)
  if (t.includes("la corona")) return "T2";
  if (t.includes("el rey") || t.includes("del rey") || t.includes("al rey")) return "T2";
  if (t.includes("la reina") || t.includes("príncipe") || t.includes("princesa")) return "T2";
  if (t.includes("refrendo") || t.includes("abdicación") || t.includes("regencia") || t.includes("tutor")) return "T2";
  if (t.includes("sucesión") && (t.includes("corona") || t.includes("trono"))) return "T2";
  if (t.includes("jefatura del estado") || t.includes("jefe del estado")) return "T2";
  if (t.includes("artículo 56") || t.includes("artículo 57") || t.includes("artículo 58") || t.includes("artículo 59")) return "T2";
  if (t.includes("artículo 60") || t.includes("artículo 61") || t.includes("artículo 62") || t.includes("artículo 63")) return "T2";
  if (t.includes("artículo 64") || t.includes("artículo 65")) return "T2";
  // Arts. 159-165 CE (Tribunal Constitucional)
  if (t.includes("artículo 159") || t.includes("artículo 160") || t.includes("artículo 161")) return "T2";
  if (t.includes("artículo 162") || t.includes("artículo 163") || t.includes("artículo 164") || t.includes("artículo 165")) return "T2";

  // ==================== T3: CORTES GENERALES + DEFENSOR ====================
  // Defensor del Pueblo
  if (t.includes("defensor del pueblo")) return "T3";
  if (t.includes("ley orgánica 3/1981")) return "T3";

  // Cortes Generales (Arts. 66-96 CE)
  if (t.includes("cortes generales")) return "T3";
  if (t.includes("congreso de los diputados") || t.includes("congreso de diputados")) return "T3";
  if ((t.includes("senado") || t.includes("senador")) && !t.includes("reforma constitucional")) return "T3";
  if (t.includes("diputado") && !t.includes("diputación provincial")) return "T3";
  if (t.includes("reglamento del congreso") || t.includes("reglamento del senado")) return "T3";
  if (t.includes("diputación permanente") || t.includes("comisión permanente")) return "T3";
  if (t.includes("sesiones plenarias") || t.includes("pleno de las cámaras")) return "T3";
  if (t.includes("inviolabilidad") && (t.includes("diputado") || t.includes("senador") || t.includes("parlamentar"))) return "T3";
  if (t.includes("inmunidad parlamentaria") || t.includes("suplicatorio")) return "T3";
  // Arts. 66-96 CE (Cortes)
  if (t.includes("artículo 66") || t.includes("artículo 67") || t.includes("artículo 68") || t.includes("artículo 69")) return "T3";
  if (t.includes("artículo 70") || t.includes("artículo 71") || t.includes("artículo 72") || t.includes("artículo 73")) return "T3";
  if (t.includes("artículo 74") || t.includes("artículo 75") || t.includes("artículo 76") || t.includes("artículo 77")) return "T3";
  if (t.includes("artículo 78") || t.includes("artículo 79") || t.includes("artículo 80")) return "T3";
  if (t.includes("artículo 81") || t.includes("artículo 82") || t.includes("artículo 83") || t.includes("artículo 84")) return "T3";
  if (t.includes("artículo 85") || t.includes("artículo 86") || t.includes("artículo 87") || t.includes("artículo 88")) return "T3";
  if (t.includes("artículo 89") || t.includes("artículo 90") || t.includes("artículo 91") || t.includes("artículo 92")) return "T3";
  if (t.includes("artículo 93") || t.includes("artículo 94") || t.includes("artículo 95") || t.includes("artículo 96")) return "T3";
  // Leyes orgánicas, ordinarias, decretos-ley, delegación legislativa
  if (t.includes("ley orgánica") && t.includes("aprobación")) return "T3";
  if (t.includes("decreto-ley") || t.includes("decreto ley")) return "T3";
  if (t.includes("delegación legislativa") || t.includes("decreto legislativo")) return "T3";

  // ==================== T4: PODER JUDICIAL ====================
  if (t.includes("poder judicial")) return "T4";
  if (t.includes("consejo general del poder judicial") || t.includes("cgpj")) return "T4";
  if (t.includes("tribunal supremo")) return "T4";
  if (t.includes("ministerio fiscal") || t.includes("fiscal general")) return "T4";
  if (t.includes("jueces y magistrados") || t.includes("juez") && t.includes("magistrado")) return "T4";
  if (t.includes("lopj") || t.includes("ley orgánica del poder judicial")) return "T4";
  // Arts. 117-127 CE
  if (t.includes("artículo 117") || t.includes("artículo 118") || t.includes("artículo 119") || t.includes("artículo 120")) return "T4";
  if (t.includes("artículo 121") || t.includes("artículo 122") || t.includes("artículo 123") || t.includes("artículo 124")) return "T4";
  if (t.includes("artículo 125") || t.includes("artículo 126") || t.includes("artículo 127")) return "T4";

  // ==================== T5: GOBIERNO ====================
  if (t.includes("presidente del gobierno")) return "T5";
  if (t.includes("consejo de ministros")) return "T5";
  if (t.includes("vicepresidente del gobierno") || t.includes("vicepresidentes del gobierno")) return "T5";
  if (t.includes("ministro") && !t.includes("ministerio fiscal")) return "T5";
  if (t.includes("moción de censura")) return "T5";
  if (t.includes("cuestión de confianza")) return "T5";
  if (t.includes("ley 50/1997") || t.includes("ley del gobierno")) return "T5";
  if (t.includes("investidura")) return "T5";
  // Arts. 97-107 CE
  if (t.includes("artículo 97") || t.includes("artículo 98") || t.includes("artículo 99") || t.includes("artículo 100")) return "T5";
  if (t.includes("artículo 101") || t.includes("artículo 102") || t.includes("artículo 103") || t.includes("artículo 104")) return "T5";
  if (t.includes("artículo 105") || t.includes("artículo 106") || t.includes("artículo 107")) return "T5";

  // ==================== T1: CONSTITUCIÓN GENERAL ====================
  // Título Preliminar (Arts. 1-9)
  if (t.includes("título preliminar")) return "T1";
  if (t.includes("estado social") || t.includes("estado democrático") || t.includes("estado de derecho")) return "T1";
  if (t.includes("soberanía nacional") || t.includes("soberanía popular")) return "T1";
  if (t.includes("valores superiores") || t.includes("libertad, la justicia")) return "T1";
  if (t.includes("unidad de la nación") || t.includes("autonomía de las nacionalidades")) return "T1";
  if (t.includes("lenguas españolas") || t.includes("castellano") && t.includes("oficial")) return "T1";
  if (t.includes("partidos políticos") || t.includes("sindicatos") || t.includes("asociaciones empresariales")) return "T1";
  if (t.includes("fuerzas armadas")) return "T1";
  if (t.includes("principio de legalidad") || t.includes("jerarquía normativa") || t.includes("seguridad jurídica")) return "T1";
  if (t.includes("irretroactividad") || t.includes("retroactividad")) return "T1";

  // Derechos y deberes fundamentales (Arts. 10-55)
  if (t.includes("derechos fundamentales") || t.includes("libertades públicas")) return "T1";
  if (t.includes("dignidad de la persona") || t.includes("derechos inviolables")) return "T1";
  if (t.includes("nacionalidad") || t.includes("mayoría de edad")) return "T1";
  if (t.includes("extranjeros") || t.includes("extradición") || t.includes("asilo")) return "T1";
  if (t.includes("derecho a la vida") || t.includes("pena de muerte")) return "T1";
  if (t.includes("integridad física") || t.includes("tortura")) return "T1";
  if (t.includes("libertad ideológica") || t.includes("libertad religiosa")) return "T1";
  if (t.includes("libertad personal") || t.includes("detención") || t.includes("habeas corpus")) return "T1";
  if (t.includes("derecho al honor") || t.includes("intimidad") || t.includes("propia imagen")) return "T1";
  if (t.includes("inviolabilidad del domicilio")) return "T1";
  if (t.includes("secreto de las comunicaciones")) return "T1";
  if (t.includes("libertad de residencia") || t.includes("libertad de circulación")) return "T1";
  if (t.includes("libertad de expresión") || t.includes("libertad de información")) return "T1";
  if (t.includes("derecho de reunión") || t.includes("derecho de manifestación")) return "T1";
  if (t.includes("derecho de asociación")) return "T1";
  if (t.includes("derecho de participación") || t.includes("sufragio")) return "T1";
  if (t.includes("tutela judicial") || t.includes("tutela efectiva")) return "T1";
  if (t.includes("principio de legalidad penal") || t.includes("nullum crimen")) return "T1";
  if (t.includes("derecho a la educación") || t.includes("libertad de enseñanza")) return "T1";
  if (t.includes("libertad sindical") || t.includes("derecho de huelga")) return "T1";
  if (t.includes("derecho de petición")) return "T1";
  if (t.includes("deber de defender") || t.includes("servicio militar")) return "T1";
  if (t.includes("sistema tributario") || t.includes("deber de contribuir")) return "T1";
  if (t.includes("derecho a contraer matrimonio")) return "T1";
  if (t.includes("propiedad privada") || t.includes("derecho a la propiedad")) return "T1";
  if (t.includes("fundaciones")) return "T1";
  if (t.includes("derecho al trabajo") || t.includes("negociación colectiva")) return "T1";
  if (t.includes("seguridad social")) return "T1";
  if (t.includes("protección de la salud")) return "T1";
  if (t.includes("medio ambiente")) return "T1";
  if (t.includes("patrimonio histórico") || t.includes("patrimonio cultural")) return "T1";
  if (t.includes("derecho a la vivienda")) return "T1";
  if (t.includes("juventud") || t.includes("tercera edad") || t.includes("disminuidos")) return "T1";
  if (t.includes("consumidores") || t.includes("usuarios")) return "T1";
  // Garantía de derechos (Arts. 53-54)
  if (t.includes("garantía de los derechos") || t.includes("suspensión de los derechos")) return "T1";
  if (t.includes("artículo 53") || t.includes("artículo 54") || t.includes("artículo 55")) return "T1";

  // Artículos específicos del Título Preliminar y Título I
  if (t.includes("artículo 1") || t.includes("artículo 2") || t.includes("artículo 3") || t.includes("artículo 4")) return "T1";
  if (t.includes("artículo 5") || t.includes("artículo 6") || t.includes("artículo 7") || t.includes("artículo 8") || t.includes("artículo 9")) return "T1";
  if (t.includes("artículo 10") || t.includes("artículo 11") || t.includes("artículo 12") || t.includes("artículo 13") || t.includes("artículo 14") || t.includes("artículo 15")) return "T1";
  if (t.includes("artículo 16") || t.includes("artículo 17") || t.includes("artículo 18") || t.includes("artículo 19") || t.includes("artículo 20")) return "T1";
  if (t.includes("artículo 21") || t.includes("artículo 22") || t.includes("artículo 23") || t.includes("artículo 24") || t.includes("artículo 25")) return "T1";
  if (t.includes("artículo 26") || t.includes("artículo 27") || t.includes("artículo 28") || t.includes("artículo 29") || t.includes("artículo 30")) return "T1";
  if (t.includes("artículo 31") || t.includes("artículo 32") || t.includes("artículo 33") || t.includes("artículo 34") || t.includes("artículo 35")) return "T1";
  if (t.includes("artículo 36") || t.includes("artículo 37") || t.includes("artículo 38") || t.includes("artículo 39") || t.includes("artículo 40")) return "T1";
  if (t.includes("artículo 41") || t.includes("artículo 42") || t.includes("artículo 43") || t.includes("artículo 44") || t.includes("artículo 45")) return "T1";
  if (t.includes("artículo 46") || t.includes("artículo 47") || t.includes("artículo 48") || t.includes("artículo 49") || t.includes("artículo 50")) return "T1";
  if (t.includes("artículo 51") || t.includes("artículo 52")) return "T1";

  // Si menciona CE o Constitución de forma genérica, por defecto T1
  if (t.includes("constitución española")) return "T1";
  if (/ ce[,.\s]/.test(t) || / ce$/.test(t)) return "T1";

  return "T1"; // Por defecto, asignar a T1 si es de Bloque I y no se puede clasificar
}

(async () => {
  let processed = 0;
  let stats = { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0, manual: 0 };
  let manualReview = [];

  while (true) {
    const { data, count } = await supabase
      .from("questions")
      .select("id, question_text, explanation", { count: "exact" })
      .contains("tags", ["T101"])
      .order("created_at")
      .limit(1);

    if (!data || data.length === 0) {
      console.log("\n=== COMPLETADO ===");
      break;
    }

    const q = data[0];
    const nuevoTema = determinarTema(q.question_text, q.explanation);

    if (nuevoTema) {
      await supabase.from("questions").update({ tags: [nuevoTema, "Bloque I"] }).eq("id", q.id);
      stats[nuevoTema]++;
    } else {
      // Marcar para revisión manual pero seguir (dejar en T101)
      stats.manual++;
      manualReview.push({ id: q.id, texto: q.question_text.substring(0, 100) });
      // Mover a T1 por defecto si no se puede clasificar
      await supabase.from("questions").update({ tags: ["T1", "Bloque I"] }).eq("id", q.id);
      stats.T1++;
      stats.manual--;
    }

    processed++;

    // Resumen cada 30
    if (processed % 30 === 0) {
      console.log("\n=== RESUMEN (procesadas " + processed + ", quedan " + (count - 1) + ") ===");
      console.log("T1 (Constitución general):", stats.T1);
      console.log("T2 (TC/Reforma/Corona):", stats.T2);
      console.log("T3 (Cortes/Defensor):", stats.T3);
      console.log("T4 (Poder Judicial):", stats.T4);
      console.log("T5 (Gobierno):", stats.T5);
    }
  }

  console.log("\n=== RESUMEN FINAL ===");
  console.log("Total procesadas:", processed);
  console.log("T1 (Constitución general):", stats.T1);
  console.log("T2 (TC/Reforma/Corona):", stats.T2);
  console.log("T3 (Cortes/Defensor):", stats.T3);
  console.log("T4 (Poder Judicial):", stats.T4);
  console.log("T5 (Gobierno):", stats.T5);
})();
