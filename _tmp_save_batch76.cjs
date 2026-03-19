require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1997 art.26 prescindir consulta publica
  const exp1 = `**Articulo 26.2 de la Ley 50/1997** (Excepciones a la consulta publica):

> "Podra prescindirse del tramite de consulta publica previsto en el parrafo primero en el caso de la elaboracion de normas **presupuestarias u organizativas** de la Administracion General del Estado [...]"

**Por que B es correcta (normas presupuestarias u organizativas):**
Las normas **presupuestarias** (ej: anteproyecto de Ley de Presupuestos) y **organizativas** (ej: reales decretos de estructura de ministerios) pueden elaborarse sin consulta publica. La razon es que su naturaleza tecnica o urgente hace poco util la consulta ciudadana previa.

**Por que las demas son incorrectas (cambian las palabras clave):**

- **A)** "Normas sancionadoras". Falso: el art. 26.2 no menciona las normas "sancionadoras" como excepcion a la consulta publica. Las normas sancionadoras requieren, de hecho, un tramite riguroso.

- **C)** "Normas tributarias u organizativas". Falso: el art. 26.2 dice "**presupuestarias** u organizativas", no "tributarias". La trampa es sustituir "presupuestarias" por "tributarias". Aunque ambas son materias financieras, el termino exacto del articulo es "presupuestarias".

- **D)** "Normas sociales". Falso: las normas "sociales" no estan excluidas del tramite de consulta publica. Este concepto no aparece en el art. 26.2 como excepcion.

**Excepciones a la consulta publica (art. 26.2):**
- Normas **presupuestarias** u **organizativas** de la AGE
- Razones graves de **interes publico** (debidamente motivadas)
- La concurrencia de estas razones se justifica en la **MAIN**

**Clave:** Prescindir de consulta = normas **presupuestarias** u **organizativas**. No confundir "presupuestarias" con "tributarias" ni "sancionadoras".`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "d9b1b68d-5447-4869-b658-4cda1b8fde39");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1997 prescindir consulta (" + exp1.length + " chars)");

  // #2 - RD 203/2021 art.10 creacion sedes electronicas
  const exp2 = `**Articulo 10.3 del RD 203/2021** (Creacion y supresion de sedes electronicas):

> "En el ambito estatal [...] se hara mediante **orden de la persona titular del Departamento competente** o por **resolucion de la persona titular de la Presidencia o de la Direccion** del organismo o entidad [...], con el **informe previo favorable** del Ministerio para la Transformacion Digital y Funcion Publica."

**Por que C es correcta:**
La creacion o supresion de sedes electronicas en el ambito estatal se hace por:
- **Orden ministerial** (si es de un Departamento ministerial)
- **Resolucion** del Presidente/Director del organismo (si es de un organismo/entidad)
- Siempre con **informe previo favorable** del Ministerio competente en transformacion digital

**Por que las demas son incorrectas:**

- **A)** "Orden del Ministro de Hacienda a propuesta de los Ministros interesados + convenio". Falso: no interviene el Ministro de Hacienda ni se requieren convenios de colaboracion. Cada Departamento crea sus sedes por **orden propia**, no por orden de Hacienda.

- **B)** "No se podran crear en ningun caso sedes asociadas". Falso: el art. 10.1 expresamente permite crear sedes electronicas **asociadas** a una sede principal, "atendiendo a razones tecnicas y organizativas".

- **D)** Similar a la A pero con "Administraciones exclusivamente estatales". Falso por las mismas razones: no interviene el Ministro de Hacienda ni se usan convenios. Ademas, cambia "autonomicas o locales" por "exclusivamente estatales".

**Clave:** Creacion de sedes electronicas en el Estado = **Orden ministerial o resolucion del organo** + **informe previo favorable** del Ministerio de Transformacion Digital.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a07f29e7-d4a7-4284-b0af-c780d16fb4f8");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 203/2021 sedes electronicas (" + exp2.length + " chars)");
})();
