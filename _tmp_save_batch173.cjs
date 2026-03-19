require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Consejo Desarrollo Sostenible función incorrecta "ONU" vs "Agenda 2030"
  const exp1 = `**Orden DSA/819/2020 - Funciones del Consejo de Desarrollo Sostenible:**

> Funcion c) real: "Contribuir a la divulgacion y comunicacion de **la Agenda 2030** al conjunto de la ciudadania espanola."

**Por que A es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion A dice: "divulgacion y comunicacion de los avances de **ONU** en el cumplimiento de los objetivos". El texto real de la funcion c) dice "de **la Agenda 2030**", no "de los avances de ONU". El Consejo divulga la Agenda 2030 en Espana, no comunica los avances de Naciones Unidas como organizacion.

**Por que las demas SI son funciones correctas:**

- **B)** "Asesorar a la Direccion General de Agenda 2030 en la elaboracion e implementacion de los planes y estrategias." **Correcto**: funcion a) de la Orden. Originalmente decia "Secretaria de Estado para la Agenda 2030", actualizado a Direccion General por RD 209/2024.

- **C)** "Generar documentos y analisis sobre aspectos de la implementacion para la consecucion de la Agenda 2030." **Correcto**: funcion b) de la Orden.

- **D)** "Impulsar el dialogo y coordinacion entre todos los agentes sociales, economicos, medioambientales y culturales." **Correcto**: funcion d) de la Orden.

**Funciones del Consejo de Desarrollo Sostenible:**
a) **Asesorar** a la DG de Agenda 2030
b) **Generar** documentos y analisis
c) **Divulgar** la Agenda 2030 (no "avances de ONU")
d) **Impulsar** el dialogo entre agentes

**Clave:** El Consejo divulga "la Agenda 2030", no "los avances de ONU". La trampa sustituye el objeto de la divulgacion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0d20255f-5981-4385-bb17-bdf752aa8771");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Consejo Desarrollo Sostenible funciones (" + exp1.length + " chars)");

  // #2 - RD 208/1996 art.5 distribución y difusión recepción textos publicaciones
  const exp2 = `**Articulo 5.4.b del RD 208/1996 - Unidades departamentales de informacion administrativa:**

Las funciones de **distribucion y difusion** de la informacion incluyen los siguientes cometidos:

> 1. **Recepcion** de los textos de las publicaciones para su diseno y reproduccion
> 2. Distribucion a unidades dependientes
> 3. Distribucion a unidades exteriores
> 4. Difusion general de publicaciones y bases de datos
> 5. Mantenimiento de bases de datos de difusores intermediarios
> 6. Utilizacion de la imagen del Departamento

**Por que C es correcta (recepcion de textos para diseno y reproduccion):**
Dentro de la funcion de distribucion y difusion (art. 5.4.b), el primer cometido es la **recepcion** de los textos de las publicaciones para su **diseno y reproduccion**, sin perjuicio de las competencias de las unidades editoras departamentales. La unidad recibe, disena y reproduce; no elabora los textos.

**Por que las demas son incorrectas:**

- **A)** "**Elaboracion** de los textos de las publicaciones informativas". Falso: la unidad **recibe** los textos (para disenarlos y reproducirlos), pero no los **elabora**. La elaboracion corresponde a los centros directivos que generan el contenido. La trampa sustituye "recepcion" por "elaboracion".

- **B)** "**Promocion** de la informacion administrativa de la unidad". Falso: la funcion es de **distribucion y difusion**, no de "promocion". La difusion consiste en hacer llegar las publicaciones a sus destinatarios, no en promover la propia unidad.

- **D)** "**Creacion** y mantenimiento de las bases de datos propias". Falso: el art. 5.4.b.5 habla de **mantenimiento** de bases de datos de difusores intermediarios, pero no de "creacion" de bases de datos "propias". La trampa anade "creacion" y cambia "difusores intermediarios" por "propias".

**Clave:** Distribucion y difusion = **recepcion** de textos (no elaboracion). La unidad recibe, disena y reproduce, pero no crea el contenido.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "8e13ff75-422a-498a-a516-c13644b6a5ed");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 208/1996 distribucion difusion (" + exp2.length + " chars)");

  // #3 - CE art.168 reforma Título II referéndum obligatorio "en todo caso"
  const exp3 = `**Articulo 168.3 de la Constitucion Espanola - Reforma agravada:**

> "Aprobada la reforma por las Cortes Generales, **sera sometida a referendum** para su ratificacion."

**Por que C es correcta (en todo caso):**
El art. 168.3 establece que, aprobada la reforma agravada por las nuevas Cortes (por 2/3), se somete a referendum **obligatoriamente**. No dice "cuando lo soliciten" ni condiciona el referendum a ninguna peticion. Es automatico. El Titulo II (De la Corona) esta protegido por el procedimiento agravado (art. 168), donde el referendum es preceptivo.

**Por que las demas son incorrectas (confunden art. 167 con art. 168):**

- **A)** "Cuando lo soliciten 1/10 de los miembros del **Congreso**". Falso: describe el referendum **facultativo** del art. **167.3** (reforma ordinaria), pero ademas lo limita al Congreso cuando el art. 167.3 dice "de **cualquiera** de las Camaras". Para la reforma del Titulo II (art. 168), el referendum es obligatorio, no facultativo.

- **B)** "Cuando lo soliciten 1/10 de los miembros de cualquiera de las Camaras". Falso: reproduce correctamente el art. **167.3** (reforma ordinaria), pero la reforma del Titulo II se tramita por el art. **168** (reforma agravada), donde el referendum es **obligatorio**, no a solicitud.

- **D)** "Cuando lo soliciten 1/10 de los miembros del **Senado**". Falso: como A, describe un referendum facultativo y ademas lo limita solo al Senado. No aplica al art. 168.

**Reforma ordinaria (art. 167) vs agravada (art. 168):**

| Aspecto | Ordinaria (art. 167) | Agravada (art. 168) |
|---------|---------------------|---------------------|
| Materias | Resto de la CE | T. Preliminar, Sec. 1.a Cap. II T. I, **T. II** |
| Mayoria | 3/5 | **2/3** |
| Disolucion Cortes | No | **Si** |
| Referendum | **Facultativo** (si lo pide 1/10) | **Obligatorio** |

**Clave:** Titulo II = reforma agravada (art. 168) = referendum **obligatorio**. No confundir con el referendum facultativo del art. 167 (reforma ordinaria).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "7c52d060-0374-4473-b935-0bb96c1a3373");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.168 referendum obligatorio (" + exp3.length + " chars)");
})();
