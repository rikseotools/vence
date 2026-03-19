require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.168 Corona blindada procedimiento agravado
  const exp1 = `**Articulo 168 de la Constitucion Espanola:**

> "Cuando se propusiere la revision total de la Constitucion o una parcial que afecte al **Titulo preliminar**, al **Capitulo segundo, Seccion primera del Titulo I**, o al **Titulo II**, se procedera a la aprobacion del principio por **mayoria de dos tercios** de cada Camara, y a la **disolucion inmediata de las Cortes**."

**Por que C es correcta (procedimiento agravado de reforma):**
El Titulo II de la CE regula "De la Corona" (arts. 56-65). Cualquier reforma que afecte a este titulo requiere el **procedimiento agravado** del art. 168, que es el mas exigente de la CE: mayoria de 2/3, disolucion de Cortes, nuevas elecciones, ratificacion por 2/3 de las nuevas Camaras y referendum obligatorio. Esto es lo que significa que la Corona esta "blindada": no que sea inmutable, sino que su reforma es extremadamente dificil.

**Por que las demas son incorrectas:**

- **A)** "No es posible su derogacion". Falso: la CE **puede** reformarse en su totalidad (el propio art. 168 habla de "revision total"). No hay clausulas de eternidad en la CE espanola. La Corona puede reformarse e incluso suprimirse, pero mediante el procedimiento agravado. "Blindada" no significa "inmutable".

- **B)** "La Familia Real es inviolable y no esta sujeta a responsabilidad". Falso: la **inviolabilidad** solo corresponde al **Rey** (art. 56.3 CE: "La persona del Rey es inviolable y no esta sujeta a responsabilidad"). La Familia Real en su conjunto NO goza de inviolabilidad. Solo el Rey titular, no la Reina consorte, los Principes ni otros miembros.

- **D)** "El Rey puede destituir al Gobierno en caso de mala gestion". Falso: el Rey **no tiene** poder para destituir al Gobierno. En la monarquia parlamentaria espanola, el Rey tiene funciones simbolicas y formales (art. 62 CE). Solo el **Congreso** puede derribar al Gobierno mediante una mocion de censura (art. 113 CE) o negandole la confianza (art. 114 CE).

**Materias protegidas por el art. 168 (procedimiento agravado):**
- **Titulo preliminar** (arts. 1-9): principios fundamentales
- **Seccion 1a del Capitulo II del Titulo I** (arts. 15-29): derechos fundamentales
- **Titulo II** (arts. 56-65): **la Corona**

**Clave:** "Blindada" = procedimiento agravado (art. 168), no imposibilidad de reforma. Solo el Rey es inviolable, no toda la Familia Real.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "05ae1f94-0d8e-4908-9ec6-9f8f839a9a2a");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.168 Corona agravado (" + exp1.length + " chars)");

  // #2 - CE art.79.3 voto personal e indelegable
  const exp2 = `**Articulo 79.3 de la Constitucion Espanola:**

> "El voto de Senadores y Diputados es **personal e indelegable**."

**Por que B es correcta:**
El art. 79.3 CE establece que cada parlamentario debe votar por si mismo. No se permite el voto por delegacion (que un diputado vote en nombre de otro ausente) ni el voto por representacion. Esta regla garantiza que cada representante asuma personalmente la responsabilidad de sus decisiones parlamentarias.

**Por que las demas son incorrectas (cada una altera un dato del texto constitucional):**

- **A)** "Las Camaras podran reunirse en sesiones extraordinarias a peticion del Gobierno, de la Diputacion Permanente o por mayoria de **tres quintos** de cualquiera de las Camaras". Falso: el art. 73.2 CE dice "a peticion de la **mayoria absoluta** de los miembros de cualquiera de las Camaras", no "tres quintos". La trampa cambia la mayoria requerida. Sesiones extraordinarias: Gobierno, Diputacion Permanente o mayoria **absoluta**.

- **C)** "En cada Camara habra una Diputacion Permanente compuesta por un minimo de **veinticinco** miembros". Falso: el art. 78.1 CE dice que la Diputacion Permanente estara compuesta por un minimo de **veintiun** miembros (21), no veinticinco (25). La trampa cambia el numero minimo.

- **D)** "Las Camaras funcionaran en Pleno, Comisiones y **Salas**". Falso: el art. 75.1 CE dice que las Camaras funcionaran en **Pleno y en Comisiones**, no hay "Salas". Las Salas son organos de los tribunales de justicia, no de las Camaras parlamentarias.

**Datos clave del funcionamiento de las Cortes:**
- Voto: **personal e indelegable** (art. 79.3)
- Sesiones extraordinarias: Gobierno, Diputacion Permanente o mayoria **absoluta** (art. 73.2)
- Diputacion Permanente: minimo **21** miembros (art. 78.1)
- Funcionamiento: **Pleno y Comisiones** (art. 75.1)

**Clave:** Voto personal e indelegable. Cuidado con las trampas de numeros (21, no 25) y de conceptos (Pleno y Comisiones, sin Salas).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b1758e7e-2e2f-4b29-b8f2-78f09a5f0980");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.79.3 voto indelegable (" + exp2.length + " chars)");
})();
