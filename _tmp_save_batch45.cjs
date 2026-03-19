require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 3/2007 art.10 nulos vs anulables
  const exp1 = `**Articulo 10 de la LO 3/2007** (Consecuencias juridicas de las conductas discriminatorias):

> "Los actos y las clausulas de los negocios juridicos que constituyan o causen discriminacion por razon de sexo se consideraran **nulos y sin efecto**, y daran lugar a responsabilidad a traves de un sistema de reparaciones o indemnizaciones [...]"

**Por que B es la INCORRECTA:**
La opcion B dice que los actos discriminatorios se consideraran "**anulables**", pero el art. 10 dice que son "**nulos y sin efecto**". La diferencia es fundamental:
- **Nulidad**: el acto no produce efectos desde el principio (nulidad radical, de pleno derecho)
- **Anulabilidad**: el acto produce efectos hasta que se impugna (vicio subsanable)

La LO 3/2007 opta por la **nulidad** (maxima sancion juridica) para dar la mayor proteccion contra la discriminacion.

**Por que las demas son correctas:**

- **A)** Correcto: art. 7.3 LO 3/2007. Condicionar un derecho a aceptar acoso sexual o por razon de sexo es discriminacion (se denomina "chantaje sexual").

- **C)** Correcto: art. 7.3 LO 3/2007. El acoso sexual y el acoso por razon de sexo se consideran discriminatorios **en todo caso**.

- **D)** Correcto: art. 9 LO 3/2007 (represalia discriminatoria). Cualquier trato adverso como consecuencia de denunciar discriminacion es tambien discriminacion.

**Clave:** Discriminacion por razon de sexo = **nulidad** (no anulabilidad). Nulidad es la maxima consecuencia juridica.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "255eaf64-5288-4d88-8753-3c2aa9f94558");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 3/2007 nulos vs anulables (" + exp1.length + " chars)");

  // #2 - Ley 39/2006 art.26 grados dependencia
  const exp2 = `**Articulo 26 de la Ley 39/2006** (Grados de dependencia):

| Grado | Nombre | Descripcion |
|-------|--------|-------------|
| **I** | **Moderada** | Ayuda al menos **1 vez al dia** / apoyo intermitente o limitado |
| **II** | **Severa** | Ayuda **2-3 veces al dia** / no necesita cuidador permanente |
| **III** | **Gran dependencia** | Ayuda **varias veces al dia** / necesita apoyo indispensable y continuo |

**Por que A es correcta:**
La pregunta describe exactamente el **Grado I - Dependencia moderada** (art. 26.1.a): "necesita ayuda para realizar varias actividades basicas de la vida diaria, **al menos una vez al dia**, o tiene necesidades de apoyo **intermitente o limitado**".

**Por que las demas son incorrectas:**

- **B)** "Grado II. Dependencia **leve**". Dos errores: (1) el grado que describe la pregunta no es el II sino el I; (2) el Grado II se llama "**severa**", no "leve". La palabra "leve" no existe en la clasificacion. Esta opcion mezcla un numero incorrecto con un nombre inventado.

- **C)** "Grado II. Dependencia severa". El nombre es correcto para el Grado II, pero la descripcion de la pregunta no corresponde al Grado II. El Grado II requiere ayuda **2-3 veces al dia**, mientras que el enunciado dice "al menos **una** vez al dia" (que es el Grado I).

- **D)** "Grado III. Gran dependencia". Falso: la gran dependencia implica la necesidad de ayuda **varias veces al dia** y el apoyo **indispensable y continuo** de otra persona. La descripcion del enunciado (una vez al dia, apoyo intermitente) es mucho menos intensa.

**Clave para memorizar:** 1 vez/dia = Grado I (moderada). 2-3 veces/dia = Grado II (severa). Continuo = Grado III (gran).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "bbb0cb46-6a3b-442b-a37d-7e87af38f69d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2006 grados dependencia (" + exp2.length + " chars)");

  // #3 - CE art.168 reforma total 2/3
  const exp3 = `**Articulo 168 de la Constitucion Espanola** (Reforma agravada - revision total):

> "Las Camaras elegidas deberan ratificar la decision y proceder al estudio del nuevo texto constitucional, que debera ser aprobado por **mayoria de dos tercios** de ambas Camaras."

**Por que B es correcta (2/3):**
La reforma total de la CE sigue el procedimiento **agravado** del art. 168, que exige mayoria de **2/3** en todas sus fases:
1. Aprobacion del principio de reforma: 2/3 de cada Camara
2. Disolucion inmediata de las Cortes
3. Las nuevas Camaras ratifican y aprueban el nuevo texto: **2/3 de ambas Camaras**
4. Referendum obligatorio para su ratificacion

**Por que las demas son incorrectas:**

- **A)** "Mayoria de 1/3". Falso: 1/3 no es una mayoria utilizada en la CE para aprobar reformas. Es una fraccion insuficiente.

- **C)** "Mayoria de 3/5". Falso: 3/5 es la mayoria del procedimiento **ordinario** de reforma (art. 167), no del agravado. Se usa para reformar las partes de la CE no protegidas por el art. 168.

- **D)** "Mayoria absoluta". Falso: la mayoria absoluta no es suficiente para la reforma total. Solo aparece como alternativa subsidiaria en el art. 167.2 (procedimiento ordinario, y solo para el Senado).

**Procedimientos de reforma constitucional:**
| Tipo | Articulo | Mayoria | Referendum |
|------|----------|---------|------------|
| **Ordinaria** | 167 | **3/5** | Facultativo (si lo piden 1/10 de las Camaras) |
| **Agravada** (total, T.Preliminar, Sec.1a Cap.II T.I, T.II) | 168 | **2/3** | **Obligatorio** |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b2f02c1a-239e-407b-b696-2ed261321b5f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.168 reforma total (" + exp3.length + " chars)");
})();
