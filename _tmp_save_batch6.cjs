require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.168.3 referendum obligatorio
  const exp1 = `**Articulo 168.3 de la Constitucion Espanola** (Referendum en reforma agravada):

> **168.3:** "Aprobada la reforma por las Cortes Generales, sera sometida a **referendum para su ratificacion**."

**Por que C es correcta:**
En el procedimiento agravado (art. 168), el referendum es **automatico y obligatorio**. No requiere solicitud de nadie: aprobada la reforma, se somete a referendum directamente. Esto lo diferencia del art. 167 (procedimiento ordinario).

**Por que las demas son incorrectas:**

- **A)** "Cuando asi lo soliciten, dentro de 15 dias, 1/10 de los miembros de cualquiera de las Camaras". Esto describe el referendum **facultativo** del **art. 167.3** (reforma ordinaria), no del 168. En el 168 no hay solicitud: es automatico.

- **B)** "1/5 de los miembros de cualquiera de las Camaras". Falso: ni en el art. 167 ni en el 168 se menciona "una quinta parte". El art. 167.3 habla de 1/10, y el 168 no requiere solicitud.

- **D)** "Dentro de 20 dias, 1/10 de los miembros". Mezcla conceptos: los 20 dias no aparecen en ningun articulo de reforma (el 167.3 dice 15 dias). Y de nuevo, el 168 no requiere solicitud.

**Referendum segun tipo de reforma:**

| | Art. 167 (ordinario) | Art. 168 (agravado) |
|---|---|---|
| Referendum | Facultativo | **Obligatorio** |
| Solicitud | 1/10 en 15 dias | No requiere |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "be89aef6-3ecc-43cb-9eaa-e54dd45adb6d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.168.3 referendum (" + exp1.length + " chars)");

  // #2 - RGPD art.4 elaboracion de perfiles
  const exp2 = `**Articulo 4 del Reglamento (UE) 2016/679 (RGPD)** - Definiciones:

> **4.4)** "**Elaboracion de perfiles**: toda forma de tratamiento automatizado de datos personales consistente en utilizar datos personales para evaluar determinados aspectos personales de una persona fisica, en particular para analizar o predecir aspectos relativos al rendimiento profesional, situacion economica, salud, preferencias personales, intereses, fiabilidad, comportamiento, ubicacion o movimientos."

**Por que B es correcta:**
La definicion que describe la pregunta (tratamiento automatizado para evaluar aspectos personales, predecir rendimiento, salud, comportamiento, etc.) corresponde exactamente a la "elaboracion de perfiles" del art. 4.4 RGPD.

**Por que las demas son incorrectas:**

- **A)** "Limitacion del tratamiento" - Art. 4.3 RGPD: es el marcado de datos almacenados con el fin de **limitar su tratamiento en el futuro**. No tiene que ver con evaluar o predecir aspectos personales, sino con restringir el uso de datos.

- **C)** "Fichero" - Art. 4.6 RGPD: es un conjunto estructurado de datos personales, accesibles con arreglo a criterios determinados. Es un concepto de almacenamiento, no de analisis o prediccion.

- **D)** "Seudonimizacion" - Art. 4.5 RGPD: tratamiento de datos de modo que ya no puedan atribuirse a un interesado sin informacion adicional. Es una tecnica de **proteccion**, no de evaluacion de personas.

**Definiciones clave del art. 4 RGPD:**

| Concepto | Finalidad |
|----------|-----------|
| Elaboracion de perfiles | Evaluar/predecir aspectos personales |
| Seudonimizacion | Proteger datos (no atribuibles sin info adicional) |
| Limitacion del tratamiento | Restringir uso futuro de datos |
| Fichero | Almacenar datos estructurados |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "0a350cb1-90fb-498e-a65b-699ea5a4b86e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RGPD art.4 perfiles (" + exp2.length + " chars)");

  // #3 - CE art.68.6 plazos elecciones
  const exp3 = `**Articulo 68.6 de la Constitucion Espanola** (Plazos electorales del Congreso):

> **68.6:** "Las elecciones tendran lugar entre los **treinta dias y sesenta dias** desde la terminacion del mandato. El Congreso electo debera ser convocado dentro de los **veinticinco dias** siguientes a la celebracion de las elecciones."

**Por que D es correcta:**
Recoge los dos plazos exactos del art. 68.6: elecciones entre **30 y 60 dias** desde fin de mandato, y convocatoria del Congreso dentro de **25 dias** desde las elecciones.

**Por que las demas son incorrectas:**

- **A)** "25-70 dias... 30 dias". Dos errores: el plazo para elecciones es 30-60 (no 25-70), y la convocatoria es en 25 dias (no 30). Intercambia los numeros 25 y 30 y cambia 60 por 70.

- **B)** "25-60 dias... 30 dias". Un error: las elecciones empiezan a los **30** dias (no 25) y la convocatoria es en **25** dias (no 30). Intercambia el 25 y el 30.

- **C)** "30-70 dias... 25 dias". Un error: el plazo maximo es **60** dias (no 70). La convocatoria si es 25 dias (correcto en este caso).

**Los tres numeros clave del art. 68.6 CE:**
- **30** dias: plazo minimo para elecciones
- **60** dias: plazo maximo para elecciones
- **25** dias: plazo para convocar el Congreso electo

**Truco:** 30-60-25 (los plazos van descendiendo: 30, luego hasta 60, luego 25 para convocar).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "20a3b3ed-48c2-461b-a177-727bcda91ddd");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.68.6 plazos (" + exp3.length + " chars)");
})();
