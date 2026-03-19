require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.148.1.4ª obras públicas interés CCAA
  const exp1 = `**Articulos 148 y 149 de la Constitucion Espanola - Competencias CCAA vs Estado:**

> Art. 148.1: "Las Comunidades Autonomas podran asumir competencias en: [...]
> **4.a Las obras publicas de interes de la Comunidad Autonoma en su propio territorio.**"

**Por que C es correcta:**
El art. 148.1.4.a CE incluye expresamente "las obras publicas de interes de la Comunidad Autonoma en su propio territorio" entre las competencias que las CCAA pueden asumir. Es una competencia claramente autonomica, limitada al interes y territorio de la propia CA.

**Por que las demas son incorrectas (son competencias exclusivas del Estado):**

- **A)** "La **marina mercante y abanderamiento de buques**." Falso: esta es competencia **exclusiva del Estado** segun el art. 149.1.20.a CE. Las CCAA no pueden asumirla. La marina mercante, puertos de interes general y abanderamiento son materias estatales.

- **B)** "El **regimen aduanero y arancelario**." Falso: esta es competencia **exclusiva del Estado** segun el art. 149.1.10.a CE ("Regimen aduanero y arancelario; comercio exterior"). Las aduanas y aranceles son competencia estatal por su naturaleza suprarregional.

- **D)** "**Todas son correctas**." Falso: solo C es correcta. Las opciones A y B son competencias exclusivas del Estado (art. 149.1), no competencias asumibles por las CCAA.

**Comparacion obras publicas en la CE:**

| Tipo | Competencia | Articulo |
|------|-------------|----------|
| Obras de interes **de la CA** | **CCAA** (art. 148.1.4.a) | 148 |
| Obras de interes **general** | **Estado** (art. 149.1.24.a) | 149 |

**Clave:** Las obras publicas de interes de la CA = competencia autonomica. Las obras publicas de interes general = competencia estatal. La distincion es el **interes** (autonomico vs general).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "befac0c8-1104-400b-9aaa-d927abc351dd");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.148 obras publicas CCAA (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 art.1.2 trámites adicionales solo por ley
  const exp2 = `**Articulo 1.2 de la Ley 39/2015 (LPAC) - Reserva de ley para tramites adicionales:**

> "Solo mediante **ley**, cuando resulte eficaz, proporcionado y necesario para la consecucion de los fines propios del procedimiento, y de manera **motivada**, podran incluirse **tramites adicionales o distintos** a los contemplados en esta Ley, o regularse estos exigiendose nuevos requisitos o la aportacion de documentos que no esten previstos en la norma de la Union Europea de que se trate."

**Por que C es correcta (tramites adicionales o distintos):**
El art. 1.2 establece una **reserva de ley** para incluir tramites adicionales o distintos del procedimiento administrativo comun. Es decir, para anadir o modificar tramites, se necesita una ley (no un reglamento), con motivacion y respetando los principios de eficacia, proporcionalidad y necesidad.

**Por que las demas son incorrectas (confunden el objeto de la reserva):**

- **A)** "Especialidades referidas a los **organos competentes**." Falso: el art. 1.2 habla de "tramites adicionales o distintos", no de especialidades referidas a organos competentes. La determinacion de organos competentes se regula en otras normas de organizacion, no en este precepto.

- **B)** "Formas especiales de **iniciacion y terminacion**, publicacion e informes a recabar." Falso: el art. 1.2 no menciona formas especiales de iniciacion, terminacion, publicacion ni informes. Estas cuestiones se regulan a lo largo de la Ley, pero la reserva del art. 1.2 es especificamente para tramites adicionales o distintos.

- **D)** "**Plazos propios** del concreto procedimiento por razon de la materia." Falso: el art. 1.2 no se refiere a plazos propios por razon de la materia. Los plazos especificos pueden establecerse en las normas reguladoras de cada procedimiento, pero la reserva de ley del art. 1.2 es para tramites adicionales, no para plazos.

**Clave:** El art. 1.2 LPAC reserva a la **ley** (no al reglamento) la inclusion de **tramites adicionales o distintos** del procedimiento comun, exigiendo motivacion y proporcionalidad.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "dc48b55c-3757-460f-ad08-d607ce699bf3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 art.1 tramites adicionales (" + exp2.length + " chars)");

  // #3 - RD 1084/1990 art.4 DGFP informar propuestas cuerpos y escalas
  const exp3 = `**Articulo 4 del RD 1084/1990 - Competencias de la Direccion General de la Funcion Publica:**

> Art. 4.1.c): "Corresponden a la DGFP: [...] c) **Informar** las convocatorias de pruebas de acceso [...] y las **propuestas de modificaciones relativas a los Cuerpos y Escalas** adscritos a los Departamentos ministeriales que formulen los mismos."

**Por que B es correcta:**
El art. 4.1.c) atribuye a la DGFP la funcion de **informar las propuestas de modificacion** relativas a los Cuerpos y Escalas que formulen los Departamentos Ministeriales. Es una funcion de control y coordinacion: los Ministerios proponen y la DGFP informa.

**Por que las demas son incorrectas:**

- **A)** "Relaciones con las **organizaciones patronales**." Falso: las relaciones con organizaciones patronales no son funcion de la DGFP. La DGFP se ocupa del personal al servicio de la Administracion, no de las relaciones con patronales, que corresponden al ambito laboral y de negociacion colectiva a traves de otros organos.

- **C)** "Conceder el reingreso al servicio activo tras las excedencias [...] y autorizar la **suspension de funciones**." Falso: el art. 4.2.b) atribuye a la DGFP el reingreso provisional, pero solo respecto de los Cuerpos adscritos al propio Ministerio (no de todos), y no menciona la "autorizacion de la suspension de funciones" como competencia de la DGFP.

- **D)** "Coordinacion, promocion e interlocucion con las **asociaciones de funcionarios** e impulso de la **formacion**." Falso: estas funciones no aparecen en el art. 4 del RD 1084/1990 como competencias de la DGFP. La interlocucion sindical y la formacion se canalizan a traves de otros organos (INAP, mesa de negociacion).

**Funciones principales de la DGFP (art. 4 RD 1084/1990):**
- Promover el desarrollo del regimen juridico del personal
- Elaborar la oferta de empleo publico
- **Informar convocatorias y propuestas de modificacion de Cuerpos y Escalas**

**Clave:** La DGFP informa las propuestas de modificacion de Cuerpos y Escalas. No gestiona relaciones patronales, ni autoriza suspensiones, ni impulsa formacion.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "8ad58094-c1b9-4238-929d-17b48bcf7cbb");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 1084/1990 art.4 DGFP (" + exp3.length + " chars)");
})();
