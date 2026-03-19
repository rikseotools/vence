require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.121.2 alzada remision (variante)
  const exp1 = `**Articulo 121.2 de la Ley 39/2015** (Recurso de alzada):

> "Cuando el recurso se hubiera interpuesto ante el organo que dicto el acto impugnado, este debera **remitirlo al competente en el plazo de diez dias**, con su **informe** y con una **copia completa y ordenada del expediente**."

**Por que A es correcta:**
El art. 121.2 establece que si el recurso se presenta ante el organo que dicto el acto (no ante el competente para resolver), ese organo debe remitirlo en **10 dias** con informe y expediente completo. No inadmite ni rechaza: lo tramita remitiendolo.

**Por que las demas son incorrectas:**

- **B)** "Lo inadmitira y emplazara a los interesados". Falso: no existe inadmision por presentar el recurso ante el organo que dicto el acto. El art. 121.1 permite presentarlo ante el propio organo o ante el superior. El organo tiene la obligacion de remitirlo.

- **C)** "Lo inadmitira a tramite". Falso: misma razon que B. No cabe inadmision por esta causa.

- **D)** "En el plazo de **cinco** dias". Falso: el plazo es de **diez** dias (art. 121.2), no cinco. Es un cambio numerico tipico de examen.

**Clave:** Recurso de alzada presentado ante el organo que dicto el acto = remision en **10 dias** + informe + expediente completo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0e340fa7-4a27-4a68-8592-91cefb7a2329");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.121 alzada v2 (" + exp1.length + " chars)");

  // #2 - CE art.113 mocion censura 5 dias
  const exp2 = `**Articulo 113.3 de la Constitucion Espanola:**

> "La mocion de censura **no podra ser votada hasta que transcurran cinco dias** desde su presentacion. En los dos primeros dias de dicho plazo podran presentarse mociones alternativas."

**Por que A es correcta:**
El art. 113.3 CE establece un "periodo de enfriamiento" de **5 dias** desde la presentacion de la mocion hasta su votacion. Este plazo permite el debate parlamentario, la reflexion y la presentacion de mociones alternativas.

**Por que las demas son incorrectas:**

- **B)** "No existe plazo determinado". Falso: el art. 113.3 fija expresamente un plazo de 5 dias. No es algo discrecional ni indeterminado.

- **C)** "Hasta pasados **siete** dias". Falso: son 5 dias, no 7. Es un error numerico deliberado.

- **D)** "Hasta pasados **dos** dias". Falso: son 5 dias, no 2. El plazo de 2 dias aparece en el art. 113.3, pero es el plazo para presentar **mociones alternativas**, no para votar la mocion.

**Plazos de la mocion de censura (art. 113):**
- Propuesta: al menos 1/10 de los Diputados (35)
- Debe incluir candidato a Presidente
- **2 primeros dias**: presentacion de mociones alternativas
- **5 dias**: plazo minimo antes de la votacion
- Aprobacion: mayoria absoluta (176 votos)
- Si fracasa: los signatarios no pueden presentar otra en el mismo periodo de sesiones`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6c0f8893-ac4d-48d3-8880-ee0531a9bf3a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.113 mocion censura 5 dias (" + exp2.length + " chars)");
})();
