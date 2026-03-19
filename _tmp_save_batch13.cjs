require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 364/1995 art.15 convocatorias incorrecta
  const exp1 = `**Articulo 15.3 del RD 364/1995** (Convocatorias):

> **15.3:** "El Departamento convocante podra aprobar, con el informe favorable de la **Direccion General de la Funcion Publica**, bases generales en las que se determine el sistema selectivo, pruebas a superar, programas y formas de calificacion aplicables a sucesivas convocatorias."

**Por que C es la INCORRECTA:**
La opcion C sustituye "Direccion General de la Funcion Publica" por "Ministerio competente en materia de empleo". Es un cambio sutil pero fundamental: el informe favorable lo emite la **DGFP**, no el Ministerio de Empleo. Son organos distintos con competencias diferentes.

**Por que las demas son correctas:**

- **A)** Verdadera: reproduce literalmente el art. 15.5: las convocatorias o sus bases, una vez publicadas, solo podran modificarse con sujecion estricta a las normas de la LRJPAC. Las bases publicadas son vinculantes.

- **B)** Verdadera: reproduce el art. 15.2: las convocatorias pueden ser unitarias (segun art. 27 Ley 30/1984) o para ingreso en Cuerpos o Escalas determinados.

- **D)** Verdadera: reproduce el art. 15.4: las bases vinculan a tres partes: la Administracion, los Tribunales/Comisiones de Seleccion y los participantes. Nadie queda fuera de su cumplimiento.

**Truco de examen:** El cambio de "Direccion General de la Funcion Publica" por "Ministerio de empleo" es una sustitucion tipica. Recordar: la DGFP es el organo clave en materia de seleccion de personal de la AGE.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "4a52320f-ef82-45ce-8ce6-617884d0b121");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 364/1995 art.15 incorrecta (" + exp1.length + " chars)");

  // #2 - CE art.87 iniciativa legislativa
  const exp2 = `**Articulo 87.1 de la Constitucion Espanola:**

> "La iniciativa legislativa corresponde al **Gobierno**, al **Congreso** y al **Senado**, de acuerdo con la Constitucion y los Reglamentos de las Camaras."

**Por que A es la INCORRECTA:**
El Consejo General del Poder Judicial (CGPJ) **no tiene iniciativa legislativa**. El art. 87.1 CE enumera taxativamente tres titulares: Gobierno, Congreso y Senado. El CGPJ es el organo de gobierno del Poder Judicial, pero no puede presentar proyectos ni proposiciones de ley.

**Por que las demas son correctas:**

- **B)** "Congreso de los Diputados". Correcto: el art. 87.1 lo incluye expresamente. Los Diputados presentan proposiciones de ley.

- **C)** "Senado". Correcto: el art. 87.1 lo incluye expresamente. Los Senadores tambien pueden presentar proposiciones de ley.

- **D)** "Gobierno". Correcto: el art. 87.1 lo incluye expresamente. El Gobierno presenta **proyectos de ley** (aprobados en Consejo de Ministros).

**Ademas del art. 87.1, tienen iniciativa legislativa (indirecta):**
- **Asambleas de CCAA** (art. 87.2): pueden solicitar al Gobierno un proyecto de ley o remitir una proposicion al Congreso
- **Iniciativa popular** (art. 87.3): minimo 500.000 firmas acreditadas, excluida en materias de LO, tributarias, internacionales y prerrogativa de gracia

**Clave:** Solo Gobierno, Congreso y Senado tienen iniciativa legislativa directa. El CGPJ no.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "660de1c0-0acd-42ec-a1fe-90a791bc2477");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.87 iniciativa legislativa (" + exp2.length + " chars)");
})();
