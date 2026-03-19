require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word 365 "Ajuste del texto" no es tipo de salto de página
  const exp1 = `**Saltos de pagina y seccion en Word 365:**

**Por que A es la respuesta (NO es un tipo de salto de pagina):**
"**Ajuste del texto**" (text wrapping) no es un tipo de salto de pagina ni de seccion. Es una configuracion de **diseno de imagen** que controla como fluye el texto alrededor de un objeto (imagen, cuadro de texto, forma). Se encuentra en la pestana Formato de imagen, no en el menu de Saltos.

**Por que las demas SI son tipos de saltos en Word:**

- **B)** "**Continua**." **Correcto**: es un tipo de **salto de seccion** que inserta una nueva seccion en el mismo punto, sin forzar una nueva pagina. Se usa para cambiar el formato (columnas, margenes) dentro de la misma pagina. Menu: Disposicion > Saltos > Continua.

- **C)** "**Columna**." **Correcto**: es un tipo de **salto de columna** que mueve el texto al inicio de la siguiente columna. Se usa cuando el documento esta en formato de columnas multiples. Menu: Disposicion > Saltos > Columna.

- **D)** "**Pagina**." **Correcto**: es el salto de pagina basico que fuerza el inicio de una nueva pagina. Es el mas comun y se puede insertar tambien con Ctrl + Enter. Menu: Disposicion > Saltos > Pagina.

**Tipos de saltos en Word 365 (Disposicion > Saltos):**

| Categoria | Tipos |
|-----------|-------|
| Saltos de pagina | **Pagina**, **Columna**, Ajuste del texto (solo en versiones antiguas) |
| Saltos de seccion | Pagina siguiente, **Continua**, Pagina par, Pagina impar |

**Clave:** "Ajuste del texto" es una propiedad de diseno de imagenes, no un salto de pagina. Pagina, Columna y Continua si son tipos de saltos disponibles en Word.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a4b07ffd-2f42-4b45-929d-0905c640ba97");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word saltos pagina (" + exp1.length + " chars)");

  // #2 - Ley 50/1997 art.25 Plan Anual Normativo INCORRECTA (legalmente vs reglamentariamente)
  const exp2 = `**Articulo 25 de la Ley 50/1997 (Ley del Gobierno) - Plan Anual Normativo:**

> Art. 25.2: "El Plan Anual Normativo identificara, con arreglo a los criterios que se establezcan **reglamentariamente**, las normas que habran de someterse a un analisis sobre los resultados de su aplicacion [...]"

**Por que A es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion A dice que los criterios se estableceran "**legalmente**", pero el art. 25.2 dice "**reglamentariamente**". La trampa es sutil: sustituye "reglamentariamente" por "legalmente". El Plan SI identifica normas para analisis de resultados, pero los criterios se fijan por reglamento, no por ley.

**Por que las demas SI son correctas:**

- **B)** "Se elevara al Consejo de Ministros para su aprobacion antes del **30 de abril**." **Correcto**: el art. 25.5 establece que el Plan Anual Normativo se elevara al Consejo de Ministros para su aprobacion antes del 30 de abril.

- **C)** "El Gobierno aprobara anualmente un Plan Normativo que contendra las iniciativas legislativas o reglamentarias que vayan a ser elevadas para su aprobacion en el ano siguiente." **Correcto**: reproduce el art. 25.1. El Plan contiene las iniciativas del ano siguiente.

- **D)** "Cuando se eleve una propuesta normativa que no figurara en el Plan, sera necesario justificarlo en la **Memoria del Analisis de Impacto Normativo**." **Correcto**: el art. 25.3 establece que las propuestas no incluidas en el Plan deben justificarse en la MAIN (Memoria del Analisis de Impacto Normativo).

**Contenido del art. 25 (Plan Anual Normativo):**
1. El Gobierno aprueba anualmente el Plan con las iniciativas del ano siguiente
2. Identifica normas para analisis de resultados (criterios **reglamentarios**, no legales)
3. Propuestas fuera del Plan deben justificarse en la MAIN
4. Se publica en el Portal de la Transparencia
5. Se eleva al Consejo de Ministros antes del **30 de abril**

**Clave:** La trampa esta en "legalmente" vs "reglamentariamente". El art. 25.2 dice que los criterios se establecen por **reglamento**, no por ley.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "27f9e30b-cf7c-47f0-a171-9cc4e10c4bd6");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 50/1997 art.25 Plan Normativo (" + exp2.length + " chars)");

  // #3 - Ley 39/2015 art.106 revisión de oficio dictamen favorable Consejo de Estado
  const exp3 = `**Articulo 106.1 de la Ley 39/2015 (LPAC) - Revision de oficio de actos nulos:**

> "Las Administraciones Publicas, en cualquier momento, por iniciativa propia o a solicitud de interesado, y previo **dictamen favorable** del **Consejo de Estado** u organo consultivo equivalente de la Comunidad Autonoma, si lo hubiere, declararan de oficio la nulidad de los actos administrativos que hayan puesto fin a la via administrativa o que no hayan sido recurridos en plazo, en los supuestos previstos en el articulo 47.1."

**Por que B es correcta (dictamen favorable):**
El art. 106.1 exige un dictamen **favorable** (no solo preceptivo) del Consejo de Estado. Esto significa que si el Consejo de Estado emite un dictamen **desfavorable**, la Administracion **no puede** declarar la nulidad. El dictamen es a la vez preceptivo (obligatorio solicitarlo) y vinculante en sentido positivo (debe ser favorable).

**Por que las demas son incorrectas:**

- **A)** "Dictamen **preceptivo pero no vinculante**." Falso: el art. 106.1 dice "dictamen **favorable**", lo que implica que es vinculante. Si fuera solo preceptivo y no vinculante, bastaria con solicitarlo, pero la Administracion podria apartarse de el. Aqui no: debe ser favorable para poder declarar la nulidad.

- **C)** "**No puede** llevarse a cabo." Falso: la revision de oficio de actos nulos **si** puede llevarse a cabo. De hecho, el art. 106.1 la regula expresamente. Los actos nulos pueden revisarse en **cualquier momento** (sin plazo), a diferencia de los anulables.

- **D)** "Solo se puede realizar **a instancia de parte**." Falso: el art. 106.1 dice "por **iniciativa propia** o a solicitud de interesado". La revision de oficio puede iniciarse tanto de oficio como a instancia de parte. No es exclusiva de una via.

**Revision de oficio vs declaracion de lesividad:**

| Tipo | Actos | Dictamen | Plazo |
|------|-------|----------|-------|
| **Revision de oficio** (art. 106) | **Nulos** | **Favorable** del C. de Estado | Sin plazo |
| Declaracion de lesividad (art. 107) | Anulables | Preceptivo del C. de Estado | **4 anos** |

**Clave:** Para la revision de actos nulos se exige dictamen **favorable** (no solo preceptivo). Puede hacerse en cualquier momento y tanto de oficio como a solicitud del interesado.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "bbcc50e6-6455-44e4-b0af-561a28c01179");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 39/2015 art.106 revision oficio (" + exp3.length + " chars)");
})();
