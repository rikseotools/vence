require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RDL 5/2015 art.16.4 progresion simultanea horizontal y vertical
  const exp1 = `**Articulo 16.4 del RDL 5/2015 (TREBEP):**

> "Los funcionarios de carrera podran progresar **simultaneamente** en las modalidades de carrera horizontal y vertical cuando la **Administracion correspondiente las haya implantado en un mismo ambito**."

**Por que C es correcta:**
El art. 16.4 TREBEP permite la progresion simultanea en carrera horizontal y vertical, pero con una condicion: que la Administracion correspondiente haya implantado **ambas modalidades** en un mismo ambito. No es automatico ni general; depende de que la Administracion las haya desarrollado.

**Por que las demas son incorrectas:**

- **A)** "No, salvo reorganizacion de recursos". Falso: la condicion no es una reorganizacion de recursos, sino que ambas modalidades esten **implantadas en el mismo ambito**. El concepto de "reorganizacion de recursos" no aparece en el art. 16.

- **B)** "No, en ningun caso". Falso: el art. 16.4 expresamente permite la progresion simultanea. No hay prohibicion absoluta.

- **D)** "Si, excepcionalmente, por el organo directivo". Falso: no es excepcional ni depende de la decision de un organo directivo concreto. Es una posibilidad ordinaria, condicionada a que la Administracion haya implantado ambas modalidades.

**Clave:** Progresion simultanea horizontal + vertical = **SI**, pero solo si la Administracion las ha **implantado en el mismo ambito**. No es automatica, excepcional ni discrecional de un organo directivo.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e44ab5ce-4fe3-47fb-bced-4715aa12afc1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP progresion simultanea (" + exp1.length + " chars)");

  // #2 - LO 4/2001 art.4 peticiones colectivas datos
  const exp2 = `**Articulo 4 de la LO 4/2001** (Requisitos de las peticiones):

> "1. Las peticiones [...] incluiran necesariamente la **identidad** del solicitante, la **nacionalidad** si la tuviere, el lugar o medio para **notificaciones**, el **objeto** y el **destinatario** de la peticion.
> 2. En el caso de peticiones colectivas, ademas [...] seran **firmadas por todos los peticionarios**, debiendo figurar, junto a la firma de cada uno de ellos, su **nombre y apellidos**."

**Por que B es correcta ("la fecha de presentacion"):**
La **fecha de presentacion** NO es un dato que el art. 4 exija como contenido obligatorio de la peticion. La fecha la determina el registro al presentarla, no el peticionario al redactarla.

**Lo que SI exige el art. 4 (y por tanto las demas opciones SI son datos reglamentarios):**

- **A)** "Nacionalidad". **SI es obligatorio**: art. 4.1 dice expresamente "la nacionalidad si la tuviere". Es un dato reglamentario que debe incluirse.

- **C)** "Destinatario". **SI es obligatorio**: art. 4.1 dice "el destinatario de la peticion". Hay que indicar a que organo va dirigida.

- **D)** "Firmas con nombre y apellidos". **SI es obligatorio** en peticiones colectivas: art. 4.2 exige que esten "firmadas por todos los peticionarios, debiendo figurar, junto a la firma de cada uno de ellos, su nombre y apellidos".

**Datos obligatorios del art. 4 (peticiones individuales):**
1. Identidad del solicitante
2. Nacionalidad (si la tuviere)
3. Lugar/medio para notificaciones
4. Objeto de la peticion
5. Destinatario

**Adicional para peticiones colectivas:** firma de todos + nombre y apellidos junto a cada firma.

**Clave:** La **fecha de presentacion** NO es un requisito del contenido de la peticion. La fecha la aporta el registro, no el peticionario.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a2849695-0033-4f36-b505-84bd6901b36a");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LO 4/2001 peticiones datos (" + exp2.length + " chars)");

  // #3 - CE art.122.3 miembros CGPJ propuestos por Senado
  const exp3 = `**Articulo 122.3 de la Constitucion Espanola:**

> "El Consejo General del Poder Judicial estara integrado por el Presidente del Tribunal Supremo [...] y por veinte miembros nombrados por el Rey por un periodo de cinco anos. De estos: **doce** entre Jueces y Magistrados [...]; **cuatro** a propuesta del **Congreso** [...]; **cuatro** a propuesta del **Senado**; elegidos en ambos casos por mayoria de **tres quintos**."

**Por que A es correcta (cuatro):**
El Senado propone **4 miembros** del CGPJ, exactamente el mismo numero que el Congreso. Ambas Camaras eligen sus candidatos por mayoria de 3/5, entre abogados y juristas de reconocida competencia con mas de 15 anos de ejercicio profesional.

**Por que las demas son incorrectas:**

- **B)** "Dos". Falso: son 4, no 2. Quiza la confusion viene de dividir los 4 por algun criterio, pero la CE asigna 4 al Senado como bloque.

- **C)** "Seis". Falso: son 4, no 6. Si fueran 6+6=12 parlamentarios, sumados a los 12 judiciales, serian 24 miembros, no 20.

- **D)** "Cinco". Falso: son 4, no 5. Si fueran 5+5=10, sumados a 12 judiciales, serian 22 miembros, no 20.

**Composicion del CGPJ (20 miembros + Presidente del TS):**

| Origen | Numero | Elegidos por |
|--------|--------|-------------|
| Jueces y Magistrados | **12** | Segun LOPJ |
| Propuesta del **Congreso** | **4** | Mayoria 3/5 |
| Propuesta del **Senado** | **4** | Mayoria 3/5 |
| **Total** | **20** | + Presidente TS |

**Truco para recordar:** 12 + 4 + 4 = 20. Congreso y Senado proponen el **mismo numero** (4 cada uno). Mandato: **5 anos**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "8104067d-dae7-4a56-9aa4-02f26c842f35");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.122.3 CGPJ (" + exp3.length + " chars)");
})();
