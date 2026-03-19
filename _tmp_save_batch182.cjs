require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.35.1.d motivación procedimientos selectivos
  const exp1 = `**Articulo 35.1.d de la Ley 39/2015 (LPAC) - Motivacion de actos selectivos:**

> Art. 35.1: "Seran motivados, con sucinta referencia de hechos y fundamentos de derecho: [...]
> **d)** Los actos que pongan fin a los procedimientos selectivos y de concurrencia competitiva, **de conformidad con lo que dispongan las normas que regulen sus convocatorias**, debiendo, **en todo caso**, quedar acreditados en el procedimiento los **fundamentos de la resolucion** que se adopte."

**Por que C es correcta:**
La opcion C reproduce literalmente el art. 35.1.d: la motivacion debe hacerse (1) conforme a las normas de la convocatoria, y (2) en todo caso deben quedar acreditados los fundamentos de la resolucion. Ambos requisitos son acumulativos.

**Por que las demas son incorrectas:**

- **A)** "No precisan **nunca** motivacion expresa." Falso: el art. 35.1.d establece expresamente que **si** deben ser motivados. Los procedimientos selectivos y de concurrencia competitiva estan incluidos en la lista de actos que requieren motivacion obligatoria.

- **B)** "Seran motivados de conformidad con lo que dispongan los respectivos **tribunales o comisiones de valoracion**." Falso: el art. 35.1.d dice "de conformidad con las **normas que regulen las convocatorias**", no con lo que dispongan los tribunales. La fuente de la motivacion son las normas de la convocatoria, no el criterio libre del tribunal calificador.

- **D)** "Seran motivados cuando el procedimiento se haya resuelto aplicando un **acuerdo de tramitacion de urgencia o de ampliacion de plazos**." Falso: el art. 35.1.d no condiciona la motivacion a la tramitacion de urgencia ni a la ampliacion de plazos. Los actos selectivos **siempre** deben motivarse, no solo en esos supuestos. Los acuerdos de tramitacion de urgencia se regulan en otro apartado (art. 35.1.e).

**Actos que requieren motivacion obligatoria (art. 35.1):**
- a) Limitacion de derechos o intereses
- b) Revision de oficio, recursos, arbitraje
- c) Separacion del criterio precedente o del dictamen consultivo
- d) **Procedimientos selectivos y de concurrencia competitiva**
- e) Urgencia, ampliacion de plazos, tramitacion de emergencia

**Clave:** Los actos selectivos siempre se motivan conforme a las normas de la convocatoria. No depende del tribunal ni de circunstancias especiales.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ec27d458-80b6-4b58-aab7-aafd14431d7c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.35 motivacion selectivos (" + exp1.length + " chars)");

  // #2 - Windows NOT operador booleano excluir término
  const exp2 = `**Operadores booleanos en la busqueda del Explorador de Windows:**

**Por que A es correcta (NOT):**
El operador **NOT** excluye un termino de los resultados de busqueda. Por ejemplo, si buscamos **informe NOT borrador**, obtendremos archivos que contengan "informe" pero que **no** contengan "borrador". Es el operador de exclusion.

**Sintaxis:** termino_incluido NOT termino_excluido

**Por que las demas son incorrectas (tienen funciones diferentes):**

- **B)** "**Parentesis** ( )". Falso: los parentesis agrupan terminos de busqueda para buscar varias palabras en **cualquier orden**. Por ejemplo, (informe presupuesto) encontraria archivos con ambas palabras sin importar el orden. No excluyen terminos.

- **C)** "**OR**". Falso: el operador OR busca archivos que contengan **uno u otro** termino (o ambos). Por ejemplo, informe OR acta encontraria archivos con "informe", con "acta" o con ambos. Es un operador de **inclusion alternativa**, no de exclusion.

- **D)** "**Corchetes** [ ]". Falso: los corchetes no son un operador de busqueda reconocido en el Explorador de Windows. No tienen funcion de busqueda en el sistema de archivos.

**Operadores booleanos en Windows:**

| Operador | Funcion | Ejemplo |
|----------|---------|---------|
| **NOT** (o -) | **Excluir** un termino | informe NOT borrador |
| **OR** | Uno **u** otro termino | informe OR acta |
| **AND** | Ambos terminos (por defecto) | informe presupuesto |
| **" "** | Frase **exacta** | "informe anual" |
| **( )** | Agrupar en **cualquier orden** | (informe anual) |

**Clave:** NOT = excluir. OR = alternativa. AND = ambos (implicito). Comillas = frase exacta.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "71511aae-af4d-40f1-a557-f67ba9e44ddd");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows NOT excluir busqueda (" + exp2.length + " chars)");

  // #3 - Windows ver versión INCORRECTA Centro de actividades
  const exp3 = `**Formas de ver la version de Windows - Identificar la INCORRECTA:**

**Por que C es la respuesta INCORRECTA (y por tanto la respuesta):**
La opcion C dice "Abrir el **Centro de actividades** y hacer clic en **Administrar notificaciones**". Esto no muestra la version de Windows. El Centro de actividades (o Centro de notificaciones) gestiona las **notificaciones** del sistema y los accesos rapidos (Wi-Fi, Bluetooth, modo avion, etc.), no contiene informacion sobre la version del sistema operativo. "Administrar notificaciones" lleva a la configuracion de notificaciones, no a la informacion del sistema.

**Por que las demas SI son correctas (metodos validos para ver la version):**

- **A)** "Explorador de archivos > clic derecho en **Este equipo** > **Propiedades**." **Correcto**: al hacer clic derecho en "Este equipo" y seleccionar "Propiedades", se abre la pantalla de "Informacion" del sistema, donde se muestran la edicion, version y compilacion de Windows.

- **B)** "Menu Inicio > **Configuracion** > **Sistema** > **Informacion**." **Correcto**: es la ruta oficial de Windows 11 para ver la informacion del sistema. En "Especificaciones de Windows" aparece la edicion, la version y el numero de compilacion.

- **D)** "Escribir **winver** en la barra de busqueda y pulsar Intro." **Correcto**: el comando **winver** abre una ventana que muestra directamente la version y compilacion de Windows. Es el metodo mas rapido y clasico.

**Metodos para ver la version de Windows:**

| Metodo | Ruta |
|--------|------|
| **Este equipo** | Clic derecho > Propiedades |
| **Configuracion** | Inicio > Configuracion > Sistema > Informacion |
| **winver** | Buscar "winver" > Enter |
| **cmd** | Escribir "ver" en simbolo del sistema |

**Clave:** El Centro de actividades gestiona notificaciones, no muestra la version de Windows. Los tres metodos validos son: Este equipo > Propiedades, Configuracion > Sistema > Informacion, y winver.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "1af84804-83c9-4d51-9159-14d88c359360");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Windows ver version incorrecta (" + exp3.length + " chars)");
})();
