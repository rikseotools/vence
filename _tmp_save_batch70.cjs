require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.116.6 no disolucion Congreso en estados excepcionales
  const exp1 = `**Articulo 116.5 de la Constitucion Espanola:**

> "No podra procederse a la **disolucion del Congreso** mientras esten declarados algunos de los estados comprendidos en el presente articulo, quedando **automaticamente convocadas las Camaras** si no estuvieren en periodo de sesiones."

**Por que D es correcta:**
Durante cualquier estado excepcional (alarma, excepcion o sitio), el Congreso **no puede disolverse** y, si las Camaras estan en vacaciones, **se convocan automaticamente**. Esto garantiza el control parlamentario durante las situaciones de emergencia: el Gobierno no puede gobernar sin supervision.

**Por que las demas son incorrectas:**

- **A)** "Disolucion automatica con Comision ad hoc". Falso: es exactamente lo contrario. No hay disolucion, y la figura de una "Comision ad hoc" asumiendo competencias del Congreso no existe en la CE.

- **B)** "Disolucion inmediata, competencias a la Diputacion Permanente". Falso: no hay disolucion. La Diputacion Permanente vela por los poderes de las Camaras cuando estas no estan reunidas (art. 78 CE), pero el art. 116 **impide** la disolucion, por lo que la Diputacion Permanente no necesita asumir nada: el Congreso sigue en funcionamiento.

- **C)** "Disolucion por mayoria simple". Falso: no cabe ninguna disolucion del Congreso durante los estados excepcionales, ni por mayoria simple ni por ninguna otra. La prohibicion es absoluta.

**Garantias parlamentarias durante estados excepcionales (art. 116 CE):**
- El Congreso **no se disuelve**
- Las Camaras se convocan **automaticamente** si estan en vacaciones
- El funcionamiento de las Camaras no puede interrumpirse
- Los principios de responsabilidad del Gobierno no se alteran`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e316738c-867c-4036-b7f6-3bf21fd4d840");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE 116.5 no disolucion (" + exp1.length + " chars)");

  // #2 - CE art.24 habeas corpus NO esta
  const exp2 = `**Articulo 24 de la Constitucion Espanola** (Tutela judicial efectiva):

> "2. [...] todos tienen derecho al Juez ordinario predeterminado por la ley, a la **defensa y a la asistencia de letrado**, a ser informados de la acusacion, a un proceso publico sin dilaciones indebidas, a utilizar los medios de prueba pertinentes, a no declarar contra si mismos, a **no confesarse culpables** y a la **presuncion de inocencia**."

**Por que C es la respuesta (habeas corpus NO esta en el art. 24):**
El procedimiento de *habeas corpus* **no se menciona en el art. 24**. Se regula en el **art. 17.4 CE**, que trata sobre el derecho a la libertad:

> Art. 17.4: "La ley regulara un procedimiento de **habeas corpus** para producir la inmediata puesta a disposicion judicial de toda persona detenida ilegalmente."

El art. 24 se refiere a la **tutela judicial** (garantias procesales), mientras que el art. 17 se refiere a la **libertad personal** (detencion, plazos, derechos del detenido, habeas corpus).

**Por que las demas SI estan en el art. 24:**

- **A)** "Derecho a la defensa y asistencia de letrado". **SI**: art. 24.2 lo menciona expresamente.

- **B)** "Presuncion de inocencia". **SI**: art. 24.2 lo incluye como ultimo derecho de la enumeracion.

- **D)** "Derecho a no confesarse culpable". **SI**: art. 24.2 dice textualmente "a no confesarse culpables".

**Clave:** *Habeas corpus* = art. **17.4** (libertad personal), NO art. 24 (tutela judicial). Ambos son derechos fundamentales de la Seccion 1a, pero en articulos distintos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "487717b6-097f-4f27-bd93-186defd80a08");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.24 habeas corpus (" + exp2.length + " chars)");

  // #3 - CE art.116.3 estado de excepcion
  const exp3 = `**Articulo 116.3 de la Constitucion Espanola:**

> "El estado de excepcion sera declarado por el **Gobierno** mediante **decreto acordado en Consejo de Ministros**, previa autorizacion del **Congreso de los Diputados**."

**Por que C es correcta:**
El estado de excepcion lo declara el **Gobierno** (en Consejo de Ministros), pero necesita la **autorizacion previa del Congreso** (no de las Cortes Generales en su conjunto). Duracion maxima: 30 dias, prorrogables otros 30.

**Por que las demas son incorrectas:**

- **A)** "El Congreso por mayoria absoluta, a propuesta del Gobierno". Falso: **invierte los papeles**. No es el Congreso quien declara, sino el Gobierno. El Congreso solo **autoriza**, no declara. Ademas, no se exige mayoria absoluta para la autorizacion.

- **B)** "El Presidente del Gobierno mediante Real Decreto, previa autorizacion de las Cortes Generales". Doble error:
  1. No es "el Presidente" solo, es "el **Gobierno** mediante decreto acordado en **Consejo de Ministros**" (organo colegiado).
  2. La autorizacion no es de "las **Cortes Generales**" (Congreso + Senado), sino solo del **Congreso de los Diputados**.

- **D)** "Previa autorizacion de las Cortes Generales". Falso: cambia "**Congreso de los Diputados**" por "**Cortes Generales**". Trampa clasica. La autorizacion la da solo el Congreso, no las dos Camaras conjuntamente.

**Los tres estados excepcionales (art. 116 CE):**

| Estado | Quien declara | Quien autoriza/propone | Duracion |
|--------|--------------|----------------------|----------|
| **Alarma** | Gobierno (Consejo de Ministros) | Da cuenta al Congreso (prorroga con autorizacion) | 15 dias + prorrogas |
| **Excepcion** | Gobierno (Consejo de Ministros) | Autorizacion previa del **Congreso** | 30 dias + 30 |
| **Sitio** | **Congreso** por mayoria absoluta | A propuesta del Gobierno | Lo fija el Congreso |`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "fc70eb42-bfed-4250-9668-3fd6e8729163");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.116.3 estado excepcion (" + exp3.length + " chars)");
})();
