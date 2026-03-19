require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 364/1995 art.15 convocatorias BOE
  const exp1 = `**Articulo 15.1 del RD 364/1995** (Convocatorias):

> "Las convocatorias, juntamente con sus bases, se publicaran en el **Boletin Oficial del Estado**."

**Por que B es correcta:**
El art. 15.1 es claro y directo: las convocatorias de ingreso en la AGE se publican en el BOE. Esto tiene logica porque se trata de personal al servicio de la **Administracion General del Estado**, cuyo diario oficial es el BOE.

**Por que las demas son incorrectas:**

- **A)** "Boletin Oficial del Registro Mercantil (BORME)". El BORME publica actos societarios y mercantiles (constituciones de empresas, nombramientos de administradores, etc.). No tiene ninguna relacion con la funcion publica ni con procesos selectivos.

- **C)** "Diario Oficial de la Provincia". Los Boletines Oficiales Provinciales (BOP) publican actos de las Diputaciones y Ayuntamientos. Las convocatorias de la AGE no se publican ahi, aunque las de entes locales si podrian.

- **D)** "Diario Oficial de la Comunidad Autonoma". Los DOCA publican actos de las CCAA. Las convocatorias de personal autonomico se publican en su diario oficial correspondiente, pero las de la AGE van al BOE.

**Regla mnemotecnica:** AGE = BOE. Cada Administracion publica en su boletin oficial: la AGE en el BOE, las CCAA en su diario autonomico, y los entes locales en el BOP.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "7ea34483-42e0-410f-a4ca-5fe3d7b4799f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 364/1995 art.15 BOE (" + exp1.length + " chars)");

  // #2 - Ley 19/2013 art.9 infraccion grave
  const exp2 = `**Articulo 9.3 de la Ley 19/2013** (Transparencia - Control):

> "El incumplimiento reiterado de las obligaciones de publicidad activa [...] tendra la consideracion de **infraccion grave** a los efectos de aplicacion a sus responsables del regimen disciplinario previsto en la correspondiente normativa reguladora."

**Por que B es correcta:**
El art. 9.3 califica expresamente el incumplimiento **reiterado** de las obligaciones de publicidad activa como **infraccion grave**. No es muy grave, no es leve: es grave. Ademas, el requisito es que sea "reiterado" (repetido), no basta un incumplimiento aislado.

**Por que las demas son incorrectas:**

- **A)** "Infraccion muy grave". Falso: el art. 9.3 dice expresamente "grave", no "muy grave". La Ley 19/2013 reserva las infracciones muy graves para otros supuestos del art. 29 (como gestionar conflictos de intereses o incumplir la CE y leyes en el ejercicio del cargo).

- **C)** "Infraccion leve". Falso: el legislador considero que el incumplimiento reiterado de la transparencia tiene suficiente gravedad como para no ser leve. Si fuera leve, la sancion seria simbolica y no incentivaria el cumplimiento.

- **D)** "Falta". Falso: la Ley 19/2013 utiliza el termino "infraccion", no "falta". El regimen disciplinario de esta ley clasifica en infracciones muy graves, graves y leves (arts. 28-29).

**Clave:** Incumplimiento **reiterado** de publicidad activa = infraccion **grave** (art. 9.3 Ley 19/2013).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "068335a1-827a-49d8-8f5e-030c7336fd66");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 19/2013 art.9 infraccion grave (" + exp2.length + " chars)");

  // #3 - RD 364/1995 art.12 Comisiones Permanentes impar
  const exp3 = `**Articulo 12.3 del RD 364/1995** (Comisiones Permanentes de Seleccion):

> "Las Comisiones Permanentes de Seleccion estaran constituidas por un **numero impar** de miembros, **funcionarios de carrera**, con nivel de titulacion **igual o superior** al del Cuerpo o Escala en cuya seleccion vayan a intervenir, que seran **designados libremente**."

**Por que C es correcta (es la INCORRECTA):**
La opcion C dice "numero **par**" de miembros, pero el art. 12.3 establece un "numero **impar**". El numero impar es fundamental para evitar empates en las votaciones del organo de seleccion.

**Por que las demas son incorrectas (son VERDADERAS):**

- **A)** "Funcionarios de carrera designados libremente". Verdadero: el art. 12.3 dice expresamente que seran "designados libremente" conforme a la Orden ministerial de creacion.

- **B)** "Funcionarios con titulacion igual o superior al Cuerpo". Verdadero: el art. 12.3 exige titulacion "igual o superior" al del Cuerpo cuya seleccion vayan a intervenir. Logico: quien evalua debe tener al menos el mismo nivel de formacion.

- **D)** "Funcionarios con titulacion igual o superior a la Escala". Verdadero: el art. 12.3 menciona "Cuerpo **o Escala**", por lo que tanto B como D son afirmaciones correctas extraidas del mismo precepto.

**Truco de examen:** El cambio de "impar" a "par" es sutil pero determinante. Siempre numero **impar** para organos colegiados de seleccion (evitar empates).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "c2043fe4-4df4-4273-9495-7d2bebeb18be");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - RD 364/1995 art.12 Comisiones impar (" + exp3.length + " chars)");
})();
