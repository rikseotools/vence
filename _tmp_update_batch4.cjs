require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const updates = [
    {
      id: "573e906a-5245-435b-a174-01dd24d46948",
      name: "CE art.9.3 principios",
      explanation: `**Articulo 9.3 de la Constitucion Espanola:**

> "La Constitucion garantiza el principio de legalidad, la jerarquia normativa, la publicidad de las normas, la **irretroactividad** de las disposiciones sancionadoras no favorables o restrictivas de derechos individuales, la seguridad juridica, la responsabilidad y la interdiccion de la arbitrariedad de los poderes publicos."

**Por que B es correcta (es el principio NO garantizado):**
La opcion B dice "la **retroactividad** de una disposicion sancionadora desfavorable". Pero el art. 9.3 garantiza exactamente lo contrario: la **irretroactividad** (es decir, que NO se apliquen retroactivamente). La opcion invierte el principio.

**Por que las demas SI estan garantizadas:**

- **A)** "La responsabilidad de los poderes publicos" - Si aparece expresamente en el art. 9.3.

- **C)** "La jerarquia normativa" - Si aparece expresamente en el art. 9.3.

- **D)** "La publicidad de las normas" - Si aparece expresamente en el art. 9.3.

**Los 7 principios del art. 9.3 (para memorizar):** Legalidad, jerarquia normativa, publicidad de las normas, irretroactividad sancionadora, seguridad juridica, responsabilidad e interdiccion de la arbitrariedad.`
    },
    {
      id: "42608d1b-01e0-4834-95b9-ce5d4b8b0a97",
      name: "CE reformas agravado",
      explanation: `**La Constitucion Espanola no ha sido reformada nunca por el procedimiento agravado (art. 168).**

Las dos unicas reformas constitucionales se tramitaron por el **procedimiento ordinario del articulo 167**:

1. **Reforma de 1992** (art. 13.2): Para permitir el derecho de sufragio pasivo de ciudadanos de la UE en elecciones municipales, exigido por el Tratado de Maastricht.

2. **Reforma de 2011** (art. 135): Para introducir el principio de estabilidad presupuestaria y el limite de deficit estructural.

**Por que las demas son incorrectas:**

- **A)** "Una vez" - Falso. Ninguna reforma ha usado el procedimiento agravado.

- **C)** "Dos veces" - Confunde el numero total de reformas (2) con las realizadas por via agravada (0). Las dos reformas fueron por via ordinaria.

- **D)** "Tres veces" - Falso. Solo ha habido 2 reformas en total, y ninguna por via agravada.

**Clave:** El procedimiento agravado (art. 168) exige 2/3 de cada Camara, disolucion, nuevas elecciones, ratificacion por 2/3 y referendum. Es tan exigente que nunca se ha utilizado.`
    },
    {
      id: "521d5066-18c3-488c-904a-a07d9c96f22b",
      name: "Ley 39/2015 art.5 representacion",
      explanation: `**Articulo 5 de la Ley 39/2015** (Representacion):

La pregunta pide senalar la afirmacion **incorrecta**.

**Por que A es incorrecta:**
La opcion A dice que el documento electronico de consulta al registro de apoderamientos "**no** tendra la condicion de acreditacion". Pero el articulo 5.4 establece lo contrario: la representacion puede acreditarse mediante la inscripcion en el registro electronico de apoderamientos. El documento de consulta SI tiene valor de acreditacion.

**Por que las demas son correctas:**

- **B)** "La representacion podra acreditarse mediante cualquier medio valido en Derecho que deje constancia fidedigna" - Reproduce literalmente el art. 5.4.

- **C)** "El organo competente debera incorporar al expediente acreditacion de la condicion de representante" - Correcto segun el art. 5.6.

- **D)** "Se entendera acreditada la representacion mediante apoderamiento apud acta..." - Correcto segun el art. 5.4, que reconoce la comparecencia personal, electronica y la inscripcion registral como formas validas de acreditacion.

**Clave:** La opcion A anade un "no" que invierte el sentido del articulo. En preguntas de "senale la incorrecta", busca negaciones anadidas.`
    },
    {
      id: "0160382a-aa23-4b40-a206-d71a3ae41fa6",
      name: "CE Titulo III Cortes",
      explanation: `**Titulo III de la Constitucion Espanola: "De las Cortes Generales"** (articulos 66-96).

**Por que C es correcta:**
La composicion de las Cortes Generales (Congreso y Senado) se regula en el Titulo III, que incluye:
- Art. 68: Composicion del Congreso (300-400 Diputados)
- Art. 69: Composicion del Senado
- Art. 66: Las Cortes representan al pueblo espanol

**Por que las demas son incorrectas:**

- **A)** Titulo II - Trata "De la Corona" (arts. 56-65): el Rey, la sucesion, el refrendo. No regula las Cortes.

- **B)** Titulo IV - Trata "Del Gobierno y de la Administracion" (arts. 97-107): composicion del Gobierno, funciones del Presidente, responsabilidad. No regula las Cortes.

- **D)** Titulo V - Trata "De las relaciones entre el Gobierno y las Cortes Generales" (arts. 108-116): mocion de censura, cuestion de confianza, estados de alarma. Regula la relacion entre ambos, no la composicion.

**Esquema de titulos clave:**
- Titulo I: Derechos y deberes fundamentales
- Titulo II: La Corona
- **Titulo III: Las Cortes Generales**
- Titulo IV: El Gobierno
- Titulo V: Relaciones Gobierno-Cortes`
    },
    {
      id: "b7ae3c61-100c-4307-97f2-c0dc192c44a5",
      name: "Outlook 365 calendarios",
      explanation: `**En Outlook 365, es posible ver listas de eventos de SharePoint en el calendario.**

**Por que C es correcta:**
Si tienes acceso a un sitio de SharePoint, puedes integrar sus listas de eventos en tu calendario de Outlook. Esto permite visualizar en un solo lugar tanto tus citas personales como los eventos del equipo o la organizacion creados en SharePoint.

**Por que las demas son incorrectas:**

- **A)** "Para crear eventos es necesario Microsoft Teams" - Falso. Outlook permite crear tanto citas como eventos directamente, sin necesidad de Teams. Una cita es un compromiso personal y un evento es una actividad de todo el dia; ambos se crean desde Outlook.

- **B)** "Los calendarios no se pueden enviar por correo electronico" - Falso. Outlook permite compartir y enviar calendarios por correo electronico, pudiendo elegir el rango de fechas y el nivel de detalle.

- **D)** "No se pueden visualizar uno al lado del otro" - Falso. Outlook permite ver multiples calendarios superpuestos o en paralelo (modo "side by side"), lo que facilita comparar disponibilidades.`
    },
    {
      id: "e86af6ce-e2d9-4e57-9437-e9c1a5b12c25",
      name: "Outlook respuestas automaticas",
      explanation: `**Respuestas automaticas en Outlook en la web:**

**Por que C es correcta:**
Outlook en la web permite configurar respuestas automaticas (fuera de oficina) con las siguientes opciones:
- Mensajes **diferenciados** para contactos de dentro y fuera de la organizacion
- Opcion de **especificar o no** un intervalo de fechas y horas
- Si no se establece intervalo, la respuesta permanece activa hasta que se desactive manualmente

**Por que las demas son incorrectas:**

- **A)** "Solo un unico mensaje para todos los contactos" - Falso. Outlook permite crear dos mensajes distintos: uno para remitentes internos (de tu organizacion) y otro para externos.

- **B)** "Solo para contactos de mi organizacion" - Falso. Se puede configurar tanto para contactos internos como externos. Ademas, para los externos se puede elegir enviar solo a contactos conocidos o a cualquier remitente.

- **D)** "Unicamente si se especifica un intervalo de fechas" - Falso. El intervalo de fechas es opcional. Si no se establece, la respuesta automatica se mantiene activa hasta desactivarla manualmente.`
    },
    {
      id: "cbf3687c-9e06-40e4-ac15-cc333682c458",
      name: "CE art.147 Estatutos",
      explanation: `**Articulo 147.2 de la Constitucion Espanola:**

> "Los Estatutos de autonomia deberan contener:
> a) La denominacion de la Comunidad que mejor corresponda a su identidad historica.
> b) La delimitacion de su territorio.
> c) La denominacion, organizacion y sede de las instituciones autonomas propias.
> d) Las competencias asumidas dentro del marco establecido en la Constitucion y las bases para el traspaso de los servicios correspondientes."

**Por que A es correcta:**
"La denominacion, organizacion y sede de las instituciones autonomas propias" es el apartado c) del articulo 147.2. Es contenido obligatorio de todo Estatuto.

**Por que las demas son incorrectas:**

- **B)** "Los supuestos y formas de participacion en la organizacion de demarcaciones judiciales del territorio" - Esto se menciona en el art. 152.1 como posible contenido, pero no es uno de los contenidos obligatorios del art. 147.2.

- **C)** "Los recursos propios de la Comunidad Autonoma" - No esta en el art. 147.2. La financiacion autonomica se regula en el Titulo VIII (arts. 156-158) y en la LOFCA.

- **D)** "La prevision de convenios entre Comunidades Autonomas" - No es contenido obligatorio de los Estatutos. Los convenios entre CCAA se regulan en el art. 145 CE.

**Los 4 contenidos obligatorios del art. 147.2:** Denominacion, territorio, instituciones propias y competencias.`
    },
    {
      id: "654ee02b-e404-4191-a5d6-0fe36f26632e",
      name: "LO 3/1981 art.5 cese Defensor",
      explanation: `**Articulo 5 de la LO 3/1981** (Cese del Defensor del Pueblo):

El articulo distingue dos tipos de causas de cese:

**Causas automaticas** (art. 5.2: la vacante la declara el Presidente del Congreso):
- Renuncia
- Expiracion del plazo de nombramiento
- Muerte

**Causas que requieren votacion de 3/5 de cada Camara** (art. 5.2, con debate y audiencia):
- Actuar con notoria negligencia
- Condena firme por delito doloso
- Incapacidad sobrevenida

**Por que D es correcta:**
"Actuar con notoria negligencia en el cumplimiento de las obligaciones y deberes del cargo" es una de las causas que requiere decision por mayoria de 3/5 de cada Camara.

**Por que las demas son incorrectas (no requieren votacion de 3/5):**

- **A)** "Expiracion del plazo de nombramiento" - Es causa automatica. El Presidente del Congreso simplemente declara la vacante.

- **B)** "Muerte" - Es causa automatica. No tiene sentido someter a votacion.

- **C)** "Renuncia" - Es causa automatica. El Presidente del Congreso declara la vacante.

**Clave:** Las causas "involuntarias" (muerte, renuncia, expiracion) son automaticas. Las causas "por culpa" (negligencia, condena) requieren votacion cualificada con garantias (debate y audiencia).`
    },
    {
      id: "67c32f1a-ed57-473d-85b1-74b7748ac553",
      name: "Ley 19/2013 art.3 publicidad activa",
      explanation: `**Articulo 3.b) de la Ley 19/2013** (Transparencia):

> "Las entidades privadas que perciban durante el periodo de **un ano** ayudas o subvenciones publicas en cuantia superior a **100.000 euros** o cuando al menos el **40%** del total de sus ingresos anuales tengan caracter de ayuda o subvencion publica, siempre que alcancen como minimo **5.000 euros**."

**Por que A es correcta:**
Reproduce exactamente los cuatro datos clave del articulo 3.b): un ano, 100.000 euros, 40% y 5.000 euros.

**Por que las demas son incorrectas (cada una cambia algun dato):**

- **B)** Cambia "un ano" por "**dos** anos". El periodo es de un ano, no dos.

- **C)** Cambia dos datos: el 40% por **50%** y los 5.000 euros por **10.000** euros.

- **D)** Cambia tres datos: 100.000 por **50.000** euros, 40% por **50%** y 5.000 por **10.000** euros.

**Los 4 cifras clave del art. 3.b):**
- Periodo: **1 ano**
- Cuantia: mas de **100.000 euros**
- Porcentaje: al menos **40%** de ingresos
- Minimo: **5.000 euros**`
    },
    {
      id: "540ec37a-8a29-4f07-b565-245067d5fa95",
      name: "CE art.164 sentencias TC",
      explanation: `**Articulo 164.1 de la Constitucion Espanola:**

> "Las sentencias del Tribunal Constitucional se publicaran en el BOE **con los votos particulares**, si los hubiere. Tienen el valor de cosa juzgada **a partir del dia siguiente** de su publicacion y **no cabe recurso alguno** contra ellas. Las que declaren la inconstitucionalidad de una ley [...] y todas las que **no** se limiten a la estimacion subjetiva de un derecho, tienen plenos efectos frente a todos."

**Por que C es correcta:**
Reproduce fielmente el articulo: publicacion en BOE con votos particulares si los hubiere.

**Por que las demas son incorrectas:**

- **A)** Dice "las que estimen **subjetivamente** un derecho tienen plenos efectos frente a todos". Falso: es al reves. El articulo dice que tienen efectos erga omnes las que **NO** se limiten a la estimacion subjetiva. Las que si se limitan a estimar un derecho subjetivo solo afectan a las partes.

- **B)** "Pueden ser objeto de recurso de casacion" - Falso. El articulo dice expresamente que **no cabe recurso alguno** contra las sentencias del TC.

- **D)** "Tienen valor de cosa juzgada desde el dia de su publicacion" - Falso. El articulo dice "a partir del **dia siguiente** de su publicacion", no el mismo dia.

**Trampas clasicas:** La diferencia entre "el dia de" y "el dia siguiente de" es sutil pero frecuente en oposiciones.`
    }
  ];

  for (const u of updates) {
    const { error } = await supabase
      .from("questions")
      .update({ explanation: u.explanation })
      .eq("id", u.id);
    if (error) console.error("Error " + u.name + ":", error);
    else console.log("OK -", u.name, "(" + u.explanation.length + " chars)");
  }
})();
