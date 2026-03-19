require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.162.1.a recurso de inconstitucionalidad legitimados
  const exp1 = `**Articulo 162.1.a de la Constitucion Espanola - Recurso de inconstitucionalidad:**

> "Estan legitimados para interponer el recurso de inconstitucionalidad, el **Presidente del Gobierno**, el **Defensor del Pueblo**, **50 Diputados**, **50 Senadores**, los organos colegiados ejecutivos de las **Comunidades Autonomas** y, en su caso, las **Asambleas** de las mismas."

**Por que D es correcta (el Defensor del Pueblo):**
El art. 162.1.a) CE incluye expresamente al **Defensor del Pueblo** entre los legitimados para interponer el recurso de inconstitucionalidad. Es uno de los seis sujetos con esta legitimacion.

**Por que las demas son incorrectas:**

- **A)** "El **Congreso de los Diputados** por mayoria de tres quintos." Falso: el art. 162.1.a) no legitima al Congreso como institucion, sino a **50 Diputados** individualmente considerados. No se requiere un acuerdo del Congreso por mayoria de 3/5; basta con que 50 diputados firmen el recurso.

- **B)** "**25 Senadores**." Falso: el art. 162.1.a) exige **50** Senadores, no 25. El umbral de 25 es insuficiente; se necesita el doble.

- **C)** "Cualquier miembro del **Consejo de Ministros**." Falso: el art. 162.1.a) legitima al **Presidente del Gobierno**, no a cualquier ministro individualmente. Solo el Presidente tiene legitimacion, no los demas miembros del Gobierno.

**Legitimados para el recurso de inconstitucionalidad (art. 162.1.a CE):**

| Legitimado | Observacion |
|------------|-------------|
| **Presidente del Gobierno** | No cualquier ministro |
| **Defensor del Pueblo** | Legitimacion individual |
| **50 Diputados** | No el Congreso como institucion |
| **50 Senadores** | No 25, sino 50 |
| Gobiernos autonomicos | Organos colegiados ejecutivos |
| Asambleas autonomicas | En su caso |

**Clave:** 50 Diputados (no el Congreso), 50 Senadores (no 25), Presidente del Gobierno (no cualquier ministro), Defensor del Pueblo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b635ac01-7927-4f97-934c-ef16fd6b6b2e");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.162 inconstitucionalidad (" + exp1.length + " chars)");

  // #2 - Ley 50/1981 art.7 Ministerio Fiscal principio de imparcialidad
  const exp2 = `**Articulo 7 de la Ley 50/1981 (Estatuto del Ministerio Fiscal) - Principio de imparcialidad:**

> "Por el principio de **imparcialidad** el Ministerio Fiscal actuara con plena **objetividad** e **independencia** en defensa de los intereses que le esten encomendados."

**Por que C es correcta (imparcialidad):**
El art. 7 define el principio de **imparcialidad** del Ministerio Fiscal: actuar con objetividad e independencia. La pregunta reproduce la definicion del articulo y pide identificar el principio al que corresponde. La objetividad e independencia son las manifestaciones concretas de la imparcialidad.

**Por que las demas son incorrectas:**

- **A)** "**Legalidad**." Falso: el principio de legalidad del MF se define en el art. 6 del Estatuto: "El Ministerio Fiscal actuara con sujecion a la Constitucion, a las leyes y demas normas que integran el ordenamiento juridico vigente." Legalidad = sujecion a las normas. Imparcialidad = objetividad e independencia. Son principios distintos.

- **B)** "**Exclusividad**." Falso: la exclusividad no es un principio propio del Ministerio Fiscal tal como se define en el Estatuto. No aparece como principio en los articulos 6-8.

- **D)** "**Objetividad**." Falso: la objetividad es una **manifestacion** del principio de imparcialidad, no el principio en si. El art. 7 dice "por el principio de **imparcialidad** [...] actuara con plena **objetividad**". La imparcialidad es el principio; la objetividad es como se materializa.

**Principios del Ministerio Fiscal (Ley 50/1981):**

| Principio | Articulo | Definicion |
|-----------|----------|-----------|
| Legalidad | Art. 6 | Sujecion a la Constitucion y las leyes |
| **Imparcialidad** | **Art. 7** | **Objetividad e independencia** |
| Unidad de actuacion | Art. 8 | Dependencia jerarquica |

**Clave:** Imparcialidad = objetividad + independencia (art. 7). Legalidad = sujecion a normas (art. 6). No confundir el principio (imparcialidad) con sus manifestaciones (objetividad).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "70b9ecea-1dd5-4c7e-bb53-1daa7423fd63");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 50/1981 art.7 imparcialidad MF (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.151 Conferencia Sectorial NO resoluciones
  const exp3 = `**Articulo 151.2 de la Ley 40/2015 (LRJSP) - Formas de decision de la Conferencia Sectorial:**

> Art. 151.2: "Las decisiones que adopte la Conferencia Sectorial podran revestir la forma de:
> a) **Acuerdo**: supone un compromiso de actuacion en el ejercicio de las respectivas competencias. Son de obligado cumplimiento [...]
> b) **Recomendacion**: tiene como finalidad expresar la opinion de la Conferencia Sectorial [...]"

**Por que B es la respuesta (resoluciones NO es una forma):**
Las "**resoluciones**" no aparecen en el art. 151.2 como forma de decision de la Conferencia Sectorial. Las unicas formas previstas son **acuerdos** y **recomendaciones**. Las resoluciones son actos administrativos tipicos de organos unipersonales, no de organos de cooperacion interadministrativa.

**Por que las demas SI son formas validas o pueden derivarse:**

- **A)** "**Acuerdos**." **Correcto**: el art. 151.2.a) establece el acuerdo como forma de decision. Los acuerdos son de obligado cumplimiento y directamente exigibles.

- **C)** "**Recomendaciones**." **Correcto**: el art. 151.2.b) establece la recomendacion como forma de decision. Las recomendaciones expresan una opinion de la Conferencia pero no son vinculantes.

- **D)** "**Propuestas**." Aunque el enunciado del art. 151.2 solo menciona acuerdos y recomendaciones, en la practica las Conferencias Sectoriales pueden formular propuestas en el marco de sus funciones de cooperacion. En esta pregunta, "resoluciones" es la opcion claramente incorrecta.

**Formas de decision de la Conferencia Sectorial (art. 151.2):**

| Forma | Caracter | Obligatoriedad |
|-------|----------|---------------|
| **Acuerdo** | Compromiso de actuacion | **Obligatorio** |
| **Recomendacion** | Opinion de la Conferencia | No vinculante |
| ~~Resolucion~~ | **No existe** en art. 151 | - |

**Clave:** La Conferencia Sectorial adopta **acuerdos** (vinculantes) y **recomendaciones** (no vinculantes). Las "resoluciones" no son una forma prevista para este organo.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "4072c311-14ab-447d-9c12-749c9610f9c0");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 art.151 Conferencia (" + exp3.length + " chars)");
})();
