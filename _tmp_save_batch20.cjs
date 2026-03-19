require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 203/2021 art.6 supresion portal
  const exp1 = `**Articulo 6 del RD 203/2021** (Creacion y supresion de portales de internet):

El art. 6 distingue entre **creacion** y **supresion** de portales:

- **Creacion**: requiere **informe favorable** de la Comision Ministerial de Administracion Digital + comunicacion posterior a varios ministerios
- **Supresion**: **NO requiere informe favorable**, solo comunicacion previa

**Por que B es correcta:**
La supresion de un portal de internet no requiere informe previo favorable. Basta con la orden o resolucion del titular correspondiente. Los requisitos de informe favorable son exclusivos del procedimiento de creacion.

**Por que las demas son incorrectas:**

- **A)** "Si, con memoria justificativa y economica del organo promotor". Falso: la memoria justificativa es un requisito de la **creacion** de portales (art. 6.2), no de la supresion. El opositor que confunda creacion con supresion caera en esta trampa.

- **C)** "Si, justificando eficiencia, recursos publicos e interes prioritario". Falso: esta descripcion corresponde a los requisitos para justificar la **creacion** de un portal nuevo (art. 6.2), no su supresion. Mezcla conceptos de creacion con supresion.

- **D)** "Si, de la Comision Ministerial [...] con comunicacion a Hacienda y Economia". Falso: el informe de la Comision Ministerial de Administracion Digital es requisito de la **creacion** (art. 6.2). Para la supresion no se exige este informe.

**Regla clave:** Crear portal = informe favorable + requisitos. Suprimir portal = solo orden/resolucion, sin informe favorable previo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "18c396b2-90b6-4d35-a782-e74a65449692");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 203/2021 art.6 supresion portal (" + exp1.length + " chars)");

  // #2 - CE art.103 sindicacion
  const exp2 = `**Articulo 103.3 de la Constitucion Espanola:**

> "La ley regulara el estatuto de los funcionarios publicos, el acceso a la funcion publica de acuerdo con los principios de merito y capacidad, las peculiaridades del ejercicio de su derecho a **sindicacion**, el sistema de incompatibilidades y las garantias para la imparcialidad en el ejercicio de sus funciones."

**Por que A es correcta:**
El art. 103.3 menciona expresamente que la ley regulara "las peculiaridades del ejercicio de su derecho a **sindicacion**". El derecho a sindicacion de los funcionarios tiene peculiaridades propias que la ley debe regular (por ejemplo, hay cuerpos con limitaciones como militares y jueces).

**Por que las demas son incorrectas:**

- **B)** "Inamovilidad". La inamovilidad es una garantia de los jueces y magistrados (art. 117.1 CE), no un derecho mencionado en el art. 103.3 para funcionarios en general. El art. 103.3 regula sindicacion, no inamovilidad.

- **C)** "Conciliacion". La conciliacion laboral y familiar no aparece mencionada en el art. 103 CE. Es un concepto moderno que se regula por legislacion ordinaria (TREBEP, Ley de Igualdad), pero no tiene rango constitucional en este articulo.

- **D)** "Huelga". Aunque los funcionarios pueden tener derecho a huelga (art. 28.2 CE lo regula con caracter general), el art. 103.3 CE habla de "sindicacion", no de "huelga". Son derechos distintos: sindicacion (crear o afiliarse a sindicatos) vs huelga (cesar en el trabajo).

**Contenido del art. 103.3 (5 materias):**
1. Estatuto de los funcionarios publicos
2. Acceso por merito y capacidad
3. Peculiaridades del derecho a **sindicacion**
4. Sistema de incompatibilidades
5. Garantias de imparcialidad`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9eea47a9-54ae-41d3-945a-ea84b26cdc7c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.103 sindicacion (" + exp2.length + " chars)");
})();
