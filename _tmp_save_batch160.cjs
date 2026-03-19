require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.62.4 denuncias plazo máximo procedimiento
  const exp1 = `**Articulo 62.4 de la Ley 39/2015 (LPAC) - Plazo para resolver sobre denuncias:**

> Art. 62.4: "La denuncia no vincula al organo competente para iniciar el procedimiento, si bien debera comunicar al denunciante los motivos por los que, en su caso, no se ha iniciado el procedimiento. Cuando la denuncia invocara un perjuicio en el patrimonio de las Administraciones Publicas, la no iniciacion del procedimiento debera ser motivada y se notificara a los denunciantes la decision de si se ha iniciado o no el procedimiento."

> Art. 62.5: "La resolucion debera producirse dentro del plazo maximo establecido para el procedimiento correspondiente."

**Por que C es correcta (plazo maximo del procedimiento correspondiente):**
El art. 62 LPAC no establece un plazo especifico para denuncias, sino que remite al **plazo maximo del procedimiento que se inicie** a raiz de la denuncia. Cada procedimiento administrativo tiene su propio plazo maximo de resolucion (art. 21), y ese es el que se aplica.

**Por que las demas son incorrectas:**

- **A)** "Inmediatamente al recibirse". Falso: la denuncia no genera un deber de resolucion inmediata. La Administracion debe valorar si procede iniciar un procedimiento, y la resolucion se producira dentro del plazo del procedimiento correspondiente, no "inmediatamente".

- **B)** "En el plazo de un ano". Falso: un ano no aparece en el art. 62. Puede confundirse con el plazo de caducidad de procedimientos sancionadores, pero no es el plazo para resolver sobre denuncias.

- **D)** "No hay plazo especifico establecido". Falso: si lo hay, es el plazo maximo del procedimiento correspondiente (art. 62.5). La ley no deja sin plazo la resolucion de denuncias.

**Clave:** Denuncias = plazo del procedimiento que se inicie. No hay plazo propio para las denuncias, pero si se remite al plazo maximo del procedimiento correspondiente.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "491d0af6-5715-4fd8-be25-694f9d506600");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.62 denuncias plazo (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.66 órgano judicial o administrativo informe discriminación
  const exp2 = `**Articulo 66 de la Ley 4/2023 - Prueba en casos de discriminacion por orientacion e identidad sexual:**

> Art. 66.2: "El **organo judicial o administrativo**, de oficio o a solicitud de la persona interesada, podra recabar informe de los **organismos publicos competentes** en materia de igualdad y no discriminacion por razon de las causas establecidas en esta ley."

**Por que D es correcta (el organo judicial o administrativo, de oficio o a solicitud):**
El art. 66.2 legitima al **organo judicial o administrativo** que conoce del caso para recabar informes. Puede hacerlo de dos formas: **de oficio** (por iniciativa propia) o **a solicitud de la persona interesada**. No se limita a una sola forma de actuacion.

**Por que las demas son incorrectas:**

- **A)** "La Autoridad Independiente para la Igualdad de Trato y la No Discriminacion". Falso: esta Autoridad es un organismo creado por la Ley 15/2022, no el legitimado para recabar informes segun el art. 66.2 de la Ley 4/2023. El legitimado es el organo judicial o administrativo que conoce del asunto.

- **B)** "La Administracion General del Estado, exclusivamente a solicitud de la persona interesada". Contiene **dos errores**: (1) no es la AGE sino el organo judicial o administrativo concreto; (2) no es "exclusivamente a solicitud" sino que puede actuar tambien **de oficio**.

- **C)** "La Delegacion Especial del Gobierno contra la Violencia sobre la Mujer". Falso: este organo se enmarca en la lucha contra la violencia de genero (LO 1/2004), no en la discriminacion por orientacion e identidad sexual. No es el organo legitimado por el art. 66.2 de la Ley 4/2023.

**Clave:** Legitimado para recabar informes = **organo judicial o administrativo** que conoce del caso, de oficio o a instancia del interesado. No confundir con otros organismos de igualdad.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "070d7e69-ee76-4521-96b9-d32d93c9312c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 art.66 informe discriminacion (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 art.82 trámite audiencia afirmación incorrecta
  const exp3 = `**Articulo 82 de la Ley 39/2015 (LPAC) - Tramite de audiencia:**

> Art. 82.3: "Si antes del vencimiento del plazo los interesados manifiestan su decision de **no** efectuar alegaciones **ni** aportar nuevos documentos o justificaciones, se tendra por **realizado** el tramite."

**Por que B es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion B dice: "manifiestan su decision de **efectuar** alegaciones y aportar nuevos documentos, se tendra por **paralizado** el tramite". Contiene **dos errores** respecto al art. 82.3:

1. Dice "**efectuar**" cuando el articulo dice "**no** efectuar". El interesado renuncia a alegar, no anuncia que va a hacerlo.
2. Dice "**paralizado**" cuando el articulo dice "**realizado**". Al renunciar a alegar, el tramite se da por cumplido, no se paraliza.

**Por que las demas SI son correctas:**

- **A)** "Los interesados, en un plazo **no inferior a diez dias ni superior a quince**, podran alegar y presentar los documentos y justificaciones que estimen pertinentes." **Correcto**: reproduce literalmente el art. 82.2.

- **C)** "Se podra prescindir del tramite de audiencia cuando no figuren en el procedimiento ni sean tenidos en cuenta en la resolucion otros hechos ni otras alegaciones y pruebas que las aducidas por el interesado." **Correcto**: reproduce el art. 82.4. Si solo hay lo que aporto el interesado, no hace falta darle audiencia de nuevo.

- **D)** "En los procedimientos de responsabilidad patrimonial a los que se refiere el articulo 32.9 de la Ley 40/2015, sera necesario en todo caso dar audiencia al contratista." **Correcto**: reproduce el art. 82.5.

**Clave:** El art. 82.3 dice "**no** efectuar" y "**realizado**". La trampa invierte ambos terminos: "efectuar" y "paralizado". Es un clasico cambio de palabras clave en opciones de examen.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "d122dc87-059d-40f1-93e9-6c58860023f7");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 art.82 audiencia incorrecta (" + exp3.length + " chars)");
})();
