require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.62 "expedir orden ministerial" NO corresponde al Rey
  const exp1 = `**Articulo 62 de la Constitucion Espanola - Funciones del Rey:**

> Art. 62.f): "**Expedir los decretos** acordados en el Consejo de Ministros, conferir los empleos civiles y militares y conceder honores y distinciones con arreglo a las leyes."

**Por que C es correcta (expedir una orden ministerial NO corresponde al Rey):**
Las **ordenes ministeriales** son disposiciones dictadas por un Ministro en el ambito de su competencia. Las firma y expide el propio Ministro, no el Rey. El Rey expide **decretos** (Reales Decretos), no ordenes ministeriales. La jerarquia normativa distingue claramente entre ambos tipos de disposiciones.

**Por que las demas SI corresponden al Rey:**

- **A)** "Nombrar a un Presidente de Comunidad Autonoma." **Correcto**: el art. 152.1 CE establece que el Presidente de la CCAA es "elegido por la Asamblea, de entre sus miembros, y **nombrado por el Rey**". El nombramiento formal corresponde al Rey.

- **B)** "Convocar referendum en los casos previstos en la CE." **Correcto**: el art. 62.c) CE atribuye al Rey "convocar a referendum en los casos previstos en la Constitucion". Es una funcion regia expresamente recogida.

- **D)** "Ejercer el derecho de gracia." **Correcto**: el art. 62.i) CE atribuye al Rey "ejercer el derecho de gracia con arreglo a la ley, que no podra autorizar indultos generales". El indulto es una prerrogativa real.

**Actos del Rey (art. 62 CE) - seleccion:**

| Letra | Funcion |
|-------|---------|
| a) | Sancionar y promulgar leyes |
| b) | Convocar/disolver Cortes, convocar elecciones |
| c) | Convocar referendum |
| d) | Proponer/nombrar Presidente del Gobierno |
| e) | Nombrar/separar miembros del Gobierno |
| **f)** | **Expedir decretos**, conferir empleos, conceder honores |
| i) | Derecho de gracia (no indultos generales) |

**Clave:** El Rey expide **decretos**, no ordenes ministeriales. Las ordenes ministeriales las firma el Ministro competente. No confundir "Real Decreto" (firmado por el Rey) con "Orden Ministerial" (firmada por el Ministro).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8c608ba0-3910-4564-ab7a-34557c986905");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.62 orden ministerial no Rey (" + exp1.length + " chars)");

  // #2 - CE art.167.3 reforma art.11 referéndum facultativo 1/10
  const exp2 = `**Articulos 167 y 168 de la Constitucion Espanola - Reforma constitucional:**

> Art. 167.3: "Aprobada la reforma por las Cortes Generales, sera sometida a **referendum** para su ratificacion cuando asi lo soliciten, dentro de los **quince dias** siguientes a su aprobacion, **una decima parte** de los miembros de cualquiera de las Camaras."

**Paso previo: Identificar el procedimiento aplicable**

El art. 11 CE ("La nacionalidad espanola se adquiere, se conserva y se pierde de acuerdo con lo establecido por la ley") esta en el **Titulo I, Capitulo Primero** ("De los espanoles y los extranjeros", arts. 11-13).

El art. **168** (procedimiento agravado, con referendum **obligatorio**) solo se aplica a:
- Titulo Preliminar (arts. 1-9)
- Seccion 1.a del Capitulo 2.o del Titulo I (arts. 15-29)
- Titulo II - La Corona (arts. 56-65)

Como el art. 11 **no esta** en ninguna de esas partes protegidas, se aplica el procedimiento **ordinario del art. 167**, donde el referendum es **facultativo** (no obligatorio).

**Por que D es correcta (1/10 de los miembros, 15 dias):**
El art. 167.3 establece que el referendum se convoca solo si lo solicita **una decima parte** (1/10) de los miembros de cualquiera de las Camaras, dentro de los **15 dias** siguientes a la aprobacion. Es un referendum facultativo, no automatico.

**Por que las demas son incorrectas:**

- **A)** "Una **quinta parte** de los miembros [...] quince dias." Falso: la fraccion correcta es 1/10, no 1/5. El plazo de 15 dias es correcto, pero la proporcion esta duplicada. 1/5 no aparece en el art. 167.3.

- **B)** "Si, **en todo caso**." Falso: el referendum solo es obligatorio "en todo caso" en el procedimiento del art. **168** (reforma agravada). En el art. 167 es facultativo, condicionado a la solicitud de 1/10 de los miembros.

- **C)** "No, **en ningun caso**." Falso: si puede haber referendum en el art. 167, pero solo si lo solicita 1/10 de los miembros. No es que no proceda nunca; simplemente no es automatico.

**Reforma constitucional - comparativa:**

| Aspecto | Art. 167 (ordinario) | Art. 168 (agravado) |
|---------|---------------------|---------------------|
| Ambito | Resto de la CE | Tit. Preliminar, Sec. 1.a Cap. 2.o Tit. I, Tit. II |
| Mayoria | 3/5 de cada Camara | 2/3 de cada Camara + disolucion + 2/3 nuevas Camaras |
| Referendum | **Facultativo** (1/10 en 15 dias) | **Obligatorio** |

**Clave:** Art. 11 CE = procedimiento ordinario (art. 167) = referendum facultativo si lo pide 1/10 de los miembros en 15 dias.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "8992362f-c6f8-4d31-b832-9e0ae2159d3e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.167.3 referendum facultativo (" + exp2.length + " chars)");

  // #3 - CE art.162 Ministerio Fiscal NO legitimado para recurso de inconstitucionalidad
  const exp3 = `**Articulo 162 de la Constitucion Espanola - Legitimacion ante el TC:**

> Art. 162.1: "Estan legitimados:
> a) Para interponer el **recurso de inconstitucionalidad**, el Presidente del Gobierno, el Defensor del Pueblo, 50 Diputados, 50 Senadores, los organos colegiados ejecutivos de las Comunidades Autonomas y, en su caso, las Asambleas de las mismas.
> b) Para interponer el **recurso de amparo**, toda persona natural o juridica que invoque un interes legitimo, asi como el Defensor del Pueblo y el **Ministerio Fiscal**."

**Por que A es correcta (el Ministerio Fiscal NO esta legitimado):**
El **Ministerio Fiscal** no aparece en la lista de legitimados del art. 162.1.**a)** (recurso de inconstitucionalidad). Sin embargo, **si** esta legitimado para el recurso de **amparo** (art. 162.1.b). Es una distincion clave: el MF puede interponer amparo, pero **no** recurso de inconstitucionalidad.

**Por que las demas SI estan legitimadas (art. 162.1.a):**

- **B)** "El **Defensor del Pueblo**." **Si legitimado**: aparece expresamente en el art. 162.1.a). Ademas, tambien esta legitimado para el recurso de amparo (art. 162.1.b), siendo el unico sujeto con doble legitimacion en ambos recursos.

- **C)** "Los **organos colegiados ejecutivos de las CCAA**." **Si legitimados**: el art. 162.1.a) los incluye expresamente. Se refiere a los Gobiernos autonomicos (Consejos de Gobierno).

- **D)** "**50 Senadores**." **Si legitimados**: el art. 162.1.a) incluye a 50 Senadores (igual que 50 Diputados).

**Legitimacion ante el TC (art. 162 CE):**

| Sujeto | Inconstitucionalidad | Amparo |
|--------|---------------------|--------|
| Presidente del Gobierno | Si | - |
| Defensor del Pueblo | **Si** | **Si** |
| 50 Diputados | Si | - |
| 50 Senadores | Si | - |
| Gobiernos CCAA | Si | - |
| Asambleas CCAA | Si | - |
| **Ministerio Fiscal** | **No** | **Si** |
| Personas con interes legitimo | - | Si |

**Clave:** El Ministerio Fiscal esta legitimado para el recurso de **amparo**, pero **no** para el de **inconstitucionalidad**. No confundir ambos recursos. El Defensor del Pueblo es el unico legitimado para **ambos**.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "b1dad2cb-3da7-4843-8786-eadb83a2f50f");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.162 MF no inconstitucionalidad (" + exp3.length + " chars)");
})();
