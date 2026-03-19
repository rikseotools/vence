require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.22 asociaciones prohibidas
  const exp1 = `**Articulo 22 de la Constitucion Espanola** (Derecho de asociacion):

> **22.2:** "Las asociaciones que persigan fines o utilicen medios tipificados como delito son **ilegales**."
> **22.5:** "Se **prohiben** las asociaciones **secretas** y las de caracter **paramilitar**."

**La pregunta pide que asociaciones estan PROHIBIDAS.**

**Por que A es correcta:**
Las asociaciones **secretas** estan expresamente **prohibidas** por el art. 22.5 CE. La prohibicion constitucional alcanza a dos tipos: secretas y paramilitares.

**Por que las demas son incorrectas:**

- **B)** "Asociaciones que utilizan medios tipificados como delito". Estas son **ilegales** (art. 22.2), no prohibidas. La distincion es importante: "ilegales" (22.2) e "prohibidas" (22.5) son categorias diferentes en la CE. Las ilegales se declaran por sus fines o medios delictivos; las prohibidas estan vetadas constitucionalmente por su naturaleza.

- **C)** "Asociaciones de caracter militar". Trampa: el art. 22.5 prohibe las de caracter **paramilitar**, no "militar". Una asociacion militar puede ser legal (asociaciones profesionales de militares); lo prohibido es lo **paramilitar** (organizaciones civiles con estructura y disciplina militar).

- **D)** "Asociaciones que persigan fines tipificados como delito". Al igual que B, estas son **ilegales** (art. 22.2), no prohibidas (art. 22.5). La pregunta distingue entre ilegalidad y prohibicion.

**Resumen del art. 22 CE:**

| Categoria | Base legal | Ejemplos |
|-----------|-----------|----------|
| **Prohibidas** | Art. 22.5 | Secretas, paramilitares |
| **Ilegales** | Art. 22.2 | Fines delictivos, medios delictivos |
| Disolucion/suspension | Art. 22.4 | Solo por resolucion judicial motivada |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "42995433-8419-4429-834d-bdfa77e745e5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.22 asociaciones (" + exp1.length + " chars)");

  // #2 - CE art.168 reforma agravada
  const exp2 = `**Articulo 168 de la Constitucion Espanola** (Reforma constitucional agravada):

> **168.1:** "Cuando se propusiere la revision total de la Constitucion o una parcial que afecte al Titulo preliminar, al Capitulo segundo, Seccion primera del Titulo I, o al Titulo II, se procedera a la aprobacion del principio por **mayoria de dos tercios de cada Camara**, y a la **disolucion inmediata de las Cortes**."

El Titulo II (De la Corona, arts. 56-65) esta protegido por el procedimiento agravado del art. 168.

**Por que D es correcta:**
Reproduce literalmente el art. 168.1: mayoria de **dos tercios de cada Camara** + **disolucion inmediata de las Cortes** (ambas Camaras). La opcion D es la unica que recoge ambos elementos correctamente.

**Por que las demas son incorrectas:**

- **A)** "Mayoria de dos tercios del Congreso". Incompleta: falta el Senado. El art. 168.1 exige dos tercios de **cada Camara** (Congreso Y Senado), no solo del Congreso. Ademas, no menciona la disolucion.

- **B)** "Mayoria absoluta del Senado". Falso por partida doble: la mayoria no es absoluta sino de **dos tercios**, y no es solo del Senado sino de **cada Camara**. Ademas, no menciona la disolucion.

- **C)** "Mayoria de tres quintos de cada Camara y disolucion del Congreso". Dos errores: la mayoria no es de 3/5 (eso es el art. 167 ordinario) sino de **2/3**, y la disolucion no es solo del Congreso sino de **las Cortes** (ambas Camaras).

**Procedimiento completo del art. 168:**
1. Aprobacion del principio: 2/3 de cada Camara
2. Disolucion inmediata de las Cortes
3. Las nuevas Camaras ratifican y aprueban por 2/3
4. Referendum obligatorio de ratificacion`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "faff4d6b-f8e4-4931-8e1e-4a607205bffd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.168 reforma agravada (" + exp2.length + " chars)");
})();
